from model_informed_greenhouse_dashboard.backend.app.services.adaptive_advisor.runtime_cache import (
    RuntimeLaneCache,
)


def test_runtime_lane_cache_is_bounded_and_returns_copies():
    now = [0.0]
    cache = RuntimeLaneCache(
        ttl_seconds=10,
        max_entries=2,
        clock=lambda: now[0],
    )
    calls = [0]

    def compute():
        calls[0] += 1
        return {"status": "ready", "nested": {"value": calls[0]}}

    first, first_hit = cache.get_or_compute("a", compute)
    first["nested"]["value"] = 999
    second, second_hit = cache.get_or_compute("a", compute)
    assert first_hit is False
    assert second_hit is True
    assert second["nested"]["value"] == 1
    assert calls[0] == 1

    cache.get_or_compute("b", compute)
    cache.get_or_compute("c", compute)
    assert cache.describe()["entry_count"] == 2
    assert cache.describe()["evictions"] >= 1

    now[0] = 20.0
    _value, hit = cache.get_or_compute("c", compute)
    assert hit is False
