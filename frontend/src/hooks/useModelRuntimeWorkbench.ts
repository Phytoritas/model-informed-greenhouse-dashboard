import { useCallback, useState } from 'react';
import { API_URL } from '../config';
import type { CropType } from '../types';

export type ModelRuntimeWorkbenchAction = 'snapshot' | 'replay' | 'scenario' | 'sensitivity' | 'knowledgeReindex';

export interface ModelScenarioControls {
  temperature_day?: number;
  temperature_night?: number;
  co2_setpoint_day?: number;
  rh_target?: number;
  screen_close?: number;
}

export interface ModelScenarioOptions {
  label?: string;
  controls?: ModelScenarioControls;
  horizonHours?: number[];
}

export interface ModelSensitivityOptions {
  target?: string;
  horizonHours?: number;
  controls?: string[];
  stepOverrides?: Record<string, number>;
}

export interface ModelRuntimeRunState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  result: Record<string, unknown> | null;
}

export type ModelRuntimeWorkbenchRuns = Record<ModelRuntimeWorkbenchAction, ModelRuntimeRunState>;

function cropToApiKey(crop: CropType): Lowercase<CropType> {
  return crop.toLowerCase() as Lowercase<CropType>;
}

function createIdleRunState(): ModelRuntimeRunState {
  return {
    status: 'idle',
    error: null,
    result: null,
  };
}

function createInitialRuns(): ModelRuntimeWorkbenchRuns {
  return {
    snapshot: createIdleRunState(),
    replay: createIdleRunState(),
    scenario: createIdleRunState(),
    sensitivity: createIdleRunState(),
    knowledgeReindex: createIdleRunState(),
  };
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
  }

  return fallback;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, response.statusText || `HTTP ${response.status}`));
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Backend returned an invalid JSON payload.');
  }

  return payload as Record<string, unknown>;
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export function useModelRuntimeWorkbench(crop: CropType) {
  const [runs, setRuns] = useState<ModelRuntimeWorkbenchRuns>(() => createInitialRuns());
  const [latestSnapshotId, setLatestSnapshotId] = useState<string | null>(null);

  const execute = useCallback(
    async (
      action: ModelRuntimeWorkbenchAction,
      path: string,
      body?: Record<string, unknown>,
    ): Promise<Record<string, unknown> | null> => {
      setRuns((current) => ({
        ...current,
        [action]: {
          status: 'loading',
          error: null,
          result: current[action].result,
        },
      }));

      try {
        const response = await fetch(`${API_URL}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        const payload = await parseJsonResponse(response);

        setRuns((current) => ({
          ...current,
          [action]: {
            status: 'success',
            error: null,
            result: payload,
          },
        }));

        return payload;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Request failed.';
        setRuns((current) => ({
          ...current,
          [action]: {
            status: 'error',
            error: message,
            result: current[action].result,
          },
        }));
        return null;
      }
    },
    [],
  );

  const createSnapshot = useCallback(async () => {
    const payload = await execute('snapshot', '/models/snapshot', {
      crop: cropToApiKey(crop),
      source: 'overview_runtime_bridge',
    });

    if (payload) {
      const snapshotId = readString(payload, 'snapshot_id');
      setLatestSnapshotId(snapshotId);
    }

    return payload;
  }, [crop, execute]);

  const runScenarioWithOptions = useCallback((options: ModelScenarioOptions = {}) => execute('scenario', '/models/scenario', {
    crop: cropToApiKey(crop),
    snapshot_id: latestSnapshotId ?? undefined,
    scenario_label: options.label ?? 'overview_default_compare',
    horizon_hours: options.horizonHours ?? [24, 72, 336],
    controls: {
      temperature_day: options.controls?.temperature_day ?? 0,
      temperature_night: options.controls?.temperature_night ?? 0,
      co2_setpoint_day: options.controls?.co2_setpoint_day ?? 0,
      rh_target: options.controls?.rh_target ?? 0,
      screen_close: options.controls?.screen_close ?? 0,
    },
  }), [crop, execute, latestSnapshotId]);

  const runScenario = useCallback(() => runScenarioWithOptions(), [runScenarioWithOptions]);

  const replayWorkEvent = useCallback(async () => {
    const payload = await execute('replay', '/models/replay', {
      crop: cropToApiKey(crop),
      snapshot_id: latestSnapshotId ?? undefined,
      events: crop === 'Tomato'
        ? [{
            event_type: 'fruit_thinning',
            fruits_removed_count: 0,
            reason_code: 'frontend_visibility_check',
            operator: 'PhytoSync',
            confidence: 0.7,
            source: 'frontend_model_lab',
          }]
        : [{
            event_type: 'leaf_removal',
            leaves_removed_count: 0,
            reason_code: 'frontend_visibility_check',
            operator: 'PhytoSync',
            confidence: 0.7,
            source: 'frontend_model_lab',
          }],
    });

    if (payload) {
      const snapshotId = readString(payload, 'final_snapshot_id');
      if (snapshotId) {
        setLatestSnapshotId(snapshotId);
      }
    }

    return payload;
  }, [crop, execute, latestSnapshotId]);

  const runSensitivityWithOptions = useCallback((options: ModelSensitivityOptions = {}) => execute('sensitivity', '/models/sensitivity', {
    crop: cropToApiKey(crop),
    snapshot_id: latestSnapshotId ?? undefined,
    target: options.target ?? 'predicted_yield_14d',
    horizon_hours: options.horizonHours ?? 72,
    controls: options.controls ?? ['temperature_day', 'temperature_night', 'co2_setpoint_day', 'rh_target'],
    step_overrides: options.stepOverrides,
  }), [crop, execute, latestSnapshotId]);

  const runSensitivity = useCallback(() => runSensitivityWithOptions(), [runSensitivityWithOptions]);

  const reindexKnowledge = useCallback(() => execute(
    'knowledgeReindex',
    `/knowledge/reindex?crop=${encodeURIComponent(cropToApiKey(crop))}`,
  ), [crop, execute]);

  return {
    runs,
    latestSnapshotId,
    createSnapshot,
    replayWorkEvent,
    runScenario,
    runScenarioWithOptions,
    runSensitivity,
    runSensitivityWithOptions,
    reindexKnowledge,
  };
}
