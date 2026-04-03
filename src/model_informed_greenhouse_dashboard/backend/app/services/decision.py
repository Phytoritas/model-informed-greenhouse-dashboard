"""Decision support system for crop management."""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class DecisionSupport:
    """Provides recommendations for crop management based on current state."""
    
    def __init__(self, crop_type: str):
        """Initialize decision support system.
        
        Args:
            crop_type: 'tomato' or 'cucumber'
        """
        self.crop_type = crop_type
        self._start_dt: datetime | None = None
        # Hide certain growth-related advisories for the first N days (early establishment)
        self._initial_grace_days: int = 30
        self.settings = {
            "price_per_kg": 3000,
            "cost_per_kwh": 120
        }
    
    def update_settings(self, new_settings: Dict[str, Any]):
        """Update financial settings."""
        self.settings.update(new_settings)
    
    def get_recommendations(self, kpi: Dict[str, Any], state: Dict[str, Any], 
                           irrigation: Dict[str, Any], energy: Dict[str, Any],
                           env: Optional[Dict[str, Any]] = None,
                           forecast_data: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Generate recommendations based on current state.
        
        Returns:
            List of recommendations with priority, category, and message
        """
        recommendations = []
        
        # Track start time from first state
        try:
            current_dt = datetime.fromisoformat(str(state.get("datetime")))
        except Exception:
            current_dt = None
        if current_dt and self._start_dt is None:
            self._start_dt = current_dt
        days_since_start = (current_dt - self._start_dt).days if (current_dt and self._start_dt) else 0
        
        # Determine night condition (prefer PAR; fallback to local time window)
        is_night = False
        try:
            if env is not None:
                par = float(env.get("PAR_umol", 0))
                is_night = par <= 5.0
            if not is_night and current_dt:
                hour = current_dt.hour
                is_night = hour < 6 or hour >= 20
        except Exception:
            is_night = False

        if self.crop_type == "tomato":
            recommendations.extend(self._tomato_recommendations(kpi, state, irrigation, energy, days_since_start, is_night))
        elif self.crop_type == "cucumber":
            recommendations.extend(self._cucumber_recommendations(kpi, state, irrigation, energy, days_since_start))
        
        # Physiological recommendations (VPD & Stress)
        if env:
            t_air = float(env.get("T_air_C", 20))
            rh = float(env.get("RH_percent", 70))
            es = 0.6108 * 2.71828 ** ((17.27 * t_air) / (t_air + 237.3))
            ea = es * (rh / 100.0)
            vpd = es - ea
            
            if vpd < 0.3:
                recommendations.append({
                    "priority": "high",
                    "category": "environment",
                    "icon": "💧",
                    "title": "VPD 매우 낮음",
                    "message": f"VPD {vpd:.2f}kPa - 증산 억제 우려 (제습 필요)",
                    "action": "dehumidify"
                })
            elif vpd > 1.5:
                recommendations.append({
                    "priority": "high",
                    "category": "environment",
                    "icon": "🔥",
                    "title": "VPD 매우 높음",
                    "message": f"VPD {vpd:.2f}kPa - 수분 스트레스 우려 (가습/차광 필요)",
                    "action": "humidify"
                })
            
            stress_score = 0
            if t_air > 30:
                stress_score += (t_air - 30) * 10
            if t_air < 12:
                stress_score += (12 - t_air) * 10
            
            if stress_score >= 20:
                recommendations.append({
                    "priority": "high",
                    "category": "health",
                    "icon": "🤒",
                    "title": "환경 스트레스 경고",
                    "message": f"스트레스 지수 {stress_score:.1f} - 온도 관리 시급",
                    "action": "check_temperature"
                })

        # Forecast-based recommendations (Proactive)
        if forecast_data and 'daily' in forecast_data:
            # Check tomorrow's forecast (index 0 is today/tomorrow depending on time, let's look at next available day)
            # For simplicity, check max temp of the first forecast day
            if len(forecast_data['daily']) > 0:
                tomorrow = forecast_data['daily'][0]
                t_max = tomorrow.get('T_air_max', 0)
                if t_max > 32:
                    recommendations.append({
                        "priority": "medium",
                        "category": "forecast",
                        "icon": "☀️",
                        "title": "고온 예보",
                        "message": f"예상 최고 기온 {t_max:.1f}°C - 차광/환기 준비",
                        "action": "prepare_cooling"
                    })

        # Managerial recommendations (Financials)
        PRICE_PER_KG = self.settings.get("price_per_kg", 3000)
        COST_PER_KWH = self.settings.get("cost_per_kwh", 120)
        daily_harvest = kpi.get("daily_harvest_kg", 0)
        daily_energy = energy.get("daily_kWh", 0)
        est_revenue = daily_harvest * PRICE_PER_KG
        est_cost = daily_energy * COST_PER_KWH
        est_profit = est_revenue - est_cost
        
        recommendations.append({
            "priority": "low",
            "category": "financial",
            "icon": "💰",
            "title": "일일 경영 분석",
            "message": f"수익: {est_revenue:,.0f}원 | 비용: {est_cost:,.0f}원 | 이익: {est_profit:,.0f}원",
            "action": "view_report"
        })
        
        # Sort by priority (high, medium, low)
        priority_order = {"high": 0, "medium": 1, "low": 2}
        recommendations.sort(key=lambda x: priority_order.get(x["priority"], 3))
        
        return recommendations
    
    def _tomato_recommendations(self, kpi: Dict, state: Dict, irrigation: Dict, energy: Dict, 
                                days_since_start: int = 0, is_night: bool = False) -> List[Dict]:
        """Generate tomato-specific recommendations."""
        recs = []
        
        # Harvest recommendations
        daily_harvest = kpi.get("daily_harvest_kg", 0)
        if daily_harvest > 0.5:
            recs.append({
                "priority": "high",
                "category": "harvest",
                "icon": "🍅",
                "title": "수확 적기",
                "message": f"금일 수확량 {daily_harvest:.2f}kg - 수확을 진행하세요",
                "action": "harvest_now"
            })
        elif daily_harvest > 0:
            recs.append({
                "priority": "medium",
                "category": "harvest",
                "icon": "🍅",
                "title": "소량 수확 가능",
                "message": f"소량 수확 가능 ({daily_harvest:.3f}kg)",
                "action": "monitor"
            })
        
        # Crop efficiency recommendations
        epsilon = kpi.get("epsilon", 0)
        n_fruits = state.get("n_fruits_per_truss", 4)
        
        if epsilon > 3.5:
            if n_fruits < 6:
                recs.append({
                    "priority": "medium",
                    "category": "efficiency",
                    "icon": "⚡",
                    "title": "작물 효율 우수",
                    "message": f"ε={epsilon:.2f} - 화방당 과실수를 {n_fruits+1}개로 증가 권장",
                    "action": "increase_fruits"
                })
        elif epsilon < 2.0 and not is_night:
            if n_fruits > 3:
                recs.append({
                    "priority": "high",
                    "category": "efficiency",
                    "icon": "⚠️",
                    "title": "작물 효율 저하",
                    "message": f"ε={epsilon:.2f} - 화방당 과실수를 {n_fruits-1}개로 감소 권장",
                    "action": "decrease_fruits"
                })
        
        # Truss management
        active_trusses = kpi.get("active_trusses", 0)
        
        # During early establishment, skip "active truss shortage" messages
        if active_trusses < 3 and days_since_start >= self._initial_grace_days:
            recs.append({
                "priority": "high",
                "category": "growth",
                "icon": "🌱",
                "title": "활성 트러스 부족",
                "message": f"활성 트러스 {active_trusses}개 - 환경 조건 점검 필요",
                "action": "check_environment"
            })
        elif active_trusses > 8:
            recs.append({
                "priority": "medium",
                "category": "growth",
                "icon": "✂️",
                "title": "과다 착과",
                "message": f"활성 트러스 {active_trusses}개 - 적과 검토",
                "action": "consider_pruning"
            })
        
        # Irrigation recommendations
        etc_mm = irrigation.get("ETc_mm_day", 0)
        if etc_mm > 5.0:
            recs.append({
                "priority": "high",
                "category": "irrigation",
                "icon": "💧",
                "title": "높은 증산량",
                "message": f"ETc {etc_mm:.1f}mm - 급액 모니터링 강화",
                "action": "monitor_irrigation"
            })
        # Skip "low ETc" warnings during early stage; hydrological response is typically small
        elif etc_mm < 1.0 and days_since_start >= self._initial_grace_days:
            recs.append({
                "priority": "medium",
                "category": "irrigation",
                "icon": "💧",
                "title": "낮은 증산량",
                "message": f"ETc {etc_mm:.1f}mm - 환경 조건 확인",
                "action": "check_climate"
            })
        
        # Energy recommendations
        daily_kwh = energy.get("daily_kWh", 0)
        if daily_kwh > 150:
            recs.append({
                "priority": "medium",
                "category": "energy",
                "icon": "⚡",
                "title": "높은 에너지 소비",
                "message": f"{daily_kwh:.0f}kWh - 에너지 절감 검토",
                "action": "review_energy"
            })
        
        return recs
    
    def _cucumber_recommendations(self, kpi: Dict, state: Dict, irrigation: Dict, energy: Dict, days_since_start: int = 0) -> List[Dict]:
        """Generate cucumber-specific recommendations."""
        recs = []
        
        # Leaf management
        leaf_count = kpi.get("leaf_count", 0)
        target_leaf = kpi.get("target_leaf_count", 15)
        pruning_threshold = kpi.get("pruning_threshold", 18)
        
        if leaf_count > target_leaf + 3:
            recs.append({
                "priority": "high",
                "category": "pruning",
                "icon": "✂️",
                "title": "적엽 필요",
                "message": f"현재 엽수 {leaf_count}장 (목표: {target_leaf}장) - 적엽 진행",
                "action": "prune_leaves"
            })
        elif leaf_count < target_leaf - 3 and days_since_start >= 30:
            recs.append({
                "priority": "medium",
                "category": "pruning",
                "icon": "🌿",
                "title": "엽수 부족",
                "message": f"현재 엽수 {leaf_count}장 (목표: {target_leaf}장) - 적엽 중단",
                "action": "stop_pruning"
            })
        
        # LAI recommendations
        lai = kpi.get("LAI", 0)
        if lai > 4.0:
            recs.append({
                "priority": "medium",
                "category": "growth",
                "icon": "🌿",
                "title": "과다 엽면적",
                "message": f"LAI {lai:.1f} - 통풍 및 광 투과 확인",
                "action": "check_ventilation"
            })
        elif lai < 1.5 and days_since_start >= 30:
            recs.append({
                "priority": "high",
                "category": "growth",
                "icon": "⚠️",
                "title": "엽면적 부족",
                "message": f"LAI {lai:.1f} - 생장 환경 점검 필요",
                "action": "check_environment"
            })
        
        # Node development
        node_count = kpi.get("node_count", 0)
        if node_count < pruning_threshold:
            recs.append({
                "priority": "low",
                "category": "growth",
                "icon": "🌱",
                "title": "초기 생장 단계",
                "message": f"노드 {node_count}개 - 생장 모니터링",
                "action": "monitor_growth"
            })
        
        # Fruit growth
        daily_growth = kpi.get("daily_fruit_growth_g_m2", 0)
        if daily_growth > 20:
            recs.append({
                "priority": "medium",
                "category": "growth",
                "icon": "🥒",
                "title": "활발한 과실 성장",
                "message": f"일일 성장 {daily_growth:.1f}g/m² - 영양 관리 유지",
                "action": "maintain_nutrition"
            })
        elif daily_growth < 5 and node_count > pruning_threshold:
            recs.append({
                "priority": "high",
                "category": "growth",
                "icon": "⚠️",
                "title": "과실 성장 저하",
                "message": f"일일 성장 {daily_growth:.1f}g/m² - 영양 상태 점검",
                "action": "check_nutrition"
            })
        
        # Irrigation recommendations
        etc_mm = irrigation.get("ETc_mm_day", 0)
        if etc_mm > 6.0:
            recs.append({
                "priority": "high",
                "category": "irrigation",
                "icon": "💧",
                "title": "높은 증산량",
                "message": f"ETc {etc_mm:.1f}mm - 급액량 증가 검토",
                "action": "increase_irrigation"
            })
        
        return recs

