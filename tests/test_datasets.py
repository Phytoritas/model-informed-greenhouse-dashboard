"""Insert your own environment dataset and simulate on it — safely."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app.config import settings
from model_informed_greenhouse_dashboard.backend.app.services import datasets


def _valid_csv(hours: int = 6) -> bytes:
    rows = ["datetime,T_air_C,PAR_umol,CO2_ppm,RH_percent,wind_speed_ms"]
    for hour in range(hours):
        par = max(0, (hour - 6) * 80)
        rows.append(f"2024-07-01 {hour:02d}:00,{18 + hour * 0.3:.1f},{par},{450 - hour},{85 - hour},0.3")
    return ("\n".join(rows) + "\n").encode()


@pytest.fixture
def temp_data_dir(monkeypatch, tmp_path: Path):
    """Point the dataset service at a temp data dir with the bundled fixtures present."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    # The bundled fixtures only need to exist for listing.
    for bundled in datasets.BUNDLED_DATASETS:
        (data_dir / bundled).write_bytes(_valid_csv())
    monkeypatch.setattr(settings, "data_dir", str(data_dir))
    return data_dir


def test_valid_dataset_is_accepted_and_normalized(temp_data_dir) -> None:
    info = datasets.save_uploaded_dataset(
        filename="my house data.csv", content=_valid_csv(), now_iso="2026-07-18T00:00:00Z"
    )
    assert info.name == "my_house_data.csv"  # spaces collapse to underscores
    assert info.kind == "uploaded"
    assert info.rows == 6
    assert info.start and info.end
    # The stored file is the normalized CSV.
    stored = datasets.resolve_dataset_path(info.name)
    assert stored.is_file()
    assert stored.read_text(encoding="utf-8").splitlines()[0].startswith("datetime,")


def test_missing_columns_are_rejected(temp_data_dir) -> None:
    with pytest.raises(datasets.DatasetError) as exc:
        datasets.save_uploaded_dataset(
            filename="bad.csv", content=b"datetime,T_air_C\n2024-07-01 00:00,18\n"
        )
    assert "필수 컬럼" in str(exc.value)


def test_empty_file_is_rejected(temp_data_dir) -> None:
    with pytest.raises(datasets.DatasetError):
        datasets.save_uploaded_dataset(filename="empty.csv", content=b"")


def test_wrong_unit_is_rejected(temp_data_dir) -> None:
    # Temperature in Kelvin -> median far outside the plausible Celsius band.
    kelvin = (
        "datetime,T_air_C,PAR_umol,CO2_ppm,RH_percent,wind_speed_ms\n"
        "2024-07-01 00:00,291,0,422,88,0.3\n"
        "2024-07-01 01:00,292,0,430,86,0.4\n"
    ).encode()
    with pytest.raises(datasets.DatasetError) as exc:
        datasets.save_uploaded_dataset(filename="kelvin.csv", content=kelvin)
    assert "T_air_C" in str(exc.value)


def test_unparseable_datetime_is_rejected(temp_data_dir) -> None:
    bad = (
        "datetime,T_air_C,PAR_umol,CO2_ppm,RH_percent,wind_speed_ms\n"
        "not-a-date,18.7,0,422,88,0.3\n"
        "also-bad,19.1,0,430,86,0.4\n"
    ).encode()
    with pytest.raises(datasets.DatasetError) as exc:
        datasets.save_uploaded_dataset(filename="baddate.csv", content=bad)
    assert "datetime" in str(exc.value)


@pytest.mark.parametrize("evil", ["../../etc/passwd", "/etc/passwd", "..\\..\\win.ini", ""])
def test_resolve_rejects_path_traversal(temp_data_dir, evil: str) -> None:
    with pytest.raises(datasets.DatasetError):
        datasets.resolve_dataset_path(evil)


def test_korean_filename_is_preserved(temp_data_dir) -> None:
    """A Korean-named upload must keep its Hangul, not collapse to ASCII fragments."""
    info = datasets.save_uploaded_dataset(filename="여름_실측_2024.csv", content=_valid_csv())
    assert info.name == "여름_실측_2024.csv"
    info2 = datasets.save_uploaded_dataset(filename="내 온실 데이터.csv", content=_valid_csv())
    assert info2.name == "내_온실_데이터.csv"  # spaces collapse to underscores
    # Both remain resolvable and traversal is still blocked.
    assert datasets.resolve_dataset_path("여름_실측_2024.csv").is_file()


def test_upload_cannot_shadow_a_bundled_fixture(temp_data_dir) -> None:
    with pytest.raises(datasets.DatasetError):
        datasets.save_uploaded_dataset(filename="Tomato_Env.CSV", content=_valid_csv())


def test_bundled_fixtures_cannot_be_deleted(temp_data_dir) -> None:
    with pytest.raises(datasets.DatasetError):
        datasets.delete_uploaded_dataset("Tomato_Env.CSV")


def test_listing_includes_bundled_and_uploaded(temp_data_dir) -> None:
    datasets.save_uploaded_dataset(filename="mine.csv", content=_valid_csv())
    names = {d.name: d.kind for d in datasets.list_datasets()}
    assert names.get("Tomato_Env.CSV") == "bundled"
    assert names.get("Cucumber_Env.CSV") == "bundled"
    assert names.get("mine.csv") == "uploaded"


def test_api_upload_list_and_delete(temp_data_dir) -> None:
    client = TestClient(get_app())

    listed = client.get("/api/datasets")
    assert listed.status_code == 200
    assert listed.json()["required_columns"] == list(datasets.REQUIRED_COLUMNS)

    up = client.post("/api/datasets?filename=api_env.csv", content=_valid_csv())
    assert up.status_code == 200, up.text
    assert up.json()["dataset"]["name"] == "api_env.csv"

    names = {d["name"] for d in client.get("/api/datasets").json()["datasets"]}
    assert "api_env.csv" in names

    bad = client.post("/api/datasets?filename=bad.csv", content=b"datetime\n2024-07-01\n")
    assert bad.status_code == 400
    assert "필수 컬럼" in bad.json()["detail"]

    deleted = client.delete("/api/datasets/api_env.csv")
    assert deleted.status_code == 200
    assert client.delete("/api/datasets/Tomato_Env.CSV").status_code == 403


def test_api_start_resolves_upload_and_blocks_traversal(temp_data_dir) -> None:
    with TestClient(get_app()) as client:  # enter lifespan so crop state is initialized
        client.post("/api/datasets?filename=sim_env.csv", content=_valid_csv())

        started = client.post(
            "/api/start",
            json={"crop": "tomato", "csv_filename": "sim_env.csv", "time_step": "1h"},
        )
        assert started.status_code == 200, started.text
        assert started.json()["status"] == "success"
        assert started.json()["rows"] == 6

        traversal = client.post(
            "/api/start",
            json={"crop": "tomato", "csv_filename": "../../pyproject.toml"},
        )
        assert traversal.status_code == 404
