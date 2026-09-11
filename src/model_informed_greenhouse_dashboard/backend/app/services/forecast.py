"""7-day branch forecast service using parallel execution."""
import logging
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Any, Callable, Dict, List, Optional

import pandas as pd

from ..adapters.base import environment_quality, finite_number, model_output_is_valid
from ..adapters.cucumber import CucumberAdapter
from ..adapters.tomato import TomatoAdapter

logger = logging.getLogger(__name__)

# Global executor (thread-based for better cross-platform behavior)
_executor = ThreadPoolExecutor(max_workers=2)  # Support 2 concurrent forecasts (tomato + cucumber)
_current_futures: Dict[str, Optional[Future]] = {"tomato": None, "cucumber": None}


def _branch_worker(adapter_class_name: str, 
                   adapter_state: Dict[str, Any],
                   adapter_config: Dict[str, Any],
                   rows: List[Dict[str, Any]],
                   area_m2: float,
                   forecast_step_interval: int = 6) -> Dict[str, Any]:
    """Worker function to run forecast in separate thread.
    
    Args:
        adapter_class_name: 'tomato' or 'cucumber'
        adapter_state: Serialized adapter state
        adapter_config: Adapter configuration
        rows: Future environmental data rows
        area_m2: Greenhouse area for scaling
        forecast_step_interval: Sample every N rows (default 6 = 1 hour for 10-min data)
    
    Returns:
        Forecast snapshot with daily aggregates
    """
    # Setup logging for worker thread
    worker_logger = logging.getLogger(f"forecast_worker_{adapter_class_name}")
    worker_logger.info(f"🚀 Forecast worker started for {adapter_class_name}")

    try:
        if adapter_class_name == "tomato":
            adapter = TomatoAdapter(area_m2=area_m2)
        else:
            adapter = CucumberAdapter(area_m2=area_m2)
        
        worker_logger.info(f"✅ Adapter created: {adapter_class_name}")
        
        # Preserve the branch origin; the first prediction already includes growth.
        meta = adapter_state.get("_adapter_meta", {})
        initial = meta.get("last_state") or {}
        initial_fruit = finite_number(initial.get(
            "fruit_dry_weight_g_m2",
            adapter_state.get("W_fr" if adapter_class_name == "tomato" else "fruit_dw"),
        ))
        initial_harvest = (
            finite_number(initial.get(
                "harvested_fruit_g_m2", adapter_state.get("W_fr_harvested")
            )) if adapter_class_name == "tomato" else 0.0
        )

        # Restore state
        adapter.load_state(adapter_state)
        adapter.configure(adapter_config)
        worker_logger.info("✅ State restored and configured")
        
        # Sample rows to reduce computation time for forecast
        # For 10-min data: skip=6 -> hourly, skip=36 -> every 6 hours
        if forecast_step_interval < 1:
            raise ValueError("forecast_step_interval must be positive")
        rows = sorted(rows, key=lambda row: pd.Timestamp(row["datetime"]))
        if meta.get("last_datetime"):
            origin = pd.Timestamp(meta["last_datetime"])
            rows = [row for row in rows if pd.Timestamp(row["datetime"]) > origin]
        input_issues = []
        for row in rows:
            for issue in environment_quality(row)["issues"]:
                if issue not in input_issues:
                    input_issues.append(issue)
        sampled_rows = [dict(row) for row in rows[::forecast_step_interval]]
        if sampled_rows and sampled_rows[-1]["datetime"] != rows[-1]["datetime"]:
            sampled_rows.append(dict(rows[-1]))
        if sampled_rows and not meta.get("last_datetime"):
            # Only needed for an unstarted adapter; running branches use timestamps.
            if len(rows) > 1:
                first_duration = (
                    pd.Timestamp(rows[1]["datetime"]) - pd.Timestamp(rows[0]["datetime"])
                ).total_seconds()
                sampled_rows[0].setdefault("dt_seconds", first_duration)
        worker_logger.info(f"Forecast: Sampled {len(sampled_rows)} rows from {len(rows)} (interval={forecast_step_interval})")
    except Exception as e:
        worker_logger.error(f"❌ Forecast worker initialization error: {e}", exc_info=True)
        raise
    
    # Run batch simulation on sampled data
    results = adapter.run_batch(sampled_rows)
    
    issues = list(input_issues)
    if initial and not model_output_is_valid(initial):
        issues.append({"field": "initial_state", "reason": "model_output_invalid"})
    if initial_fruit is None or initial_harvest is None:
        issues.append({"field": "initial_state", "reason": "dry_matter_baseline_missing"})
    if any(not model_output_is_valid(state) for state in results):
        issues.append({"field": "model", "reason": "model_output_invalid"})
    required = ["fruit_dry_weight_g_m2", "transpiration_g_m2", "LAI", "T_air_C", "PAR_umol"]
    if adapter_class_name == "tomato":
        required.append("harvested_fruit_g_m2")
    if any(finite_number(state.get(key)) is None for state in results for key in required):
        issues.append({"field": "model", "reason": "required_output_missing"})

    snapshot = {
        "daily": [],
        "last": results[-1] if results else {},
        "total_harvest_kg": None,
        "total_fruit_growth_dry_kg": None,
        "total_harvested_fruit_dry_kg": None,
        "total_energy_kWh": None,
        "total_ETc_mm": None,
        "harvest_basis": "fresh_mass_unavailable",
        "fruit_growth_basis": "dry_matter",
        "energy_basis": "not_estimated",
        "source": "model_prediction_from_csv_replay",
        "data_quality": {
            "status": "invalid" if issues else "ok",
            "source": "csv_replay",
            "issues": issues,
        },
    }
    if not results:
        return snapshot

    df = pd.DataFrame(results)
    df["datetime"] = pd.to_datetime(df["datetime"])
    df["date"] = df["datetime"].dt.date
    valid = not issues
    previous_total_dm = (
        initial_fruit + initial_harvest
        if initial_fruit is not None and initial_harvest is not None else None
    )
    previous_harvest_dm = initial_harvest
    for date, group in df.groupby("date", sort=True):
        last = group.iloc[-1]
        ending_fruit = finite_number(last.get("fruit_dry_weight_g_m2"))
        ending_harvest = (
            finite_number(last.get("harvested_fruit_g_m2"))
            if adapter_class_name == "tomato" else 0.0
        )
        growth_kg = None
        harvested_dry_kg = None
        if valid:
            # Adding harvested DM accounts for transfers out of standing fruit.
            ending_total_dm = ending_fruit + ending_harvest
            growth_kg = (ending_total_dm - previous_total_dm) * area_m2 / 1000.0
            if adapter_class_name == "tomato":
                harvested_dry_kg = (ending_harvest - previous_harvest_dm) * area_m2 / 1000.0
            previous_total_dm = ending_total_dm
            previous_harvest_dm = ending_harvest

        def aggregate(key: str, method: str) -> float | None:
            if key not in group:
                return None
            values = pd.to_numeric(group[key], errors="coerce")
            if any(finite_number(value) is None for value in values):
                return None
            return finite_number(getattr(values, method)())

        transpiration = aggregate("transpiration_g_m2", "sum") if valid else None
        daily = {
            "date": str(date),
            "harvest_kg": None,
            "fruit_growth_dry_kg": growth_kg,
            "harvested_fruit_dry_kg": harvested_dry_kg,
            "fruit_dry_weight_g_m2": ending_fruit,
            "transpiration_g_m2": transpiration,
            "ETc_mm": transpiration / 1000.0 if transpiration is not None else None,
            "energy_kWh": None,
            "LAI": aggregate("LAI", "mean") if valid else None,
            "T_air_max": aggregate("T_air_C", "max"),
            "T_air_min": aggregate("T_air_C", "min"),
            "PAR_total": aggregate("PAR_umol", "sum"),
        }
        crop_metric = "active_trusses" if adapter_class_name == "tomato" else "node_count"
        daily[crop_metric] = aggregate(crop_metric, "mean") if valid else None
        snapshot["daily"].append(daily)

    if valid:
        snapshot["total_fruit_growth_dry_kg"] = sum(day["fruit_growth_dry_kg"] for day in snapshot["daily"])
        snapshot["total_ETc_mm"] = sum(day["ETc_mm"] for day in snapshot["daily"])
        if adapter_class_name == "tomato":
            snapshot["total_harvested_fruit_dry_kg"] = sum(day["harvested_fruit_dry_kg"] for day in snapshot["daily"])
    return snapshot


