import pandas as pd
from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app import main as backend_main


class DummySimulator:
    def __init__(self) -> None:
        self.idx = 0
        self.running = True
        self.df_env = pd.DataFrame(
            [{"datetime": pd.Timestamp("2026-04-03T09:00:00")}]
        )

    def step_from_index(self, idx: int) -> dict:
        self.idx = idx
        return {
            "t": "2026-04-03T09:00:00",
            "crop": "tomato",
            "kpi": {"yield_confidence": 91},
            "env": {"T_air_C": 21.5},
            "state": {"development_stage": "vegetative"},
        }


class DummyIrrigation:
    def update_step(self, state: dict, dt) -> dict:  # noqa: ANN001
        return {"recommended_irrigation_l": 12.5, "state": state, "dt": str(dt)}


class DummyEnergy:
    def estimate_step(self, **kwargs) -> dict:  # noqa: ANN003
        return {"P_elec_kW": 4.2, "COP_current": 3.6, "kwargs": kwargs}


def test_step_endpoint_broadcasts_single_crop_payload(monkeypatch) -> None:
    broadcasts: list[tuple[str, dict]] = []

    async def fake_broadcast(path: str, payload: dict) -> None:
        broadcasts.append((path, payload))

    crop_state = backend_main.app_state["tomato"]
    crop_state["simulator"] = DummySimulator()
    crop_state["irrigation"] = DummyIrrigation()
    crop_state["energy"] = DummyEnergy()
    crop_state["decision"] = None
    crop_state["dt_hours"] = 1.0

    monkeypatch.setattr(backend_main.manager, "broadcast", fake_broadcast)

    client = TestClient(get_app())
    response = client.post("/api/step?crop=tomato")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["idx"] == 1
    assert len(broadcasts) == 1
    assert broadcasts[0][0] == "/ws/sim/tomato"
    assert broadcasts[0][1]["irrigation"]["recommended_irrigation_l"] == 12.5
    assert broadcasts[0][1]["energy"]["P_elec_kW"] == 4.2
