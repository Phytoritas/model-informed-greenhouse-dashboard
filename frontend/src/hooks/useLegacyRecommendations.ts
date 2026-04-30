import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config';
import type { CropType } from '../types';

export interface LegacyRecommendation {
  priority?: string;
  category?: string;
  message?: string;
  action?: string;
  title?: string;
  [key: string]: unknown;
}

interface LegacyRecommendationCropBlock {
  count?: number;
  recommendations?: LegacyRecommendation[];
}

interface LegacyRecommendationPayload {
  status?: string;
  crops?: Record<string, LegacyRecommendationCropBlock>;
  timestamp?: string;
}

interface LegacyRecommendationsState {
  recommendations: LegacyRecommendation[];
  payload: LegacyRecommendationPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function cropKeys(crop: CropType): string[] {
  const lower = crop.toLowerCase();
  return [crop, lower, lower.charAt(0).toUpperCase() + lower.slice(1)];
}

function extractCropRecommendations(
  payload: LegacyRecommendationPayload | null,
  crop: CropType,
): LegacyRecommendation[] {
  if (!payload?.crops) {
    return [];
  }

  for (const key of cropKeys(crop)) {
    const block = payload.crops[key];
    if (Array.isArray(block?.recommendations)) {
      return block.recommendations;
    }
  }

  return [];
}

export function formatLegacyRecommendation(recommendation: LegacyRecommendation): string {
  const candidates = [
    recommendation.action,
    recommendation.message,
    recommendation.title,
  ];
  const text = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return text?.trim() ?? '';
}

export function useLegacyRecommendations(
  crop: CropType,
  active = true,
): LegacyRecommendationsState {
  const [payload, setPayload] = useState<LegacyRecommendationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;

    if (!active) {
      setPayload(null);
      setError(null);
      setLoading(false);
      return;
    }

    const isCurrentRequest = () => latestRequestIdRef.current === requestId;
    const params = new URLSearchParams({ crop: crop.toLowerCase() });
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/recommendations?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Recommendation request failed with ${response.status}`);
      }
      const nextPayload = await response.json() as LegacyRecommendationPayload;
      if (isCurrentRequest()) {
        setPayload(nextPayload);
      }
    } catch (err) {
      if (isCurrentRequest()) {
        setError(err instanceof Error ? err.message : 'Failed to load recommendations.');
      }
    } finally {
      if (isCurrentRequest()) {
        setLoading(false);
      }
    }
  }, [active, crop]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => () => {
    latestRequestIdRef.current += 1;
  }, []);

  const recommendations = useMemo(
    () => extractCropRecommendations(payload, crop),
    [crop, payload],
  );

  return {
    recommendations,
    payload,
    loading,
    error,
    refresh,
  };
}
