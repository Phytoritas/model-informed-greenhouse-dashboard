"""CSV data ingestion service with real-time tailing capability."""
import logging
from pathlib import Path
import time
from typing import Any, Callable, Dict

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class CSVIngestor:
    """Watches and ingests CSV files with quality checks."""
    
    def __init__(self, 
                 csv_path: str,
                 callback: Callable[[Dict[str, Any]], None],
                 quality_check: bool = True):
        """Initialize CSV ingestor.
        
        Args:
            csv_path: Path to CSV file to watch
            callback: Function to call with each parsed row
            quality_check: Enable data quality validation
        """
        self.csv_path = Path(csv_path)
        self.callback = callback
        self.quality_check = quality_check
        self.last_position = 0
        self.last_row = None  # For gap filling
        
        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_path}")
        
        logger.info(f"Initialized CSVIngestor for {csv_path}")
    
    def start(self):
        """Start ingestion (blocking call for real-time mode)."""
        logger.info("Starting CSV ingestion...")
        
        # Read entire file first
        df = pd.read_csv(self.csv_path)
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        logger.info(f"Loaded {len(df)} rows from {self.csv_path}")
        
        # Process all rows
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            
            # Quality check
            if self.quality_check:
                row_dict = self._validate_and_clean(row_dict)
            
            # Emit via callback
            self.callback(row_dict)
            self.last_row = row_dict
        
        logger.info("CSV ingestion completed")
    
    def start_streaming(self, interval_ms: int = 1000):
        """Start streaming ingestion at specified interval.
        
        Args:
            interval_ms: Interval between rows in milliseconds
        """
        logger.info(f"Starting streaming ingestion (interval={interval_ms}ms)...")
        
        df = pd.read_csv(self.csv_path)
        df['datetime'] = pd.to_datetime(df['datetime'])
        
        for idx, row in df.iterrows():
            row_dict = row.to_dict()
            
            # Quality check
            if self.quality_check:
                row_dict = self._validate_and_clean(row_dict)
            
            # Emit via callback
            self.callback(row_dict)
            self.last_row = row_dict
            
            # Sleep to simulate real-time
            time.sleep(interval_ms / 1000.0)
            
            if idx % 100 == 0:
                logger.debug(f"Streamed {idx+1} rows...")
        
        logger.info("Streaming ingestion completed")
    
    def _validate_and_clean(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and clean a data row.
        
        Performs:
        - NaN/inf checking
        - Range clipping
        - Missing value imputation
        """
        cleaned = row.copy()
        
        # Define valid ranges
        ranges = {
            'T_air_C': (-20, 50, 20),  # (min, max, default)
            'PAR_umol': (0, 3000, 0),
            'CO2_ppm': (300, 2000, 400),
            'RH_percent': (0, 100, 50),
            'wind_speed_ms': (0, 10, 0.3),
        }
        
        for key, (min_val, max_val, default) in ranges.items():
            if key in cleaned:
                val = cleaned[key]
                
                # Check for NaN/inf
                if not np.isfinite(val):
                    logger.warning(f"Invalid value {val} for {key} at {row.get('datetime')}, using default {default}")
                    cleaned[key] = default
                    continue
                
                # Clip to range
                if val < min_val or val > max_val:
                    logger.warning(f"Out-of-range value {val} for {key}, clipping to [{min_val}, {max_val}]")
                    cleaned[key] = np.clip(val, min_val, max_val)
        
        return cleaned


class BatchIngestor:
    """Ingests CSV data in batch mode (no streaming)."""
    
    def __init__(self, csv_path: str, quality_check: bool = True):
        """Initialize batch ingestor.
        
        Args:
            csv_path: Path to CSV file
            quality_check: Enable data quality validation
        """
        self.csv_path = Path(csv_path)
        self.quality_check = quality_check
        
        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    def load(self) -> pd.DataFrame:
        """Load entire CSV into DataFrame.
        
        Returns:
            DataFrame with validated and cleaned data
        """
        logger.info(f"Loading CSV from {self.csv_path}...")
        
        df = pd.read_csv(self.csv_path)
        df['datetime'] = pd.to_datetime(df['datetime'])
        df = df.sort_values('datetime').reset_index(drop=True)
        
        if self.quality_check:
            df = self._validate_dataframe(df)
        
        logger.info(f"Loaded {len(df)} rows")
        return df
    
    def _validate_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate and clean entire dataframe."""
        df = df.copy()
        
        # Define valid ranges
        ranges = {
            'T_air_C': (-20, 50, 20),
            'PAR_umol': (0, 3000, 0),
            'CO2_ppm': (300, 2000, 400),
            'RH_percent': (0, 100, 50),
            'wind_speed_ms': (0, 10, 0.3),
        }
        
        for key, (min_val, max_val, default) in ranges.items():
            if key in df.columns:
                # Replace NaN/inf with default
                invalid_mask = ~np.isfinite(df[key])
                if invalid_mask.any():
                    logger.warning(f"Found {invalid_mask.sum()} invalid values in {key}, replacing with {default}")
                    df.loc[invalid_mask, key] = default
                
                # Clip to range
                df[key] = df[key].clip(min_val, max_val)
        
        return df

