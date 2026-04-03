"""7-day branch forecast service using parallel execution."""
import logging
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Any, Callable, Dict, List, Optional

import pandas as pd

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
        
        # Restore state
        adapter.load_state(adapter_state)
        adapter.configure(adapter_config)
        worker_logger.info("✅ State restored and configured")
        
        # Sample rows to reduce computation time for forecast
        # For 10-min data: skip=6 -> hourly, skip=36 -> every 6 hours
        sampled_rows = rows[::forecast_step_interval]
        worker_logger.info(f"Forecast: Sampled {len(sampled_rows)} rows from {len(rows)} (interval={forecast_step_interval})")
    except Exception as e:
        worker_logger.error(f"❌ Forecast worker initialization error: {e}", exc_info=True)
        raise
    
    # Run batch simulation on sampled data
    results = adapter.run_batch(sampled_rows)
    
    # Convert to DataFrame for aggregation
    df = pd.DataFrame(results)
    if len(df) == 0:
        return {'daily': [], 'last': {}, 'total_harvest_kg': 0, 'total_energy_kWh': 0, 'total_ETc_mm': 0}
    
    df['datetime'] = pd.to_datetime(df['datetime'])
    df['date'] = df['datetime'].dt.date
    
    # Daily aggregation
    if adapter_class_name == 'tomato':
        initial_harvest = float(df['harvested_fruit_g_m2'].iloc[0]) if 'harvested_fruit_g_m2' in df else 0.0
        initial_fruit_dw = float(df['fruit_dry_weight_g_m2'].iloc[0]) if 'fruit_dry_weight_g_m2' in df else 0.0
        
        daily = df.groupby('date').agg({
            'harvested_fruit_g_m2': 'max',  # Cumulative, take max
            'fruit_dry_weight_g_m2': 'max',
            'transpiration_g_m2': 'sum',
            'LAI': 'mean',
            'active_trusses': 'mean',
            'T_air_C': ['max', 'min'],
            'PAR_umol': 'sum'
        }).reset_index()
        
        # Flatten MultiIndex columns
        daily.columns = ['date', 'harvested_fruit_g_m2', 'fruit_dry_weight_g_m2', 'transpiration_g_m2', 'LAI', 'active_trusses', 'T_air_max', 'T_air_min', 'PAR_total']
        
        # Calculate daily deltas for harvest
        daily['harvest_g_m2'] = daily['harvested_fruit_g_m2'].diff().fillna(daily['harvested_fruit_g_m2'] - initial_harvest)
        daily['harvest_kg'] = (daily['harvest_g_m2'] * area_m2) / 1000
        
        # Fallback: use fruit dry weight growth if harvest stays flat
        if float(daily['harvest_kg'].abs().sum()) < 1e-6:
            logger.info("Forecast fallback: using fruit dry weight growth for harvest projection (tomato)")
            daily['harvest_g_m2'] = daily['fruit_dry_weight_g_m2'].diff().fillna(daily['fruit_dry_weight_g_m2'] - initial_fruit_dw)
            daily['harvest_kg'] = (daily['harvest_g_m2'] * area_m2) / 1000
    else:  # cucumber
        initial_fruit_dw = float(df['fruit_dry_weight_g_m2'].iloc[0]) if 'fruit_dry_weight_g_m2' in df else 0.0
        
        daily = df.groupby('date').agg({
            'fruit_dry_weight_g_m2': 'max',
            'transpiration_g_m2': 'sum',
            'LAI': 'mean',
            'node_count': 'mean',
            'T_air_C': ['max', 'min'],
            'PAR_umol': 'sum'
        }).reset_index()
        
        # Flatten MultiIndex columns
        daily.columns = ['date', 'fruit_dry_weight_g_m2', 'transpiration_g_m2', 'LAI', 'node_count', 'T_air_max', 'T_air_min', 'PAR_total']
        
        daily['harvest_g_m2'] = daily['fruit_dry_weight_g_m2'].diff().fillna(daily['fruit_dry_weight_g_m2'] - initial_fruit_dw)
        daily['harvest_kg'] = (daily['harvest_g_m2'] * area_m2) / 1000
    
    # Ensure no negative values due to numerical noise
    daily['harvest_g_m2'] = daily['harvest_g_m2'].clip(lower=0)
    daily['harvest_kg'] = daily['harvest_kg'].clip(lower=0)
    
    # ETc in mm
    daily['ETc_mm'] = daily['transpiration_g_m2'] / 1000
    
    # Simple energy estimate (placeholder - will be refined by energy service)
    daily['energy_kWh'] = 0.0  # TODO: integrate with energy estimator
    
    # Totals
    total_harvest_kg = float(daily['harvest_kg'].sum())
    total_ETc_mm = float(daily['ETc_mm'].sum())
    total_energy_kWh = float(daily['energy_kWh'].sum())
    
    # Convert to dict
    daily_dict = daily.to_dict(orient='records')
    for d in daily_dict:
        d['date'] = str(d['date'])  # Serialize date
    
    snapshot = {
        'daily': daily_dict,
        'last': results[-1] if results else {},
        'total_harvest_kg': total_harvest_kg,
        'total_energy_kWh': total_energy_kWh,
        'total_ETc_mm': total_ETc_mm,
    }
    
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
        if fut.cancelled():
            logger.info("Forecast run was cancelled")
            return
        
        try:
            snapshot = fut.result()
            payload = {
                'type': 'forecast.snapshot',
                **snapshot
            }
            logger.info(f"✅ Forecast completed: {snapshot.get('total_harvest_kg', 0):.2f} kg harvest, "
                       f"{snapshot.get('total_ETc_mm', 0):.2f} mm ETc, "
                       f"{len(snapshot.get('daily', []))} days")
            
            logger.info(f"Broadcasting forecast to /ws/forecast with {len(payload.get('daily', []))} daily entries")
            self.broadcast('/ws/forecast', payload)
            logger.info("Forecast broadcast complete")
            
        except Exception as e:
            logger.error(f"❌ Forecast error: {e}", exc_info=True)
            self.broadcast('/ws/forecast', {
                'type': 'forecast.error',
                'message': str(e)
            })

