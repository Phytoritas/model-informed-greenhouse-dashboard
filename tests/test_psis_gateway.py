"""The PSIS gateway must fail closed: no key, no guess."""

from __future__ import annotations

import httpx

from model_informed_greenhouse_dashboard.backend.app.services import psis_gateway
from model_informed_greenhouse_dashboard.backend.app.services.pesticide_safety import (
    authoritative_answer_or_refusal,
)


def test_unconfigured_gateway_does_not_query_or_guess(monkeypatch) -> None:
    monkeypatch.delenv("PSIS_SERVICE_KEY", raising=False)
    assert not psis_gateway.is_configured()

    result = psis_gateway.fetch_safe_use_standard(
        crop="tomato", product_or_ingredient="포룸"
    )
    assert result.status == "unconfigured"
    assert result.pre_harvest_interval_days is None
    assert not result.is_authoritative


def test_authoritative_answer_falls_back_to_refusal_without_a_key(monkeypatch) -> None:
    monkeypatch.delenv("PSIS_SERVICE_KEY", raising=False)
    answer = authoritative_answer_or_refusal(
        crop="tomato", product_or_ingredient="포룸", language="ko"
    )
    assert answer["status"] == "refused_safe_use_standard"
    assert "psis.rda.go.kr" in answer["authoritative_sources"]["registry"]


def test_gateway_parses_a_data_go_kr_record(monkeypatch) -> None:
    monkeypatch.setenv("PSIS_SERVICE_KEY", "test-key")

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "response": {
                    "body": {
                        "items": {
                            "item": [
                                {
                                    "pesticideName": "포룸",
                                    "cropName": "토마토",
                                    "pestName": "역병",
                                    "useSuittime": "3",
                                    "useNum": "4",
                                    "dilutUnit": "2000배",
                                    "prlsGboonName": "등록",
                                }
                            ]
                        }
                    }
                }
            },
        )

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client:
        result = psis_gateway.fetch_safe_use_standard(
            crop="토마토",
            product_or_ingredient="포룸",
            target_pest="역병",
            now_iso="2026-07-18T00:00:00Z",
            client=client,
        )

    assert result.status == "ok"
    assert result.is_authoritative
    assert result.pre_harvest_interval_days == 3
    assert result.max_applications == 4
    assert result.dilution == "2000배"
    assert result.fetched_at == "2026-07-18T00:00:00Z"


def test_gateway_returns_refusal_details_on_http_error(monkeypatch) -> None:
    monkeypatch.setenv("PSIS_SERVICE_KEY", "test-key")

    def _handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503)

    transport = httpx.MockTransport(_handler)
    with httpx.Client(transport=transport) as client:
        result = psis_gateway.fetch_safe_use_standard(
            crop="토마토", product_or_ingredient="포룸", client=client
        )
    assert result.status == "error"
    assert not result.is_authoritative


def test_authoritative_answer_surfaces_only_a_registry_number(monkeypatch) -> None:
    """When configured and the lookup succeeds, the number is the registry's."""
    monkeypatch.setenv("PSIS_SERVICE_KEY", "test-key")

    def _fake_fetch(**kwargs):
        return psis_gateway.SafeUseStandard(
            status="ok",
            product_name="포룸",
            crop="토마토",
            pre_harvest_interval_days=3,
            max_applications=4,
            fetched_at="2026-07-18T00:00:00Z",
        )

    monkeypatch.setattr(
        "model_informed_greenhouse_dashboard.backend.app.services.psis_gateway."
        "fetch_safe_use_standard",
        _fake_fetch,
    )
    answer = authoritative_answer_or_refusal(
        crop="토마토", product_or_ingredient="포룸"
    )
    assert answer["status"] == "authoritative_safe_use_standard"
    assert answer["standard"]["pre_harvest_interval_days"] == 3