class BranchForecaster:
    """Manages 7-day branch forecasting with cancel-and-replace."""
    
    def __init__(self,
                 broadcaster: Callable[[str, Dict[str, Any]], None],
                 area_m2: float = 3305.8,
                 window_days: int = 7,
                 forecast_step_interval: int = 6,
                 crop_name: str = "unknown"):
        """Initialize forecaster.
        
        Args:
            broadcaster: Function to broadcast forecast results
            area_m2: Greenhouse area
            window_days: Forecast window in days
            forecast_step_interval: Sample every N rows for forecast (6 = 1 hour for 10-min data)
            crop_name: Crop identifier for tracking separate futures
        """
        self.broadcast = broadcaster
        self.area_m2 = area_m2
        self.window_days = window_days
        self.forecast_step_interval = forecast_step_interval
        self.crop_name = crop_name
        logger.info(f"Initialized BranchForecaster for {crop_name} (window={window_days}d, area={area_m2}m², step_interval={forecast_step_interval})")
    
    def schedule(self, adapter, future_rows: List[Dict[str, Any]]):
        """Schedule a new forecast run (cancel previous if running).
        
        Args:
            adapter: Current adapter instance
            future_rows: List of future environment data dicts
        """
        global _current_futures
        
        # Cancel existing forecast for THIS crop if running
        if _current_futures.get(self.crop_name) and not _current_futures[self.crop_name].done():
            logger.info(f"Cancelling previous {self.crop_name} forecast run")
            _current_futures[self.crop_name].cancel()
        
        # Prepare arguments
        adapter_state = adapter.dump_state()
        adapter_config = {
            'area_m2': self.area_m2,
        }
        
        logger.info(f"🔮 Scheduling {self.crop_name} forecast for {len(future_rows)} rows (interval={self.forecast_step_interval})...")
        logger.info(f"   Adapter: {adapter.name}, Area: {self.area_m2}m², Window: {self.window_days}days")
        
        if len(future_rows) == 0:
            logger.warning(f"❌ No future rows provided for {self.crop_name} forecast!")
            return
        
        # Submit to thread pool
        try:
            _current_futures[self.crop_name] = _executor.submit(
                _branch_worker,
                adapter.name,
                adapter_state,
                adapter_config,
                future_rows,
                self.area_m2,
                self.forecast_step_interval
            )
            _current_futures[self.crop_name].add_done_callback(self._on_done)
            logger.info(f"✅ {self.crop_name} forecast submitted to executor")
        except Exception as e:
            logger.error(f"❌ Failed to submit {self.crop_name} forecast: {e}", exc_info=True)
    
    def _on_done(self, fut: Future):
        """Callback when forecast completes."""
        current = _current_futures.get(self.crop_name)
        if current is not None and current is not fut:
            return
        if fut.cancelled():
            logger.info("Forecast run was cancelled")
            return
        
        try:
            snapshot = fut.result()
            payload = {
                'type': 'forecast.snapshot',
                **snapshot
            }
            logger.info(
                "Forecast completed: fruit growth=%s kg dry matter, ETc=%s mm, %s days",
                snapshot.get("total_fruit_growth_dry_kg"),
                snapshot.get("total_ETc_mm"),
                len(snapshot.get("daily", [])),
            )
            
            logger.info(f"Broadcasting forecast to /ws/forecast with {len(payload.get('daily', []))} daily entries")
            self.broadcast('/ws/forecast', payload)
            logger.info("Forecast broadcast complete")
            
        except Exception as e:
            logger.error(f"❌ Forecast error: {e}", exc_info=True)
            self.broadcast('/ws/forecast', {
                'type': 'forecast.error',
                'message': str(e)
            })

