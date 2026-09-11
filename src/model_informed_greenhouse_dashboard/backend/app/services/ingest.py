"""CSV data ingestion service with real-time tailing capability."""
import logging
from pathlib import Path
import time
from typing import Any, Callable, Dict

import pandas as pd

from ..adapters.base import ENVIRONMENT_RANGES, environment_quality, finite_number

logger = logging.getLogger(__name__)


class EnvironmentInputError(ValueError):
    """Environment rows cannot form an unambiguous replay timeline."""


def normalize_environment_frame(df: pd.DataFrame) -> pd.DataFrame:
    """Sort replay inputs and remove only identical rows at the same timestamp."""
    normalized = df.copy()
    if "datetime" not in normalized.columns:
        raise EnvironmentInputError("Environment data requires a datetime column")
    try:
        normalized["datetime"] = pd.to_datetime(normalized["datetime"])
    except (TypeError, ValueError, OverflowError) as exc:
        raise EnvironmentInputError("Environment datetime values must be valid timestamps") from exc
    if normalized["datetime"].isna().any():
        raise EnvironmentInputError("Environment datetime values must not be missing")

    normalized = normalized.sort_values("datetime", kind="stable").reset_index(drop=True)
    duplicates = normalized["datetime"].duplicated(keep=False)
    for timestamp, group in normalized.loc[duplicates].groupby("datetime", sort=False):
        first = group.iloc[0]
        # Include optional inputs and quality provenance: neither may be discarded
        # just because the five required environment channels happen to agree.
        if any(not first.equals(group.iloc[i]) for i in range(1, len(group))):
            raise EnvironmentInputError(
                f"Conflicting environment rows at duplicate timestamp {timestamp.isoformat()}"
            )

    repeated = normalized["datetime"].duplicated(keep="first")
    removed = int(repeated.sum())
    normalized = normalized.loc[~repeated].reset_index(drop=True)
    normalized.attrs["deduplicated_rows"] = df.attrs.get("deduplicated_rows", 0) + removed
    if removed:
        logger.info("Removed %s identical rows with repeated environment timestamps", removed)
    return normalized


def _clean_environment_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare numeric replay inputs while retaining their quality provenance."""
    cleaned = row.copy()
    cleaned["data_quality"] = environment_quality(row)
    for key, (minimum, maximum, default) in ENVIRONMENT_RANGES.items():
        value = finite_number(row.get(key))
        cleaned[key] = default if value is None else min(maximum, max(minimum, value))
    return cleaned


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
        df = normalize_environment_frame(pd.read_csv(self.csv_path))
        
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
        
        df = normalize_environment_frame(pd.read_csv(self.csv_path))
        
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
        return _clean_environment_row(row)


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
        
        df = normalize_environment_frame(pd.read_csv(self.csv_path))
        
        if self.quality_check:
            df = self._validate_dataframe(df)
        
        logger.info(f"Loaded {len(df)} rows")
        return df
    
    def _validate_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate and clean entire dataframe."""
        if df.empty:
            return df.copy()
        cleaned = pd.DataFrame(
            [_clean_environment_row(row) for row in df.to_dict("records")],
            index=df.index,
        )
        cleaned.attrs.update(df.attrs)
        return cleaned

