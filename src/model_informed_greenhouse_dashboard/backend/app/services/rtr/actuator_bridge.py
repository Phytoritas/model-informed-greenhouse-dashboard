"""Bridge actuator candidates into post-control phase states."""

from __future__ import annotations

from typing import Any

from .controller_contract import RTROptimizationInputs, RtrControlCandidate, horizon_hours
from .post_control_state import build_post_control_phase_state


def evaluate_actuator_candidate(
    *,
    context,
    optimization_inputs: RTROptimizationInputs,
    candidate: RtrControlCandidate,
) -> dict[str, Any]:
    day_hours, night_hours = horizon_hours(optimization_inputs.target_horizon)
    day_state = build_post_control_phase_state(
        context=context,
        candidate=candidate,
        phase="day",
        phase_hours=day_hours,
    )
    night_state = build_post_control_phase_state(
        context=context,
        candidate=candidate,
        phase="night",
        phase_hours=night_hours,
    )
    return {
        "availability": day_state["availability"],
        "candidate": day_state["candidate"],
        "phases": {
            "day": day_state,
            "night": night_state,
        },
        "phase_hours": {
            "day": day_hours,
            "night": night_hours,
        },
    }
