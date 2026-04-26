import { useMemo, useState } from 'react';
import { Activity, Gauge, Loader2, Pause, Play, RotateCcw, SkipForward, Square, Zap } from 'lucide-react';
import type { AppLocale } from '../../i18n/locale';
import type { CropType, TelemetryStatus } from '../../types';
import {
  simulationRuntimeTimeSteps,
  type SimulationRuntimeAction,
  type SimulationRuntimeTimeStep,
  useSimulationRuntimeControls,
} from '../../hooks/useSimulationRuntimeControls';
import { Button } from '../ui/button';
import { StatusChip } from '../ui/status-chip';

interface SimulationRuntimePanelProps {
  locale: AppLocale;
  crop: CropType;
  telemetryStatus: TelemetryStatus;
  telemetryDetail?: string | null;
}

const ACTION_ORDER: SimulationRuntimeAction[] = ['start', 'step', 'run', 'pause', 'resume', 'stop', 'speed'];

function statusTone(status: TelemetryStatus): 'growth' | 'stable' | 'warning' | 'critical' {
  if (status === 'live') return 'growth';
  if (status === 'loading') return 'stable';
  if (status === 'offline') return 'critical';
  return 'warning';
}

function requestTone(status: 'idle' | 'loading' | 'success' | 'error'): 'growth' | 'stable' | 'warning' | 'muted' {
  if (status === 'success') return 'growth';
  if (status === 'error') return 'warning';
  if (status === 'loading') return 'stable';
  return 'muted';
}

export default function SimulationRuntimePanel({
  locale,
  crop,
  telemetryStatus,
  telemetryDetail = null,
}: SimulationRuntimePanelProps) {
  const [timeStep, setTimeStep] = useState<SimulationRuntimeTimeStep>('auto');
  const [speed, setSpeedValue] = useState(1);
  const runtime = useSimulationRuntimeControls(crop);
  const isBusy = ACTION_ORDER.some((action) => runtime.state[action].status === 'loading');
  const latestAction = useMemo(() => (
    [...ACTION_ORDER]
      .reverse()
      .find((action) => runtime.state[action].status !== 'idle') ?? 'start'
  ), [runtime.state]);

  const copy = locale === 'ko'
    ? {
        eyebrow: 'Simulation Runtime',
        title: 'Live Climate & Controls',
        description: '시뮬레이션 시작, 단일 step, 전체 run, pause/resume/stop, speed 조절을 백엔드 runtime endpoint에 직접 연결합니다.',
        status: 'Runtime 상태',
        timeStep: 'Time step',
        speed: 'Speed',
        start: 'Start',
        step: 'Step',
        run: 'Run 전체',
        pause: 'Pause',
        resume: 'Resume',
        stop: 'Stop',
        applySpeed: 'Speed 적용',
        crop: '작물',
        endpoint: 'endpoint',
        latest: '마지막 응답',
        noMessage: '아직 요청하지 않았습니다.',
      }
    : {
        eyebrow: 'Simulation Runtime',
        title: 'Live Climate & Controls',
        description: 'Start, step, run, pause, resume, stop, and speed are connected to the backend runtime endpoints.',
        status: 'Runtime status',
        timeStep: 'Time step',
        speed: 'Speed',
        start: 'Start',
        step: 'Step',
        run: 'Run all',
        pause: 'Pause',
        resume: 'Resume',
        stop: 'Stop',
        applySpeed: 'Apply speed',
        crop: 'Crop',
        endpoint: 'endpoint',
        latest: 'Latest response',
        noMessage: 'No runtime request yet.',
      };

  const latestState = runtime.state[latestAction];

  return (
    <section className="sg-panel p-4" aria-labelledby="simulation-runtime-title">
      <div className="flex flex-col gap-3 border-b border-[color:var(--sg-outline-soft)] pb-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="sg-eyebrow">{copy.eyebrow}</p>
          <h2 id="simulation-runtime-title" className="mt-1 text-lg font-bold text-[color:var(--sg-text-strong)]">
            {copy.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {copy.description}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip tone={statusTone(telemetryStatus)} icon={<Activity className="h-3.5 w-3.5" aria-hidden="true" />}>
            {copy.status}: {telemetryStatus}
          </StatusChip>
          {telemetryDetail ? <StatusChip tone="muted">{telemetryDetail}</StatusChip> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="grid gap-3 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-3 sm:grid-cols-3">
          <div>
            <label htmlFor="runtime-crop" className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
              {copy.crop}
            </label>
            <div id="runtime-crop" className="sg-data-number mt-2 text-base font-bold text-[color:var(--sg-text-strong)]">
              {crop}
            </div>
          </div>
          <div>
            <label htmlFor="runtime-time-step" className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
              {copy.timeStep}
            </label>
            <select
              id="runtime-time-step"
              value={timeStep}
              onChange={(event) => setTimeStep(event.target.value as SimulationRuntimeTimeStep)}
              className="mt-2 h-10 w-full rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 text-sm font-semibold text-[color:var(--sg-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
            >
              {simulationRuntimeTimeSteps.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="runtime-speed" className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
              {copy.speed}
            </label>
            <input
              id="runtime-speed"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={speed}
              onChange={(event) => setSpeedValue(Number(event.target.value))}
              className="sg-data-number mt-2 h-10 w-full rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 text-sm font-semibold text-[color:var(--sg-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <Button variant="primary" disabled={isBusy} onClick={() => { void runtime.start(timeStep); }}>
            {runtime.state.start.status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
            {copy.start}
          </Button>
          <Button variant="secondary" disabled={isBusy} onClick={() => { void runtime.step(); }}>
            <SkipForward className="h-4 w-4" aria-hidden="true" />
            {copy.step}
          </Button>
          <Button variant="secondary" disabled={isBusy} onClick={() => { void runtime.run(); }}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            {copy.run}
          </Button>
          <Button variant="secondary" disabled={isBusy || !Number.isFinite(speed) || speed <= 0} onClick={() => { void runtime.setSpeed(speed); }}>
            <Gauge className="h-4 w-4" aria-hidden="true" />
            {copy.applySpeed}
          </Button>
          <Button variant="ghost" disabled={isBusy} onClick={() => { void runtime.pause(); }}>
            <Pause className="h-4 w-4" aria-hidden="true" />
            {copy.pause}
          </Button>
          <Button variant="ghost" disabled={isBusy} onClick={() => { void runtime.resume(); }}>
            <Zap className="h-4 w-4" aria-hidden="true" />
            {copy.resume}
          </Button>
          <Button variant="danger" disabled={isBusy} onClick={() => { void runtime.stop(); }}>
            <Square className="h-4 w-4" aria-hidden="true" />
            {copy.stop}
          </Button>
          <div className="flex items-center justify-center rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 text-xs font-semibold text-[color:var(--sg-text-muted)]">
            {copy.endpoint}: /api/{latestAction}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 py-2 text-xs text-[color:var(--sg-text-muted)]" aria-live="polite">
        <StatusChip tone={requestTone(latestState.status)}>{latestState.status}</StatusChip>
        <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.latest}:</span>
        <span>{latestState.message ?? copy.noMessage}</span>
      </div>
    </section>
  );
}
