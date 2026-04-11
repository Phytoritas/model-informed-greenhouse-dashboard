import asyncio
import time

import pandas as pd
from fastapi.testclient import TestClient

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app import main as backend_main
from model_informed_greenhouse_dashboard.backend.app.ws import ConnectionManager


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


def test_broadcast_tolerates_connection_set_changes_mid_iteration() -> None:
    manager = ConnectionManager()
    path = "/ws/sim/cucumber"
    sent_payloads: list[str] = []

    class PassiveSocket:
        async def send_text(self, data: str) -> None:
            sent_payloads.append(f"passive:{data}")

    class DisconnectingSocket:
        def __init__(self, target: PassiveSocket) -> None:
            self._target = target

        async def send_text(self, data: str) -> None:
            sent_payloads.append(f"disconnecting:{data}")
            manager.disconnect(self._target, path)

    passive_socket = PassiveSocket()
    disconnecting_socket = DisconnectingSocket(passive_socket)
    manager.active_connections[path] = {disconnecting_socket, passive_socket}

    asyncio.run(manager.broadcast(path, {"status": "ok"}))

    assert sent_payloads
    assert passive_socket not in manager.active_connections[path]


def test_broadcast_drops_slow_clients_without_blocking_all_peers() -> None:
    manager = ConnectionManager()
    path = "/ws/sim/tomato"
    sent_payloads: list[str] = []

    class FastSocket:
        async def send_text(self, data: str) -> None:
            sent_payloads.append(f"fast:{data}")

    class SlowSocket:
        async def send_text(self, data: str) -> None:
            await asyncio.sleep(2.0)
            sent_payloads.append(f"slow:{data}")

    fast_socket = FastSocket()
    slow_socket = SlowSocket()
    manager.active_connections[path] = {fast_socket, slow_socket}

    started_at = time.monotonic()
    asyncio.run(manager.broadcast(path, {"status": "ok"}))
    elapsed = time.monotonic() - started_at

    assert elapsed < 1.5
    assert sent_payloads == ['fast:{"status": "ok"}']
    assert slow_socket not in manager.active_connections[path]
