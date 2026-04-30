import { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../config';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import type { CropType } from '../types';

export interface AlertHistoryEntry {
  id: string;
  severity: AlertRailItem['severity'];
  title: string;
  body: string;
  source?: string;
  observed_at?: string;
  last_seen_at?: string;
  crop?: string;
}

interface AlertHistoryPayload {
  status?: string;
  source?: {
    provider?: string;
    persisted?: boolean;
    path?: string;
  };
  events?: AlertHistoryEntry[];
}

function cropToApiKey(crop: CropType): string {
  return crop.toLowerCase();
}

function toHistoryEvent(item: AlertRailItem): AlertHistoryEntry {
  return {
    id: item.id,
    severity: item.severity,
    title: item.title,
    body: item.body,
    source: 'frontend-alert-bundle',
    observed_at: new Date().toISOString(),
  };
}

export function useAlertHistory(crop: CropType, items: AlertRailItem[]) {
  const [events, setEvents] = useState<AlertHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signatureRef = useRef<string>('');

  const eventPayload = useMemo(
    () => items.map(toHistoryEvent),
    [items],
  );
  const signature = useMemo(
    () => JSON.stringify(eventPayload.map((item) => [
      item.id,
      item.severity,
      item.title,
      item.body,
    ])),
    [eventPayload],
  );

  useEffect(() => {
    let cancelled = false;
    const cropKey = cropToApiKey(crop);

    async function syncHistory() {
      setLoading(true);
      setError(null);
      try {
        const hasNewBundle = eventPayload.length > 0 && signatureRef.current !== signature;
        const response = await fetch(`${API_URL}/alerts/history?crop=${cropKey}`, hasNewBundle
          ? {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ events: eventPayload }),
            }
          : undefined);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const payload = await response.json() as AlertHistoryPayload;
        if (!cancelled) {
          setEvents(Array.isArray(payload.events) ? payload.events : []);
          signatureRef.current = signature;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load alert history');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void syncHistory();

    return () => {
      cancelled = true;
    };
  }, [crop, eventPayload, signature]);

  return { events, loading, error };
}
