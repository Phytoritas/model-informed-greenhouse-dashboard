"""Diagnostic recommendations for crop-model replay, not physical control."""

from datetime import datetime
from typing import Any, Dict, List, Optional

from ..adapters.base import environment_quality, finite_number, model_output_is_valid


def _recommendation(
    priority: str,
    category: str,
    icon: str,
    title: str,
    message: str,
    action: str,
    reason: str,
    expected_response: str,
    *,
    source: str = "model_prediction_rule",
    check_after: str = "다음 시뮬레이션 구간",
) -> Dict[str, Any]:
    return {
        "priority": priority,
        "category": category,
        "icon": icon,
        "title": title,
        "message": message,
        "action": action,
        "reason": reason,
        "check_after": check_after,
        "expected_response": expected_response,
        "source": source,
    }


class DecisionSupport:
    """Apply existing demo thresholds as review prompts with explicit evidence."""

    def __init__(self, crop_type: str):
        self.crop_type = crop_type
        self._start_dt: datetime | None = None
        self._initial_grace_days = 30
        self.settings = {"price_per_kg": 3000, "cost_per_kwh": 120}

    def update_settings(self, new_settings: Dict[str, Any]):
        self.settings.update(new_settings)

    def get_recommendations(
        self,
        kpi: Dict[str, Any],
        state: Dict[str, Any],
        irrigation: Dict[str, Any],
        energy: Dict[str, Any],
        env: Optional[Dict[str, Any]] = None,
        forecast_data: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        kpi, state = kpi or {}, state or {}
        irrigation, energy = irrigation or {}, energy or {}
        inputs = {**state, **(env or {})}
        quality = environment_quality(inputs)
        state_quality = state.get("data_quality") or {}
        duration = finite_number(state.get("dt_seconds"))
        missing_output = any(
            finite_number(state.get(key)) is None for key in ("LAI", "T_canopy_C")
        )
        try:
            current_dt = datetime.fromisoformat(str(state.get("datetime")))
        except (TypeError, ValueError):
            current_dt = None
        invalid_kpi = any(
            finite_number(value) is None
            for value in kpi.values()
            if isinstance(value, (int, float))
        )
        if (
            quality["status"] != "ok"
            or state_quality.get("status", "ok") != "ok"
            or not model_output_is_valid(state)
            or missing_output
            or current_dt is None
            or invalid_kpi
            or ("dt_seconds" in state and (duration is None or duration <= 0))
        ):
            fields = sorted({str(issue.get("field")) for issue in quality["issues"]})
            reason = (
                "입력 확인 필요: " + ", ".join(fields)
                if fields else "계산 수렴 여부 또는 모델 출력이 확인되지 않았습니다."
            )
            return [_recommendation(
                "high", "data_quality", "🔎", "입력과 계산 상태 확인",
                "CSV 입력값과 시각, 계산 성공 여부를 확인한 뒤 해당 구간을 다시 실행하세요.",
                "verify_inputs", reason,
                "유효한 입력과 수렴한 계산 결과가 확인되면 작물 점검 안내를 다시 평가합니다.",
                source="data_quality", check_after="입력 수정 후 해당 구간 재실행",
            )]

        days_since_start = 0
        if current_dt:
            if self._start_dt is None:
                self._start_dt = current_dt
            try:
                days_since_start = (current_dt - self._start_dt).days
            except TypeError:
                self._start_dt = current_dt
            if days_since_start < 0:
                self._start_dt = current_dt
                days_since_start = 0

        # Input PAR is the replay's light condition, including supplemental light.
        is_night = float(inputs["PAR_umol"]) <= 5.0
        recommendations = []
        t_air = float(inputs["T_air_C"])
        rh = float(inputs["RH_percent"])
        es = 0.6108 * 2.71828 ** ((17.27 * t_air) / (t_air + 237.3))
        vpd = es * (1 - rh / 100.0)
        if vpd < 0.3 or vpd > 1.5:
            low = vpd < 0.3
            recommendations.append(_recommendation(
                "high", "environment", "💧" if low else "🔥",
                "낮은 VPD 확인" if low else "높은 VPD 확인",
                "기온·습도 입력과 환기·제습 조건을 점검하세요." if low
                else "기온·습도 입력과 차광·급액 조건을 점검하세요.",
                "check_humidity",
                f"CSV 입력으로 계산한 VPD {vpd:.2f}kPa가 데모 점검 기준을 벗어났습니다.",
                "다음 입력의 VPD와 모델 증산량이 함께 어떻게 변하는지 비교합니다.",
                source="csv_replay_rule",
            ))
        if t_air >= 32 or t_air <= 10:
            recommendations.append(_recommendation(
                "high", "environment", "🌡️", "기온 조건 확인",
                "기온 입력과 난방·냉방 설정을 확인하세요.", "check_temperature",
                f"CSV 기온 {t_air:.1f}°C가 기존 온도 점검 기준을 벗어났습니다.",
                "다음 구간의 기온 입력과 계산된 군락 온도를 비교합니다.",
                source="csv_replay_rule",
            ))

        if self.crop_type == "tomato":
            recommendations.extend(self._tomato_recommendations(
                kpi, state, irrigation, energy, days_since_start, is_night
            ))
        elif self.crop_type == "cucumber":
            recommendations.extend(self._cucumber_recommendations(
                kpi, state, irrigation, energy, days_since_start
            ))

        if forecast_data and (forecast_data.get("data_quality") or {}).get("status", "ok") == "ok":
            daily = forecast_data.get("daily") or []
            t_max = finite_number(daily[0].get("T_air_max")) if daily else None
            if t_max is not None and t_max > 32:
                recommendations.append(_recommendation(
                    "medium", "forecast", "☀️", "후속 입력의 고온 구간 확인",
                    "예측에 사용된 CSV 기온과 냉방 설정을 확인하세요.", "review_forecast",
                    f"후속 CSV의 첫 예측일 최고 기온은 {t_max:.1f}°C입니다.",
                    "해당 입력 시각에 도달하면 현재 값과 예측 조건을 비교합니다.",
                    source="csv_replay_forecast", check_after="예측에 표시된 입력 시각",
                ))

        # Legacy harvest KPIs are dry matter; they cannot price fresh produce or
        # establish a harvest date. Financial settings remain API-compatible.
        if not recommendations:
            recommendations.append(_recommendation(
                "low", "monitoring", "🌱", "현재 조건 관찰",
                "현재 점검 규칙에서 우선 확인할 항목이 없습니다. 다음 구간과 비교하세요.",
                "monitor", "유효한 입력과 수렴한 모델 결과로 데모 점검 규칙을 평가했습니다.",
                "기온·VPD 입력과 모델 생장·증산 변화의 방향을 확인합니다.",
            ))
        order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda item: order[item["priority"]])
        return recommendations[:3]

    def _tomato_recommendations(
        self, kpi: Dict, state: Dict, irrigation: Dict, energy: Dict,
        days_since_start: int = 0, is_night: bool = False,
    ) -> List[Dict]:
        recs = []
        epsilon = finite_number(kpi.get("epsilon"))
        if epsilon is not None and not is_night and (epsilon < 2.0 or epsilon > 3.5):
            recs.append(_recommendation(
                "high" if epsilon < 2.0 else "medium", "efficiency", "🔎",
                "건물 생산 효율 추세 확인",
                "광 입력과 모델 건물 생산량의 추세를 확인하세요.", "check_growth_inputs",
                f"모델 ε={epsilon:.2f}gDM/MJ입니다. 하루 중 누계 비율이며 과실수 변경 근거는 아닙니다.",
                "같은 날 후속 구간에서 광 누계와 건물 생산량을 함께 비교합니다.",
            ))
        trusses = finite_number(kpi.get("active_trusses"))
        if trusses is not None and (
            trusses > 8 or (trusses < 3 and days_since_start >= self._initial_grace_days)
        ):
            recs.append(_recommendation(
                "high" if trusses < 3 else "medium", "growth", "🍅", "화방 상태 확인",
                "모델 화방수와 생육 단계 입력을 확인하세요.", "check_environment",
                f"활성 화방 {trusses:g}개가 기존 데모 점검 기준을 벗어났습니다.",
                "후속 구간의 활성 화방수와 과실 건물 변화량을 비교합니다.",
            ))
        etc = finite_number(irrigation.get("ETc_mm_day"))
        previous_etc = finite_number(kpi.get("previous_day_transpiration_mm"))
        if etc is not None and etc > 5.0:
            recs.append(_recommendation(
                "high", "irrigation", "💧", "증산 누계 확인",
                "모델 증산량과 급액·배액 입력을 확인하세요.", "monitor_irrigation",
                f"현재까지 모델 증산 누계는 {etc:.1f}mm입니다.",
                "다음 구간의 증산 증가량과 급액 기준을 비교합니다.",
            ))
        elif (
            previous_etc is not None and previous_etc < 1.0
            and days_since_start >= self._initial_grace_days
        ):
            recs.append(_recommendation(
                "medium", "irrigation", "💧", "전일 증산량 확인",
                "전일 광·습도 입력과 모델 증산 누계를 확인하세요.", "check_climate",
                f"전일 모델 증산량은 {previous_etc:.1f}mm입니다.",
                "하루가 끝나면 전일과 당일의 입력 및 증산 누계를 비교합니다.",
                check_after="다음 날짜 경계",
            ))
        daily_energy = finite_number(energy.get("daily_kWh"))
        if daily_energy is not None and daily_energy > 150:
            assumptions = " ".join(energy.get("assumptions") or [])
            recs.append(_recommendation(
                "medium", "energy", "⚡", "에너지 추정 조건 확인",
                "외기온 자료와 난방·냉방 설정을 확인하세요.", "review_energy",
                f"모델 에너지 누계 {daily_energy:.0f}kWh입니다. {assumptions}".strip(),
                "다음 구간의 열부하와 에너지 증가량을 확인합니다.",
                source="energy_model_estimate",
            ))
        return recs

    def _cucumber_recommendations(
        self, kpi: Dict, state: Dict, irrigation: Dict, energy: Dict,
        days_since_start: int = 0,
    ) -> List[Dict]:
        recs = []
        leaves = finite_number(kpi.get("leaf_count"))
        target = finite_number(kpi.get("target_leaf_count"))
        if leaves is not None and target is not None and (
            leaves > target + 3 or (leaves < target - 3 and days_since_start >= 30)
        ):
            recs.append(_recommendation(
                "high" if leaves > target else "medium", "pruning", "🌿", "엽수와 목표값 확인",
                "모델 엽수와 적엽 목표 설정을 비교하세요.", "review_leaf_count",
                f"모델 엽수 {leaves:g}장, 설정 목표 {target:g}장입니다.",
                "다음 생장 갱신에서 엽수와 LAI 변화가 설정과 일치하는지 확인합니다.",
                check_after="다음 날짜 경계",
            ))
        lai = finite_number(kpi.get("LAI"))
        if lai is not None and (lai > 4.0 or (lai < 1.5 and days_since_start >= 30)):
            recs.append(_recommendation(
                "medium" if lai > 4.0 else "high", "growth", "🌱", "엽면적과 환경 입력 확인",
                "모델 엽면적과 광·통풍 조건을 확인하세요.", "check_environment",
                f"모델 LAI {lai:.1f}가 기존 데모 점검 기준을 벗어났습니다.",
                "후속 구간의 LAI와 광 입력, 모델 광합성 변화를 비교합니다.",
            ))
        nodes = finite_number(kpi.get("node_count"))
        threshold = finite_number(kpi.get("pruning_threshold"))
        previous_growth = finite_number(kpi.get("previous_day_fruit_growth_g_m2"))
        if (
            previous_growth is not None and previous_growth < 5
            and nodes is not None and threshold is not None and nodes > threshold
        ):
            recs.append(_recommendation(
                "high", "growth", "🥒", "전일 과실 건물 증가량 확인",
                "전일 환경 입력과 모델 과실 건물 증가량을 비교하세요.", "check_growth_inputs",
                f"전일 과실 건물 증가량 {previous_growth:.1f}g/m²입니다. 생과 수확량을 뜻하지 않습니다.",
                "다음 날짜 경계에서 과실 건물 증가량과 일일 광 입력을 비교합니다.",
                check_after="다음 날짜 경계",
            ))
        etc = finite_number(irrigation.get("ETc_mm_day"))
        if etc is not None and etc > 6.0:
            recs.append(_recommendation(
                "high", "irrigation", "💧", "증산 누계 확인",
                "모델 증산량과 급액·배액 입력을 확인하세요.", "monitor_irrigation",
                f"현재까지 모델 증산 누계는 {etc:.1f}mm입니다.",
                "다음 구간의 증산 증가량과 급액 기준을 비교합니다.",
            ))
        return recs

