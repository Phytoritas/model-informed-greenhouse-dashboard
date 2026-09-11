import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface SimulationRuntimeStatus {
  status: string;
  running: boolean;
  paused: boolean;
  simulatedAt: string | null;
  dataSource: string | null;
  step: number | null;
  progress: number | null;
  pace: number | null;
}

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
  const [status, setStatus] = useState<SimulationRuntimeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [latestAction, setLatestAction] = useState<SimulationRuntimeAction | null>(null);
  const sessionRef = useRef(0);
  const statusInFlight = useRef(false);
  const cropKey = cropToApiKey(crop);

  const refreshStatus = useCallback(async () => {
    if (statusInFlight.current) return;
    const session = sessionRef.current;
    statusInFlight.current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${API_URL}/status`, { signal: controller.signal });
      if (!response.ok) throw new Error('시뮬레이션 상태를 확인하지 못했습니다.');
      const payload = await response.json();
      if (session !== sessionRef.current) return;
      const current = payload?.greenhouses?.[cropKey];
      if (!current) throw new Error('선택한 작물의 상태가 없습니다.');
      setStatus({
        status: current.status ?? 'unknown',
        running: current.running === true || current.status === 'active',
        paused: current.paused === true || current.status === 'paused',
        simulatedAt: typeof current.simulated_at === 'string' ? current.simulated_at : null,
        dataSource: typeof current.csv_filename === 'string' ? current.csv_filename : null,
        step: typeof current.idx === 'number' ? current.idx : null,
        progress: typeof current.progress === 'number' ? current.progress : null,
        pace: typeof current.sim_seconds_per_real_second === 'number' ? current.sim_seconds_per_real_second : null,
      });
      setStatusError(null);
    } catch (error) {
      if (session === sessionRef.current) {
        setStatusError(error instanceof Error && error.name !== 'AbortError' ? error.message : '상태 확인이 지연되고 있습니다. 다시 확인하세요.');
      }
    } finally {
      window.clearTimeout(timeout);
      if (session === sessionRef.current) { statusInFlight.current = false; setStatusLoading(false); }
    }
  }, [cropKey]);

  useEffect(() => {
    sessionRef.current += 1;
    statusInFlight.current = false;
    setStatus(null);
    setStatusLoading(true);
    setStatusError(null);
    setState(createInitialState());
    setLatestAction(null);
    void refreshStatus();
    const timer = window.setInterval(() => { void refreshStatus(); }, 3000);
    return () => { sessionRef.current += 1; statusInFlight.current = false; window.clearInterval(timer); };
  }, [refreshStatus]);

  const execute = useCallback(async (
    action: SimulationRuntimeAction,
    path: string,
    init?: RequestInit,
  ) => {
    const session = sessionRef.current;
    setLatestAction(action);
    setState((current) => ({
      ...current,
      [action]: {
        status: 'loading',
        message: current[action].message,
        result: current[action].result,
      },
    }));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
        ...init,
        signal: controller.signal,
      });
      const payload = await parseRuntimeResponse(response);
      if (session !== sessionRef.current) return payload;
      setState((current) => ({
        ...current,
        [action]: {
          status: 'success',
          message: readPayloadMessage(payload, 'success'),
          result: payload,
        },
      }));
      await refreshStatus();
      return payload;
    } catch (error) {
      if (session !== sessionRef.current) return null;
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
    } finally {
      window.clearTimeout(timeout);
    }
  }, [refreshStatus]);

  const start = useCallback((timeStep: SimulationRuntimeTimeStep, csvFilename?: string) => execute('start', '/start', {
    body: JSON.stringify({
      crop: cropKey,
      // Default to the crop's bundled fixture; an uploaded dataset name overrides it.
      csv_filename: csvFilename ?? getDefaultSimulationCsv(crop),
      time_step: timeStep,
    }),
  }), [crop, cropKey, execute]);

  const step = useCallback(() => execute('step', `/step?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const run = useCallback(() => execute('run', `/run?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const pause = useCallback(() => execute('pause', `/pause?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const resume = useCallback(() => execute('resume', `/resume?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const stop = useCallback(() => execute('stop', `/stop?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const setSpeed = useCallback((simSecondsPerRealSecond: number) => {
    const { path, init } = buildSimulationPaceRequest(crop, simSecondsPerRealSecond);
    return execute('speed', path, init);
  }, [crop, execute]);

  return {
    state,
    status,
    statusLoading,
    statusError,
    latestAction,
    refreshStatus,
    start,
    step,
    run,
    pause,
    resume,
    stop,
    setSpeed,
  };
}
