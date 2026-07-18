import { useCallback, useState } from 'react';
import { API_URL } from '../config';
import type { CropType } from '../types';

export type SimulationRuntimeAction =
  | 'start'
  | 'step'
  | 'run'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'speed';

type RuntimeRequestState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  message: string | null;
  result: Record<string, unknown> | null;
};

export type SimulationRuntimeControlState = Record<SimulationRuntimeAction, RuntimeRequestState>;

const TIME_STEP_OPTIONS = ['auto', '1s', '1min', '10min', '1h'] as const;
export type SimulationRuntimeTimeStep = typeof TIME_STEP_OPTIONS[number];

export const simulationRuntimeTimeSteps = [...TIME_STEP_OPTIONS];

const PACE_PRESETS = [10, 20, 30, 60, 600, 6000] as const;
export type SimulationRuntimePacePreset = typeof PACE_PRESETS[number];

export const simulationRuntimePacePresets = [...PACE_PRESETS];

// Initial default pace: 1 real second maps to 600 simulated seconds (R28).
export const DEFAULT_SIMULATION_PACE: SimulationRuntimePacePreset = 600;
export const SIMULATION_PACE_STORAGE_KEY = 'sg-sim-pace';

const LEGACY_DEFAULT_STEP_SIM_SECONDS = 600;
const LEGACY_REAL_SECONDS_PER_STEP = 0.1;

export function deriveLegacySpeedFromPace(simSecondsPerRealSecond: number): number {
  return (
    Number(simSecondsPerRealSecond)
    * LEGACY_REAL_SECONDS_PER_STEP
    / LEGACY_DEFAULT_STEP_SIM_SECONDS
  );
}

export function isSimulationPacePreset(value: number): value is SimulationRuntimePacePreset {
  return simulationRuntimePacePresets.some((preset) => preset === value);
}

/**
 * Read the persisted pace (R11/R28). Returns null when no valid value is stored so
 * callers can fall back to the backend's own default without forcing a request.
 */
export function readStoredSimulationPace(): SimulationRuntimePacePreset | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SIMULATION_PACE_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const value = Number(raw);
    return isSimulationPacePreset(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredSimulationPace(pace: SimulationRuntimePacePreset): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(SIMULATION_PACE_STORAGE_KEY, String(pace));
  } catch {
    // Keep runtime controls usable when storage is unavailable.
  }
}

function cropToApiKey(crop: CropType): Lowercase<CropType> {
  return crop.toLowerCase() as Lowercase<CropType>;
}

/**
 * Build the /api/speed request for a pace (R3/R11). Sends the new
 * sim_seconds_per_real_second field plus a backward-compatible legacy speed
 * multiplier so callers that reconnect can reapply the stored pace directly.
 */
export function buildSimulationPaceRequest(
  crop: CropType,
  simSecondsPerRealSecond: number,
): { path: string; init: RequestInit } {
  const cropKey = cropToApiKey(crop);
  return {
    path: `/speed?crop=${encodeURIComponent(cropKey)}`,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sim_seconds_per_real_second: simSecondsPerRealSecond,
        speed: deriveLegacySpeedFromPace(simSecondsPerRealSecond),
      }),
    },
  };
}

export function getDefaultSimulationCsv(crop: CropType): string {
  return crop === 'Tomato' ? 'Tomato_Env.CSV' : 'Cucumber_Env.CSV';
}

function createIdleState(): RuntimeRequestState {
  return {
    status: 'idle',
    message: null,
    result: null,
  };
}

function createInitialState(): SimulationRuntimeControlState {
  return {
    start: createIdleState(),
    step: createIdleState(),
    run: createIdleState(),
    pause: createIdleState(),
    resume: createIdleState(),
    stop: createIdleState(),
    speed: createIdleState(),
  };
}

function readPayloadMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const candidate = payload as { detail?: unknown; message?: unknown; status?: unknown };
    if (typeof candidate.detail === 'string' && candidate.detail.trim()) {
      return candidate.detail;
    }
    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message;
    }
    if (typeof candidate.status === 'string' && candidate.status.trim()) {
      return candidate.status;
    }
  }

  return fallback;
}

async function parseRuntimeResponse(response: Response): Promise<Record<string, unknown>> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(readPayloadMessage(payload, response.statusText || `HTTP ${response.status}`));
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 'success' };
  }

  return payload as Record<string, unknown>;
}

export function useSimulationRuntimeControls(crop: CropType) {
  const [state, setState] = useState<SimulationRuntimeControlState>(() => createInitialState());

  const execute = useCallback(async (
    action: SimulationRuntimeAction,
    path: string,
    init?: RequestInit,
  ) => {
    setState((current) => ({
      ...current,
      [action]: {
        status: 'loading',
        message: current[action].message,
        result: current[action].result,
      },
    }));

    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
        ...init,
      });
      const payload = await parseRuntimeResponse(response);
      setState((current) => ({
        ...current,
        [action]: {
          status: 'success',
          message: readPayloadMessage(payload, 'success'),
          result: payload,
        },
      }));
      return payload;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed.';
      setState((current) => ({
        ...current,
        [action]: {
          status: 'error',
          message,
          result: current[action].result,
        },
      }));
      return null;
    }
  }, []);

  const cropKey = cropToApiKey(crop);

  const start = useCallback((timeStep: SimulationRuntimeTimeStep, csvFilename?: string) => execute('start', '/start', {
    body: JSON.stringify({
      crop: cropKey,
      // Default to the crop's bundled fixture; an uploaded dataset name overrides it.
      csv_filename: csvFilename ?? getDefaultSimulationCsv(crop),
      time_step: timeStep,
    }),
  }), [crop, cropKey, execute]);

  const step = useCallback(() => execute('step', `/step?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const run = useCallback(() => execute('run', '/run'), [execute]);
  const pause = useCallback(() => execute('pause', `/pause?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const resume = useCallback(() => execute('resume', `/resume?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const stop = useCallback(() => execute('stop', `/stop?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const setSpeed = useCallback((simSecondsPerRealSecond: number) => {
    const { path, init } = buildSimulationPaceRequest(crop, simSecondsPerRealSecond);
    return execute('speed', path, init);
  }, [crop, execute]);

  return {
    state,
    start,
    step,
    run,
    pause,
    resume,
    stop,
    setSpeed,
  };
}
