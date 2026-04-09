"""Small numerical helpers that avoid hard runtime dependence on SciPy."""

from __future__ import annotations

from dataclasses import dataclass
from itertools import product
from math import isfinite
from typing import Callable, Sequence


@dataclass(frozen=True)
class ScalarRootResult:
    root: float
    success: bool
    iterations: int
    message: str


@dataclass(frozen=True)
class BoundedMinimizeResult:
    x: list[float]
    success: bool
    message: str
    fun: float
    iterations: int


def _as_float(value: float | Sequence[float]) -> float:
    if isinstance(value, (list, tuple)):
        if not value:
            raise ValueError("Cannot convert empty sequence to float.")
        return float(value[0])
    try:
        return float(value[0])  # type: ignore[index]
    except Exception:
        return float(value)


def solve_scalar_root(
    func: Callable[[float], float],
    initial_guess: float,
    *,
    lower_bound: float | None = None,
    upper_bound: float | None = None,
    tolerance: float = 1e-4,
    max_iter: int = 80,
) -> ScalarRootResult:
    """Solve a scalar root with bracket expansion and bisection fallback."""

    center = float(initial_guess)
    lower = float(lower_bound) if lower_bound is not None else center - 20.0
    upper = float(upper_bound) if upper_bound is not None else center + 20.0

    def _evaluate(x_value: float) -> float:
        return float(_as_float(func(float(x_value))))

    f_lower = _evaluate(lower)
    f_upper = _evaluate(upper)
    iterations = 0

    for _ in range(8):
        if isfinite(f_lower) and isfinite(f_upper) and f_lower == 0.0:
            return ScalarRootResult(lower, True, iterations, "lower-bound-root")
        if isfinite(f_lower) and isfinite(f_upper) and f_upper == 0.0:
            return ScalarRootResult(upper, True, iterations, "upper-bound-root")
        if isfinite(f_lower) and isfinite(f_upper) and f_lower * f_upper < 0.0:
            break
        span = max(2.0, (upper - lower) * 0.5)
        lower -= span
        upper += span
        f_lower = _evaluate(lower)
        f_upper = _evaluate(upper)
        iterations += 1

    if isfinite(f_lower) and isfinite(f_upper) and f_lower * f_upper < 0.0:
        lo = lower
        hi = upper
        flo = f_lower
        for inner_idx in range(max_iter):
            mid = (lo + hi) * 0.5
            f_mid = _evaluate(mid)
            iterations += 1
            if abs(f_mid) <= tolerance or abs(hi - lo) <= tolerance:
                return ScalarRootResult(mid, True, iterations + inner_idx, "bisection")
            if flo * f_mid <= 0.0:
                hi = mid
            else:
                lo = mid
                flo = f_mid
        return ScalarRootResult((lo + hi) * 0.5, True, iterations + max_iter, "bisection-max-iter")

    best_x = center
    best_residual = float("inf")
    sample_count = 41
    step = (upper - lower) / max(sample_count - 1, 1)
    for index in range(sample_count):
        x_value = lower + (step * index)
        residual = _evaluate(x_value)
        score = abs(residual)
        if isfinite(score) and score < best_residual:
            best_residual = score
            best_x = x_value
    return ScalarRootResult(
        best_x,
        best_residual <= max(tolerance * 10.0, 1e-2),
        iterations + sample_count,
        "best-residual-grid",
    )


def bounded_coordinate_minimize(
    objective: Callable[[list[float]], float],
    *,
    x0: Sequence[float],
    bounds: Sequence[tuple[float, float]],
    initial_fraction: float = 0.35,
    min_step: float = 0.02,
    max_iter: int = 120,
    coarse_points: int = 9,
) -> BoundedMinimizeResult:
    """Simple bounded coordinate search for small-dimensional objectives."""

    def _prefers_trial(
        trial_value: float,
        best_value: float,
        trial_vector: Sequence[float],
        best_vector: Sequence[float],
    ) -> bool:
        if trial_value < best_value - 1e-9:
            return True
        if abs(trial_value - best_value) <= 1e-6:
            return sum(trial_vector) < sum(best_vector)
        return False

    current = [
        min(max(float(value), float(lower)), float(upper))
        for value, (lower, upper) in zip(x0, bounds, strict=True)
    ]
    current_value = float(objective(list(current)))

    if bounds and coarse_points >= 3:
        axis_samples: list[list[float]] = []
        for lower, upper in bounds:
            lower_f = float(lower)
            upper_f = float(upper)
            if upper_f <= lower_f:
                axis_samples.append([lower_f])
                continue
            step = (upper_f - lower_f) / float(coarse_points - 1)
            axis_samples.append([lower_f + (step * idx) for idx in range(coarse_points)])
        for vector in product(*axis_samples):
            trial = [float(value) for value in vector]
            trial_value = float(objective(trial))
            if _prefers_trial(trial_value, current_value, trial, current):
                current = trial
                current_value = trial_value

    steps = [
        max((float(upper) - float(lower)) * initial_fraction, min_step * 4.0)
        for lower, upper in bounds
    ]
    iterations = 0

    while iterations < max_iter and max(steps, default=0.0) >= min_step:
        improved = False
        for idx, (lower, upper) in enumerate(bounds):
            for direction in (-1.0, 1.0):
                trial = list(current)
                trial[idx] = min(
                    max(current[idx] + (steps[idx] * direction), float(lower)),
                    float(upper),
                )
                if trial[idx] == current[idx]:
                    continue
                trial_value = float(objective(trial))
                iterations += 1
                if _prefers_trial(trial_value, current_value, trial, current):
                    current = trial
                    current_value = trial_value
                    improved = True
        if not improved:
            steps = [step * 0.5 for step in steps]

    return BoundedMinimizeResult(
        x=[float(value) for value in current],
        success=isfinite(current_value),
        message="coordinate-search",
        fun=float(current_value),
        iterations=iterations,
    )
