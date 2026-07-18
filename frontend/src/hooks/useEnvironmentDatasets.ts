import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../config';

export interface EnvironmentDataset {
  name: string;
  kind: 'bundled' | 'uploaded';
  rows: number | null;
  start: string | null;
  end: string | null;
  size_bytes: number | null;
  uploaded_at: string | null;
}

interface DatasetListPayload {
  status: string;
  required_columns: string[];
  datasets: EnvironmentDataset[];
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error((data as { detail?: string })?.detail ?? `HTTP ${response.status}`);
  }
  return data as T;
}

/**
 * Lists environment datasets and lets the user insert their own so the simulation can
 * run on data other than the two bundled fixtures. Upload sends the CSV as the raw
 * request body to POST /api/datasets?filename=..., matching the backend contract.
 */
export const useEnvironmentDatasets = () => {
  const [datasets, setDatasets] = useState<EnvironmentDataset[]>([]);
  const [requiredColumns, setRequiredColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch(`${API_URL}/datasets`).then((response) => readJson<DatasetListPayload>(response));
      // Never let a malformed response leave state non-array; the panel renders off this.
      setDatasets(Array.isArray(data?.datasets) ? data.datasets : []);
      setRequiredColumns(Array.isArray(data?.required_columns) ? data.required_columns : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load datasets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh().catch(() => {
      // Errors are surfaced through hook state.
    });
  }, [refresh]);

  const upload = useCallback(async (file: File): Promise<EnvironmentDataset | null> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/datasets?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/csv' },
        body: file,
      });
      const payload = await readJson<{ dataset: EnvironmentDataset }>(response);
      await refresh();
      return payload.dataset;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const remove = useCallback(async (name: string): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/datasets/${encodeURIComponent(name)}`, { method: 'DELETE' });
      await readJson<{ deleted: string }>(response);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { datasets, requiredColumns, loading, error, busy, refresh, upload, remove };
};
