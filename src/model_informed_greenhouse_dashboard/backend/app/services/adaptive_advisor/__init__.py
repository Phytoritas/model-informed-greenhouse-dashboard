"""Run-specific adaptive advisor graph.

The package adds a typed, bounded orchestration surface without replacing the landed
model, knowledge, admission, or narration contracts.
"""

from .change_detection import detect_material_change, fingerprint_snapshot
from .contracts import (
    AdaptiveAdvisorRequest,
    AdaptiveAdvisorResponse,
    AdaptiveGraphPlan,
    AdvisorQualityProfile,
    OperationsCalendar,
)
from .executor import execute_adaptive_advisor
from .planner import build_adaptive_plan

__all__ = [
    "AdaptiveAdvisorRequest",
    "AdaptiveAdvisorResponse",
    "AdaptiveGraphPlan",
    "AdvisorQualityProfile",
    "OperationsCalendar",
    "build_adaptive_plan",
    "detect_material_change",
    "execute_adaptive_advisor",
    "fingerprint_snapshot",
]
