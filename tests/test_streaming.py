import asyncio
import time
from types import SimpleNamespace

import pandas as pd
from fastapi.testclient import TestClient
import pytest

from model_informed_greenhouse_dashboard import get_app
from model_informed_greenhouse_dashboard.backend.app import main as backend_main
from model_informed_greenhouse_dashboard.backend.app.services.simulator import Simulator
from model_informed_greenhouse_dashboard.backend.app.ws import ConnectionManager


def _reset_streaming_app_state() -> None:
    for crop in ("tomato", "cucumber"):
        crop_state = backend_main.app_state[crop]
        crop_state["simulator"] = None
        crop_state["forecaster"] = None
        crop_state["irrigation"] = None
        crop_state["energy"] = None
        crop_state["adapter"] = None
        crop_state["df_env"] = None
        crop_state["sim_task"] = None
        crop_state["dt_hours"] = None
        crop_state["time_step"] = "auto"
        crop_state["step_sim_duration_seconds"] = None
        crop_state["sim_seconds_per_real_second"] = None
        crop_state["pace_changed_event"] = None
        crop_state["decision"] = None
        crop_state["last_irrigation"] = None
        crop_state["last_energy"] = None
        crop_state["latest_forecast"] = None
        crop_state["last_forecast_schedule_at"] = None
        crop_state["ops_config"] = None
        crop_state["crop_config"] = None
        crop_state["csv_filename"] = None
        crop_state["pending_prune_reset"] = False
        crop_state["last_runtime_snapshot_at"] = None
        crop_state["last_runtime_tick_at"] = None
        crop_state["last_runtime_error"] = None
        crop_state["last_runtime_error_at"] = None

    backend_main.manager.active_connections.clear()


@pytest.fixture(autouse=True)
def reset_streaming_state() -> None:
    _reset_streaming_app_state()
    yield
    _reset_streaming_app_state()


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


def _make_simulator(
    *,
    step_sim_duration_seconds: float = 600.0,
    sim_seconds_per_real_second: float = 6000.0,
) -> Simulator:
    return Simulator(
        adapter=SimpleNamespace(model=SimpleNamespace(cumulative_thermal_time=123.0)),
        broadcaster=lambda path, payload: None,
        df_env=pd.DataFrame(
            {
                "datetime": pd.date_range(
                    "2026-04-03T09:00:00",
                    periods=10,
                    freq="10min",
                )
            }
        ),
        dt_hours=step_sim_duration_seconds / 3600.0,
        step_sim_duration_seconds=step_sim_duration_seconds,
        sim_seconds_per_real_second=sim_seconds_per_real_second,
    )


class LiveTask:
    def done(self) -> bool:
        return False


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


