"""Environment-dataset management: insert your own data and simulate on it.

The simulation runs on an environment CSV resolved by filename under the data
directory (``/api/start`` -> ``BatchIngestor``). Until now the only datasets were the
two bundled fixtures (``Tomato_Env.CSV`` / ``Cucumber_Env.CSV``) and there was no way to
add your own. This service adds that: validate an uploaded environment CSV against the
canonical schema, store it safely, list what is available, and resolve a dataset name to
an on-disk path for the simulator.

Two safety properties matter here and are enforced centrally:

1. **No path traversal.** A dataset name is user-controlled and ends up joined to a
   directory. ``resolve_dataset_path`` rejects anything that is not a plain filename
   inside the managed directory, so ``../../etc/passwd`` or an absolute path cannot
   escape. ``/api/start`` should resolve through here rather than joining by hand.
2. **Schema validation before storage.** A dataset that does not match the environment
   schema would fail deep inside the simulator with an opaque error. Validate up front —
   required columns, parseable timestamps, numeric ranges, row count — and reject with a
   clear message so a bad upload never reaches the runtime.

Reference: docs/research/20260717-advisor-answer-quality-architecture/ (unrelated), and
the simulator's environment contract in services/ingest.py.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from ..config import settings


#: Canonical environment schema the simulator consumes (services/ingest.py ranges +
#: the adapters). A dataset must carry the timestamp and every environment channel.
REQUIRED_COLUMNS: tuple[str, ...] = (
    "datetime",
    "T_air_C",
    "PAR_umol",
    "CO2_ppm",
    "RH_percent",
    "wind_speed_ms",
)

#: Plausibility ranges used only to reject a clearly-wrong upload (e.g. temperature in
#: Kelvin, RH as a fraction). The simulator's ingestor still clips per-row; this is a
#: coarser "is this the right kind of data at all" gate at insert time.
_SANITY_RANGES: dict[str, tuple[float, float]] = {
    "T_air_C": (-30.0, 60.0),
    "PAR_umol": (0.0, 3500.0),
    "CO2_ppm": (200.0, 5000.0),
    "RH_percent": (0.0, 100.0),
    "wind_speed_ms": (0.0, 60.0),
}

#: The bundled fixtures. They are listed but never overwritten or deleted.
BUNDLED_DATASETS: tuple[str, ...] = ("Tomato_Env.CSV", "Cucumber_Env.CSV")

#: Uploaded datasets live in their own subdirectory so they never collide with the
#: bundled fixtures or other data-dir assets.
_UPLOAD_SUBDIR = "uploads"

_MAX_UPLOAD_BYTES = 64 * 1024 * 1024  # 64 MiB
_MIN_ROWS = 2
_SAFE_STEM = re.compile(r"[^A-Za-z0-9._-]+")


class DatasetError(ValueError):
    """A dataset was rejected. Carries a grower-readable reason."""


@dataclass(frozen=True)
class DatasetInfo:
    name: str
    kind: str  # "bundled" | "uploaded"
    rows: int | None = None
    start: str | None = None
    end: str | None = None
    size_bytes: int | None = None
    uploaded_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "kind": self.kind,
            "rows": self.rows,
            "start": self.start,
            "end": self.end,
            "size_bytes": self.size_bytes,
            "uploaded_at": self.uploaded_at,
        }


def _data_dir() -> Path:
    return Path(settings.data_dir)


def uploads_dir() -> Path:
    path = _data_dir() / _UPLOAD_SUBDIR
    path.mkdir(parents=True, exist_ok=True)
    return path


def _sanitize_name(filename: str) -> str:
    """Turn an arbitrary upload filename into a safe ``*.csv`` basename.

    Strips any directory component and disallowed characters. Rejects names that
    would collide with a bundled fixture, so an upload can never shadow one.
    """
    base = Path(filename or "").name.strip()
    if not base:
        raise DatasetError("파일 이름이 비어 있습니다.")
    stem = base[:-4] if base.lower().endswith(".csv") else base
    safe_stem = _SAFE_STEM.sub("_", stem).strip("._-")
    if not safe_stem:
        raise DatasetError("파일 이름에 사용할 수 있는 문자가 없습니다.")
    name = f"{safe_stem}.csv"
    if name in BUNDLED_DATASETS or name.lower() in {b.lower() for b in BUNDLED_DATASETS}:
        raise DatasetError(f"'{name}'은(는) 기본 제공 데이터셋 이름이라 사용할 수 없습니다.")
    return name


def validate_environment_frame(df: pd.DataFrame) -> dict[str, Any]:
    """Validate a candidate environment dataframe against the schema.

    Returns a summary (rows, date range) on success; raises :class:`DatasetError`
    with a specific reason on failure.
    """
    missing = [column for column in REQUIRED_COLUMNS if column not in df.columns]
    if missing:
        raise DatasetError(
            "필수 컬럼이 없습니다: "
            + ", ".join(missing)
            + f". 필요한 컬럼: {', '.join(REQUIRED_COLUMNS)}"
        )

    if len(df) < _MIN_ROWS:
        raise DatasetError(f"행이 너무 적습니다({len(df)}행). 최소 {_MIN_ROWS}행이 필요합니다.")

    parsed_dt = pd.to_datetime(df["datetime"], errors="coerce")
    if parsed_dt.isna().all():
        raise DatasetError("datetime 컬럼을 날짜/시간으로 해석할 수 없습니다.")
    if parsed_dt.isna().any():
        bad = int(parsed_dt.isna().sum())
        raise DatasetError(f"datetime 컬럼에 해석할 수 없는 값이 {bad}개 있습니다.")

    for column, (low, high) in _SANITY_RANGES.items():
        numeric = pd.to_numeric(df[column], errors="coerce")
        if numeric.isna().all():
            raise DatasetError(f"'{column}' 컬럼이 숫자가 아닙니다.")
        finite = numeric.dropna()
        # A median well outside the plausible band signals the wrong unit/kind of data.
        median = float(finite.median())
        if median < low or median > high:
            raise DatasetError(
                f"'{column}' 값이 예상 범위를 벗어납니다(중앙값 {median:g}, 허용 {low:g}~{high:g}). "
                "단위가 올바른지 확인하세요."
            )

    ordered = parsed_dt.sort_values()
    return {
        "rows": int(len(df)),
        "start": ordered.iloc[0].isoformat(),
        "end": ordered.iloc[-1].isoformat(),
    }


def save_uploaded_dataset(
    *,
    filename: str,
    content: bytes,
    now_iso: str | None = None,
) -> DatasetInfo:
    """Validate and store an uploaded environment CSV.

    Raises :class:`DatasetError` on an oversized, unreadable, or non-conforming file so
    a bad upload never reaches the simulator. ``now_iso`` is injected for testability.
    """
    if not content:
        raise DatasetError("빈 파일입니다.")
    if len(content) > _MAX_UPLOAD_BYTES:
        raise DatasetError(
            f"파일이 너무 큽니다({len(content) / 1e6:.1f} MB). "
            f"최대 {_MAX_UPLOAD_BYTES / 1e6:.0f} MB까지 허용됩니다."
        )

    name = _sanitize_name(filename)

    try:
        text = _decode_csv_bytes(content)
        frame = pd.read_csv(io.StringIO(text))
    except DatasetError:
        raise
    except Exception as exc:  # pragma: no cover - pandas raises many parse errors
        raise DatasetError(f"CSV로 읽을 수 없습니다: {type(exc).__name__}") from exc

    summary = validate_environment_frame(frame)

    target = uploads_dir() / name
    # Write the normalized CSV (parsed once, columns preserved) rather than the raw
    # bytes, so what the simulator reads is exactly what was validated.
    frame.to_csv(target, index=False, encoding="utf-8")

    return DatasetInfo(
        name=name,
        kind="uploaded",
        rows=summary["rows"],
        start=summary["start"],
        end=summary["end"],
        size_bytes=target.stat().st_size,
        uploaded_at=now_iso,
    )


def _decode_csv_bytes(content: bytes) -> str:
    for encoding in ("utf-8-sig", "utf-8", "cp949", "euc-kr"):
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise DatasetError("파일 인코딩을 인식할 수 없습니다(UTF-8 또는 CP949/EUC-KR).")


def resolve_dataset_path(name: str) -> Path:
    """Resolve a dataset name to an on-disk path, refusing traversal.

    Accepts a bundled fixture (in the data dir) or an uploaded dataset (in the uploads
    subdir). Any name that is not a plain existing file inside a managed directory is
    rejected — no ``..``, no absolute paths, no escaping the data dir.
    """
    if not name or name != Path(name).name:
        raise DatasetError("잘못된 데이터셋 이름입니다.")

    data_dir = _data_dir().resolve()
    uploads = uploads_dir().resolve()

    for base in (data_dir, uploads):
        candidate = (base / name).resolve()
        # Containment check: the resolved path must stay under the managed dir.
        if base in candidate.parents and candidate.is_file():
            return candidate

    raise DatasetError(f"데이터셋을 찾을 수 없습니다: {name}")


def list_datasets() -> list[DatasetInfo]:
    """List bundled fixtures and uploaded datasets."""
    infos: list[DatasetInfo] = []
    data_dir = _data_dir()

    for bundled in BUNDLED_DATASETS:
        path = data_dir / bundled
        infos.append(
            DatasetInfo(
                name=bundled,
                kind="bundled",
                size_bytes=path.stat().st_size if path.is_file() else None,
            )
        )

    upload_root = uploads_dir()
    for path in sorted(upload_root.glob("*.csv")):
        stat = path.stat()
        infos.append(
            DatasetInfo(
                name=path.name,
                kind="uploaded",
                size_bytes=stat.st_size,
                uploaded_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
            )
        )
    return infos


def delete_uploaded_dataset(name: str) -> None:
    """Delete an uploaded dataset. Bundled fixtures cannot be deleted."""
    if name in BUNDLED_DATASETS:
        raise DatasetError("기본 제공 데이터셋은 삭제할 수 없습니다.")
    if not name or name != Path(name).name:
        raise DatasetError("잘못된 데이터셋 이름입니다.")
    target = (uploads_dir() / name).resolve()
    if uploads_dir().resolve() not in target.parents or not target.is_file():
        raise DatasetError(f"업로드된 데이터셋을 찾을 수 없습니다: {name}")
    target.unlink()
