"""Unit-aware numeric authorization for adaptive advisor narration.

Only curated, visible packet statements and explicitly selected structured fields
may authorize a number.  Values never cross unit classes: a percent in a market
assumption cannot authorize the same magnitude as a temperature or mass.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Iterable

from .contracts import AdaptiveAnswerPacket, AuthorizedNumericClaim


_ISO_DATE_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
_NUMBER_RE = re.compile(
    r"(?<![\w])"
    r"(?P<value>[-+]?\d+(?:,\d{3})*(?:\.\d+)?)"
    r"\s*"
    r"(?P<unit>"
    r"µmol\s*m[⁻\-]?[²2]\s*s[⁻\-]?[¹1]|"
    r"mol\s*m[⁻\-]?[²2]\s*s[⁻\-]?[¹1]|"
    r"mm\s*h[⁻\-]?[¹1]|"
    r"kWh|kW|kPa|ppm|kg|g|℃|°C|%|원|시간|일|hours?|days?|h|d"
    r")?"
)

_UNIT_ALIASES = {
    "℃": "celsius",
    "°c": "celsius",
    "%": "percent",
    "percent": "percent",
    "퍼센트": "percent",
    "ppm": "ppm",
    "kg": "kg",
    "g": "g",
    "원": "krw",
    "kpa": "kPa",
    "kw": "kW",
    "kwh": "kWh",
    "h": "hour",
    "hour": "hour",
    "hours": "hour",
    "시간": "hour",
    "d": "day",
    "day": "day",
    "days": "day",
    "일": "day",
    "mm h⁻¹": "mm_per_hour",
    "mm h-1": "mm_per_hour",
    "mol m⁻² s⁻¹": "mol_m2_s",
    "mol m-2 s-1": "mol_m2_s",
    "µmol m⁻² s⁻¹": "umol_m2_s",
    "µmol m-2 s-1": "umol_m2_s",
}
_TELEMETRY_UNITS = {
    "temperature": "celsius",
    "canopyTemp": "celsius",
    "humidity": "percent",
    "co2": "ppm",
    "light": "umol_m2_s",
    "vpd": "kPa",
    "soilMoisture": "unitless",
    "transpiration": "mm_per_hour",
    "stomatalConductance": "mol_m2_s",
    "photosynthesis": "umol_m2_s",
}


def canonical_unit(value: str | None) -> str:
    if value is None or not str(value).strip():
        return "unitless"
    normalized = re.sub(r"\s+", " ", str(value).strip()).lower()
    return _UNIT_ALIASES.get(normalized, normalized)


def _mask_iso_dates(text: str) -> str:
    chars = list(text)
    for match in _ISO_DATE_RE.finditer(text):
        for index in range(match.start(), match.end()):
            chars[index] = " "
    return "".join(chars)


def extract_numeric_mentions(text: str) -> list[dict[str, Any]]:
    """Extract numeric claims while ignoring dates and structural list numbers."""

    masked = _mask_iso_dates(str(text))
    mentions: list[dict[str, Any]] = []
    for match in _NUMBER_RE.finditer(masked):
        start, end = match.span()
        line_start = masked.rfind("\n", 0, start) + 1
        prefix = masked[line_start:start]
        suffix = masked[end : end + 1]
        if re.fullmatch(r"\s*", prefix) and suffix in {".", ")"}:
            continue
        raw_value = match.group("value")
        try:
            value = float(raw_value.replace(",", ""))
        except ValueError:
            continue
        if value != value:
            continue
        raw_unit = match.group("unit")
        mentions.append(
            {
                "value": value,
                "unit": canonical_unit(raw_unit),
                "token": str(text)[start:end],
                "start": start,
                "end": end,
            }
        )
    return mentions


def _claim_id(*, value: float, unit: str, semantic: str, source_path: str) -> str:
    payload = f"{value:.12g}|{unit}|{semantic}|{source_path}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()[:20]


def _claim(
    *,
    value: Any,
    unit: str | None,
    semantic: str,
    source_path: str,
    rendering: str | None = None,
    tolerance: float | None = None,
) -> AuthorizedNumericClaim | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number != number:
        return None
    canonical = canonical_unit(unit)
    default_tolerance = max(1e-9, abs(number) * 1e-6)
    return AuthorizedNumericClaim(
        claim_id=_claim_id(
            value=number,
            unit=canonical,
            semantic=semantic,
            source_path=source_path,
        ),
        value=number,
        unit=canonical,
        semantic=semantic,
        source_path=source_path,
        tolerance=(
            max(default_tolerance, float(tolerance))
            if tolerance is not None
            else default_tolerance
        ),
        renderings=[rendering] if rendering else [],
    )


def _visible_strings(packet: AdaptiveAnswerPacket) -> Iterable[tuple[str, str]]:
    yield "direct_answer", packet.direct_answer
    for index, value in enumerate(packet.observations):
        yield f"observations[{index}]", value
    for index, driver in enumerate(packet.causal_drivers):
        yield f"causal_drivers[{index}].label", driver.label
        for observation_index, value in enumerate(driver.observations):
            yield (
                f"causal_drivers[{index}].observations[{observation_index}]",
                value,
            )
    for index, action in enumerate(packet.actions):
        yield f"actions[{index}].title", action.title
        yield f"actions[{index}].operator", action.operator
        yield f"actions[{index}].time_window", action.time_window
        yield f"actions[{index}].expected_effect", action.expected_effect
        if action.condition:
            yield f"actions[{index}].condition", action.condition
    for index, value in enumerate(packet.uncertainties):
        yield f"uncertainties[{index}]", value


def collect_authorized_numeric_claims(
    packet: AdaptiveAnswerPacket,
) -> list[AuthorizedNumericClaim]:
    """Build a curated unit-aware claim ledger for one answer packet."""

    claims: list[AuthorizedNumericClaim] = []
    for source_path, text in _visible_strings(packet):
        for mention in extract_numeric_mentions(text):
            claim = _claim(
                value=mention["value"],
                unit=mention["unit"],
                semantic=source_path,
                source_path=source_path,
                rendering=mention["token"],
            )
            if claim is not None:
                claims.append(claim)

    temporal = packet.temporal_context
    target = str(temporal.get("telemetry_target") or "")
    target_delta = temporal.get("target_delta")
    if target and target_delta is not None:
        claim = _claim(
            value=target_delta,
            unit=_TELEMETRY_UNITS.get(target, "unitless"),
            semantic=f"{target}_delta",
            source_path="temporal_context.target_delta",
        )
        if claim is not None:
            claims.append(claim)
    if temporal.get("environment_similarity") is not None:
        claim = _claim(
            value=temporal["environment_similarity"],
            unit="unitless",
            semantic="environment_similarity",
            source_path="temporal_context.environment_similarity",
        )
        if claim is not None:
            claims.append(claim)

    peak = packet.market_context.get("peak_shock")
    if isinstance(peak, dict):
        for key, unit, semantic in (
            ("price_pressure_pct", "percent", "market_price_pressure"),
            ("shock_ratio", "unitless", "market_arrival_shock_ratio"),
            ("expected_arrival_kg", "kg", "market_expected_arrival"),
            ("baseline_arrival_kg", "kg", "market_baseline_arrival"),
            ("released_backlog_kg", "kg", "market_released_backlog"),
        ):
            if peak.get(key) is None:
                continue
            claim = _claim(
                value=peak[key],
                unit=unit,
                semantic=semantic,
                source_path=f"market_context.peak_shock.{key}",
            )
            if claim is not None:
                claims.append(claim)

    focus = packet.model_context.get("answer_focus")
    if isinstance(focus, dict):
        focus_unit = focus.get("unit")
        for key in ("requested_delta", "matched_delta", "max_supported_delta"):
            if focus.get(key) is None:
                continue
            claim = _claim(
                value=focus[key],
                unit=focus_unit,
                semantic=f"model_{key}",
                source_path=f"model_context.answer_focus.{key}",
            )
            if claim is not None:
                claims.append(claim)

    unique: dict[tuple[float, str, str], AuthorizedNumericClaim] = {}
    for claim in claims:
        key = (round(claim.value, 12), claim.unit, claim.semantic)
        existing = unique.get(key)
        if existing is None:
            unique[key] = claim
        else:
            existing.renderings = list(
                dict.fromkeys([*existing.renderings, *claim.renderings])
            )
    return list(unique.values())


def numeric_mention_is_authorized(
    mention: dict[str, Any],
    claims: list[AuthorizedNumericClaim],
) -> bool:
    value = float(mention["value"])
    unit = canonical_unit(str(mention.get("unit") or "unitless"))
    for claim in claims:
        if canonical_unit(claim.unit) != unit:
            continue
        if abs(value - claim.value) <= max(claim.tolerance, 1e-9):
            return True
    return False
