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

function cropToApiKey(crop: CropType): Lowercase<CropType> {
  return crop.toLowerCase() as Lowercase<CropType>;
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

  const start = useCallback((timeStep: SimulationRuntimeTimeStep) => execute('start', '/start', {
    body: JSON.stringify({
      crop: cropKey,
      csv_filename: getDefaultSimulationCsv(crop),
      time_step: timeStep,
    }),
  }), [crop, cropKey, execute]);

  const step = useCallback(() => execute('step', `/step?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const run = useCallback(() => execute('run', '/run'), [execute]);
  const pause = useCallback(() => execute('pause', `/pause?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const resume = useCallback(() => execute('resume', `/resume?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const stop = useCallback(() => execute('stop', `/stop?crop=${encodeURIComponent(cropKey)}`), [cropKey, execute]);
  const setSpeed = useCallback((speed: number) => execute('speed', `/speed?crop=${encodeURIComponent(cropKey)}`, {
    body: JSON.stringify({ speed }),
  }), [cropKey, execute]);

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