def test_verify_src001_s0002_r001_a01_stream_delay_uses_step_duration_over_pace(
    monkeypatch,
) -> None:
    class DelayProbeSimulator:
        def __init__(self) -> None:
            self.idx = 0
            self.running = True
            self.paused = False
            self.dt_hours = 1 / 6
            self.step_sim_duration_seconds = 600.0
            self.sim_seconds_per_real_second = 1200.0
            self.speed = 100.0
            self.df_env = pd.DataFrame(
                [
                    {"datetime": pd.Timestamp("2026-04-03T09:00:00")},
                    {"datetime": pd.Timestamp("2026-04-03T09:10:00")},
                ]
            )

        def step_from_index(self, idx: int) -> dict:
            self.idx = idx
            return {
                "t": "2026-04-03T09:00:00",
                "crop": "tomato",
                "kpi": {},
                "env": {"T_air_C": 21.5},
                "state": {"datetime": "2026-04-03T09:00:00"},
            }

        def stop(self) -> None:
            self.running = False

    sleep_delays: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleep_delays.append(delay)

    async def fake_broadcast(path: str, payload: dict) -> None:
        return None

    backend_main.app_state["tomato"]["simulator"] = DelayProbeSimulator()
    monkeypatch.setattr(asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(backend_main.manager, "broadcast", fake_broadcast)
    monkeypatch.setattr(
        backend_main,
        "_maybe_persist_runtime_snapshot",
        lambda *args, **kwargs: None,
    )

    asyncio.run(backend_main._run_simulation_task("tomato"))

    assert sleep_delays == [0.5]


def test_pace_change_event_wakes_active_stream_delay() -> None:
    class SleepingSimulator:
        running = True

    async def run_sleep() -> None:
        event = asyncio.Event()
        backend_main.app_state["tomato"]["pace_changed_event"] = event
        sleeper = asyncio.create_task(
            backend_main._sleep_simulation_delay(
                "tomato",
                SleepingSimulator(),
                60.0,
            )
        )
        await asyncio.sleep(0)
        event.set()
        await asyncio.wait_for(sleeper, timeout=1.0)

    asyncio.run(run_sleep())


def test_verify_src001_s0002_r002_a01_explicit_time_step_maps_to_step_duration() -> None:
    df_env = pd.DataFrame(
        {"datetime": pd.date_range("2026-04-03T09:00:00", periods=2, freq="10min")}
    )

    assert backend_main._derive_step_sim_duration_seconds("1s", df_env) == 1.0
    assert backend_main._derive_step_sim_duration_seconds("1min", df_env) == 60.0
    assert backend_main._derive_step_sim_duration_seconds("10min", df_env) == 600.0
    assert backend_main._derive_step_sim_duration_seconds("1h", df_env) == 3600.0


def test_verify_src001_s0002_r002_a02_auto_time_step_uses_median_timestamp_gap() -> None:
    df_env = pd.DataFrame(
        {
            "datetime": [
                "2026-04-03T09:00:00",
                "2026-04-03T09:01:00",
                "2026-04-03T09:11:00",
                "2026-04-03T09:21:00",
            ]
        }
    )

    assert backend_main._derive_step_sim_duration_seconds("auto", df_env) == 600.0


def test_verify_src001_s0002_r003_a01_a02_speed_endpoint_accepts_legacy_and_prefers_new() -> None:
    simulator = _make_simulator(step_sim_duration_seconds=600.0)
    backend_main.app_state["tomato"]["simulator"] = simulator
    client = TestClient(get_app())

    legacy_response = client.post("/api/speed?crop=tomato", json={"speed": 2.0})
    assert legacy_response.status_code == 200
    assert legacy_response.json()["sim_seconds_per_real_second"] == 12000.0
    assert simulator.sim_seconds_per_real_second == 12000.0

    priority_response = client.post(
        "/api/speed?crop=tomato",
        json={"speed": 99.0, "sim_seconds_per_real_second": 300.0},
    )
    assert priority_response.status_code == 200
    assert priority_response.json()["sim_seconds_per_real_second"] == 300.0
    assert simulator.sim_seconds_per_real_second == 300.0

    invalid_legacy_response = client.post(
        "/api/speed?crop=tomato",
        json={"speed": "not-a-number", "sim_seconds_per_real_second": 42.0},
    )
    assert invalid_legacy_response.status_code == 200
    assert invalid_legacy_response.json()["sim_seconds_per_real_second"] == 42.0


@pytest.mark.parametrize(
    "raw_payload",
    [
        '{"speed": NaN}',
        '{"speed": Infinity}',
    ],
)
def test_legacy_speed_rejects_non_finite_values_without_mutation(raw_payload: str) -> None:
    simulator = _make_simulator(
        step_sim_duration_seconds=600.0,
        sim_seconds_per_real_second=6000.0,
    )
    backend_main.app_state["tomato"]["simulator"] = simulator
    client = TestClient(get_app())

    response = client.post(
        "/api/speed?crop=tomato",
        content=raw_payload,
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 422
    assert simulator.sim_seconds_per_real_second == 6000.0


def test_verify_src001_s0002_r004_a01_sim_seconds_per_real_second_is_clamped() -> None:
    simulator = _make_simulator(step_sim_duration_seconds=600.0)
    backend_main.app_state["tomato"]["simulator"] = simulator
    client = TestClient(get_app())

    low_response = client.post(
        "/api/speed?crop=tomato",
        json={"sim_seconds_per_real_second": 0.5},
    )
    assert low_response.status_code == 200
    assert low_response.json()["sim_seconds_per_real_second"] == 1.0

    high_response = client.post(
        "/api/speed?crop=tomato",
        json={"sim_seconds_per_real_second": 1_000_000.0},
    )
    assert high_response.status_code == 200
    assert high_response.json()["sim_seconds_per_real_second"] == 86400.0


@pytest.mark.parametrize(
    "raw_payload",
    [
        '{"sim_seconds_per_real_second": 0}',
        '{"sim_seconds_per_real_second": -1}',
        '{"sim_seconds_per_real_second": NaN}',
        '{"sim_seconds_per_real_second": Infinity}',
    ],
)
def test_verify_src001_s0002_r005_a01_invalid_sim_seconds_return_422_without_mutation(
    raw_payload: str,
) -> None:
    simulator = _make_simulator(
        step_sim_duration_seconds=600.0,
        sim_seconds_per_real_second=6000.0,
    )
    backend_main.app_state["tomato"]["simulator"] = simulator
    client = TestClient(get_app())

    response = client.post(
        "/api/speed?crop=tomato",
        content=raw_payload,
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 422
    assert simulator.sim_seconds_per_real_second == 6000.0


def test_verify_src001_s0002_r006_a01_speed_change_preserves_runtime_and_websockets() -> None:
    simulator = _make_simulator(step_sim_duration_seconds=600.0)
    simulator.idx = 7
    simulator.start()
    backend_main.app_state["tomato"]["simulator"] = simulator
    backend_main.app_state["tomato"]["adapter"] = simulator.adapter
    backend_main.app_state["tomato"]["sim_task"] = LiveTask()
    socket = object()
    backend_main.manager.active_connections["/ws/sim/tomato"] = {socket}

    response = TestClient(get_app()).post(
        "/api/speed?crop=tomato",
        json={"sim_seconds_per_real_second": 7200.0},
    )

    assert response.status_code == 200
    assert simulator.idx == 7
    assert simulator.adapter.model.cumulative_thermal_time == 123.0
    assert backend_main.manager.active_connections["/ws/sim/tomato"] == {socket}


def test_verify_src001_s0002_r007_a01_status_includes_current_sim_seconds_per_real_second() -> None:
    simulator = _make_simulator(
        step_sim_duration_seconds=600.0,
        sim_seconds_per_real_second=4321.0,
    )
    simulator.start()
    backend_main.app_state["cucumber"]["simulator"] = simulator
    backend_main.app_state["cucumber"]["sim_task"] = LiveTask()
    backend_main.app_state["cucumber"]["time_step"] = "10min"
    backend_main.app_state["cucumber"]["dt_hours"] = 1 / 6

    response = TestClient(get_app()).get("/api/status")

    assert response.status_code == 200
    cucumber = response.json()["greenhouses"]["cucumber"]
    assert cucumber["sim_seconds_per_real_second"] == 4321.0
    assert cucumber["step_sim_duration_seconds"] == 600.0
