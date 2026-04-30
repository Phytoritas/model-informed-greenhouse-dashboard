import { useMemo, useState } from 'react';
import { Activity, Calculator, FlaskConical, Gauge, Sigma } from 'lucide-react';
import { useModelRuntimeWorkbench, type ModelScenarioControls } from '../../hooks/useModelRuntimeWorkbench';
import { useLocale } from '../../i18n/LocaleProvider';
import type { CropType } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { StatusChip } from '../ui/status-chip';

interface ModelScenarioWorkbenchProps {
  crop: CropType;
}

const CONTROL_LABELS: Record<string, { ko: string; en: string; unit: string }> = {
  temperature_day: { ko: '주간 온도', en: 'Day temp', unit: 'C' },
  temperature_night: { ko: '야간 온도', en: 'Night temp', unit: 'C' },
  co2_setpoint_day: { ko: '이산화탄소', en: 'CO2', unit: 'ppm' },
  rh_target: { ko: '상대습도', en: 'RH', unit: '%p' },
  screen_close: { ko: '스크린', en: 'Screen', unit: '%p' },
};

const SENSITIVITY_TARGETS = [
  'predicted_yield_24h',
  'predicted_yield_72h',
  'predicted_yield_7d',
  'predicted_yield_14d',
  'source_sink_balance_72h',
  'energy_cost_72h',
];

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row))
    : [];
}

function readNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatDeltaPct(output: Record<string, unknown>, baseline: Record<string, unknown> | undefined): string {
  const percent = readYieldDeltaPct(output, baseline);
  return percent === null ? '-' : `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function readYieldDeltaPct(output: Record<string, unknown>, baseline: Record<string, unknown> | undefined): number | null {
  const scenarioYield = readNumber(output, 'yield_pred');
  const baselineYield = baseline ? readNumber(baseline, 'yield_pred') : null;
  if (scenarioYield === null || baselineYield === null || Math.abs(baselineYield) <= 1e-9) {
    return null;
  }
  return ((scenarioYield - baselineYield) / baselineYield) * 100;
}

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? '-' : value.toFixed(digits);
}

function formatSignedNumber(value: number | null, digits = 2): string {
  if (value === null) {
    return '-';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function getSensitivityTargetLabel(value: string, locale: 'ko' | 'en'): string {
  const labels: Record<string, { ko: string; en: string }> = {
    predicted_yield_24h: { ko: '24시간 수량', en: '24h yield' },
    predicted_yield_72h: { ko: '72시간 수량', en: '72h yield' },
    predicted_yield_7d: { ko: '7일 수량', en: '7d yield' },
    predicted_yield_14d: { ko: '14일 수량', en: '14d yield' },
    source_sink_balance_72h: { ko: '72시간 공급력·착과부담', en: '72h source/sink' },
    energy_cost_72h: { ko: '72시간 에너지 비용', en: '72h energy cost' },
  };
  return labels[value]?.[locale] ?? value;
}

function getDirectionLabel(value: unknown, locale: 'ko' | 'en'): string {
  if (value === 'increase') return locale === 'ko' ? '증가' : 'Increase';
  if (value === 'decrease') return locale === 'ko' ? '감소' : 'Decrease';
  return locale === 'ko' ? '중립' : 'Stable';
}

function clampBarWidth(value: number | null, maxAbs: number, minWhenVisible = 8): string {
  if (value === null || !Number.isFinite(value) || maxAbs <= 0) {
    return '0%';
  }
  const normalized = Math.min(100, Math.max(minWhenVisible, (Math.abs(value) / maxAbs) * 100));
  return `${normalized}%`;
}

function EffectBar({
  label,
  value,
  formattedValue,
  maxAbs,
  unit,
  locale,
}: {
  label: string;
  value: number | null;
  formattedValue: string;
  maxAbs: number;
  unit?: string;
  locale: 'ko' | 'en';
}) {
  const isPositive = typeof value === 'number' && value >= 0;
  const isMissing = value === null;
  const barColor = isMissing
    ? 'bg-[color:var(--sg-outline-soft)]'
    : isPositive
      ? 'bg-[color:var(--sg-color-success)]'
      : 'bg-[color:var(--sg-color-primary)]';
  const toneLabel = isMissing
    ? (locale === 'ko' ? '대기' : 'pending')
    : isPositive
      ? (locale === 'ko' ? '증가' : 'increase')
      : (locale === 'ko' ? '감소' : 'decrease');

  return (
    <div className="rounded-[var(--sg-radius-sm)] bg-white/78 px-3 py-2 shadow-[var(--sg-shadow-card)]">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[color:var(--sg-text-muted)]">{label}</span>
        <span className="sg-data-number font-bold text-[color:var(--sg-text-strong)]">
          {formattedValue}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-[color:var(--sg-surface-muted)]"
        aria-label={`${label}: ${formattedValue}${unit ? ` ${unit}` : ''}, ${toneLabel}`}
      >
        <div className={`h-full rounded-full ${barColor}`} style={{ width: clampBarWidth(value, maxAbs) }} />
      </div>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[color:var(--sg-text-faint)]">
        {toneLabel}
      </p>
    </div>
  );
}

export default function ModelScenarioWorkbench({ crop }: ModelScenarioWorkbenchProps) {
  const { locale } = useLocale();
  const {
    runs,
    latestSnapshotId,
    createSnapshot,
    runScenarioWithOptions,
    runSensitivityWithOptions,
  } = useModelRuntimeWorkbench(crop);
  const [horizon, setHorizon] = useState('336');
  const [target, setTarget] = useState('predicted_yield_14d');
  const [controls, setControls] = useState({
    temperature_day: '0.5',
    temperature_night: '0.3',
    co2_setpoint_day: '80',
    rh_target: '-3',
    screen_close: '0',
  });

  const copy = locale === 'ko'
    ? {
        eyebrow: '조정안 계산',
        title: '온실 조정 효과 계산',
        description: '현재 온실 상태를 기준으로 온도, 이산화탄소, 상대습도 변경량을 넣어 수량·에너지·공급력과 착과 부담 변화를 계산합니다.',
        snapshot: '스냅샷 생성',
        runScenario: '효과 계산',
        runSensitivity: '민감도 확인',
        noSnapshot: '현재 기준',
        horizon: '검토 기간',
        sensitivityTarget: '검토 지표',
        inputs: '현재 대비 변경량',
        scenarioResult: '시나리오 결과',
        sensitivityResult: '민감도 결과',
        yieldDelta: '수량 변화',
        yield: '예상 수량',
        energyDelta: '에너지 변화',
        balanceDelta: '공급력·착과부담 변화',
        confidence: '신뢰도',
        derivative: '국소 영향',
        elasticity: '탄력도',
        direction: '방향',
        waiting: '아직 실행 결과가 없습니다.',
        backendNote: '입력값은 현재 상태 대비 변경량입니다. 검토 기간을 바꾸면 같은 조정의 단기·중기 효과를 비교할 수 있습니다.',
        idle: '대기 중',
        loading: '계산 중',
        success: '계산 완료',
        error: '확인 필요',
      }
    : {
        eyebrow: 'Greenhouse model',
        title: 'Greenhouse adjustment effect',
        description: 'Run temperature, CO2, RH, and screen deltas against the current greenhouse state and compare yield, energy, and source-sink response.',
        snapshot: 'Create snapshot',
        runScenario: 'Calculate effect',
        runSensitivity: 'Check sensitivity',
        noSnapshot: 'current baseline',
        horizon: 'Horizon',
        sensitivityTarget: 'Review metric',
        inputs: 'Delta from current',
        scenarioResult: 'Scenario result',
        sensitivityResult: 'Sensitivity result',
        yieldDelta: 'Yield change',
        yield: 'Yield',
        energyDelta: 'Energy change',
        balanceDelta: 'Source/sink change',
        confidence: 'Confidence',
        derivative: 'Local effect',
        elasticity: 'Elasticity',
        direction: 'Direction',
        waiting: 'No scenario result yet.',
        backendNote: 'Inputs are deltas from the current state. Change the horizon to compare short- and mid-term effects.',
        idle: 'Waiting',
        loading: 'Calculating',
        success: 'Ready',
        error: 'Needs review',
      };
  const getRunStatusLabel = (status: string) => {
    if (status === 'loading') return copy.loading;
    if (status === 'success') return copy.success;
    if (status === 'error') return copy.error;
    return copy.idle;
  };

  const scenarioRows = useMemo(() => {
    const result = runs.scenario.result;
    const outputs = asArray(result?.outputs);
    const baselineRows = asArray(result?.baseline_outputs);
    return outputs.map((row) => {
      const horizonHours = readNumber(row, 'horizon_hours');
      const baseline = baselineRows.find((candidate) => readNumber(candidate, 'horizon_hours') === horizonHours);
      return { row, baseline };
    });
  }, [runs.scenario.result]);

  const sensitivityRows = useMemo(() => asArray(runs.sensitivity.result?.sensitivities), [runs.sensitivity.result]);
  const scenarioVisualRows = useMemo(() => {
    const rows = scenarioRows.map(({ row, baseline }) => ({
      horizon: readNumber(row, 'horizon_hours'),
      yieldDeltaPct: readYieldDeltaPct(row, baseline),
      energyDelta: readNumber(row, 'energy_delta_vs_baseline'),
      balanceDelta: readNumber(row, 'source_sink_balance_delta'),
      confidence: readNumber(row, 'confidence_score'),
    }));
    const maxAbsYield = Math.max(2, ...rows.map((row) => Math.abs(row.yieldDeltaPct ?? 0)));
    const maxAbsEnergy = Math.max(0.1, ...rows.map((row) => Math.abs(row.energyDelta ?? 0)));
    const maxAbsBalance = Math.max(0.05, ...rows.map((row) => Math.abs(row.balanceDelta ?? 0)));
    return { rows, maxAbsYield, maxAbsEnergy, maxAbsBalance };
  }, [scenarioRows]);
  const sensitivityVisualScale = useMemo(() => (
    Math.max(0.0001, ...sensitivityRows.map((row) => Math.abs(readNumber(row, 'derivative') ?? 0)))
  ), [sensitivityRows]);
  const normalizedControls: ModelScenarioControls = {
    temperature_day: toNumber(controls.temperature_day),
    temperature_night: toNumber(controls.temperature_night),
    co2_setpoint_day: toNumber(controls.co2_setpoint_day),
    rh_target: toNumber(controls.rh_target),
    screen_close: toNumber(controls.screen_close),
  };
  const isBusy = runs.snapshot.status === 'loading' || runs.scenario.status === 'loading' || runs.sensitivity.status === 'loading';

  return (
    <section className="sg-card sg-tint-rose p-4 sm:p-5" aria-labelledby="model-scenario-title">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="sg-eyebrow">{copy.eyebrow}</p>
          <h2 id="model-scenario-title" className="mt-1 text-xl font-bold text-[color:var(--sg-text-strong)]">{copy.title}</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[color:var(--sg-text-muted)]">{copy.description}</p>
        </div>
        <StatusChip tone={latestSnapshotId ? 'growth' : 'stable'}>{latestSnapshotId ?? copy.noSnapshot}</StatusChip>
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="sg-panel bg-[color:var(--sg-surface-raised)] p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--sg-text-strong)]">
              <Gauge className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
              {copy.inputs}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {Object.entries(CONTROL_LABELS).map(([key, meta]) => (
                <label key={key} className="text-xs font-semibold text-[color:var(--sg-text-muted)]">
                  <span>{locale === 'ko' ? meta.ko : meta.en} ({meta.unit})</span>
                  <Input
                    className="mt-1"
                    type="number"
                    step={key === 'co2_setpoint_day' ? 10 : 0.1}
                    value={controls[key as keyof typeof controls]}
                    onChange={(event) => setControls((current) => ({ ...current, [key]: event.target.value }))}
                    aria-label={locale === 'ko' ? `${meta.ko} 변경량` : `${meta.en} delta`}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="sg-panel bg-[color:var(--sg-surface-raised)] p-3">
            <label className="text-xs font-semibold text-[color:var(--sg-text-muted)]">
              <span>{copy.horizon}</span>
              <Select className="mt-1" value={horizon} onChange={(event) => setHorizon(event.target.value)} aria-label={copy.horizon}>
                <option value="24">{locale === 'ko' ? '24시간' : '24h'}</option>
                <option value="72">{locale === 'ko' ? '72시간' : '72h'}</option>
                <option value="168">{locale === 'ko' ? '7일' : '7d'}</option>
                <option value="336">{locale === 'ko' ? '14일' : '14d'}</option>
              </Select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-[color:var(--sg-text-muted)]">
              <span>{copy.sensitivityTarget}</span>
              <Select className="mt-1" value={target} onChange={(event) => setTarget(event.target.value)} aria-label={copy.sensitivityTarget}>
                {SENSITIVITY_TARGETS.map((value) => <option key={value} value={value}>{getSensitivityTargetLabel(value, locale)}</option>)}
              </Select>
            </label>
            <p className="mt-3 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] p-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
              {copy.backendNote}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
            <Button type="button" variant="secondary" onClick={() => { void createSnapshot(); }} disabled={isBusy}>
              <FlaskConical className="h-4 w-4" aria-hidden="true" /> {copy.snapshot}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void runScenarioWithOptions({
                  label: `scenario_${crop.toLowerCase()}_${horizon}h`,
                  horizonHours: [Number(horizon)],
                  controls: normalizedControls,
                });
              }}
              disabled={isBusy}
            >
              <Calculator className="h-4 w-4" aria-hidden="true" /> {copy.runScenario}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void runSensitivityWithOptions({
                  target,
                  horizonHours: Number(horizon),
                  controls: Object.keys(CONTROL_LABELS),
                });
              }}
              disabled={isBusy}
            >
              <Sigma className="h-4 w-4" aria-hidden="true" /> {copy.runSensitivity}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <article className="sg-panel bg-[color:var(--sg-surface-raised)] p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-[color:var(--sg-text-strong)]">
                <Activity className="h-4 w-4 text-[color:var(--sg-color-success)]" aria-hidden="true" />
                {copy.scenarioResult}
              </h3>
              <StatusChip tone={runs.scenario.status === 'success' ? 'growth' : runs.scenario.status === 'error' ? 'critical' : 'muted'}>
                {getRunStatusLabel(runs.scenario.status)}
              </StatusChip>
            </div>
            {runs.scenario.error ? <p className="mt-3 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary-soft)] p-2 text-xs text-[color:var(--sg-color-primary-strong)]">{runs.scenario.error}</p> : null}
            {scenarioRows.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--sg-text-muted)]">{copy.waiting}</p>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="grid gap-3 xl:grid-cols-2">
                  {scenarioVisualRows.rows.map((row, index) => (
                    <div
                      key={`${String(row.horizon ?? 'scenario')}-${index}`}
                      className="rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[color:var(--sg-text-strong)]">
                          {formatNumber(row.horizon, 0)}{locale === 'ko' ? '시간' : 'h'}
                        </p>
                        <StatusChip tone={row.confidence !== null && row.confidence >= 0.7 ? 'growth' : 'stable'}>
                          {copy.confidence} {formatNumber(row.confidence, 2)}
                        </StatusChip>
                      </div>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <EffectBar
                          label={copy.yieldDelta}
                          value={row.yieldDeltaPct}
                          formattedValue={formatSignedNumber(row.yieldDeltaPct, 1)}
                          maxAbs={scenarioVisualRows.maxAbsYield}
                          unit="%"
                          locale={locale}
                        />
                        <EffectBar
                          label={copy.energyDelta}
                          value={row.energyDelta}
                          formattedValue={formatSignedNumber(row.energyDelta, 3)}
                          maxAbs={scenarioVisualRows.maxAbsEnergy}
                          locale={locale}
                        />
                        <EffectBar
                          label={copy.balanceDelta}
                          value={row.balanceDelta}
                          formattedValue={formatSignedNumber(row.balanceDelta, 3)}
                          maxAbs={scenarioVisualRows.maxAbsBalance}
                          locale={locale}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs">
                    <thead className="text-[color:var(--sg-text-muted)]">
                      <tr className="border-b border-[color:var(--sg-outline-soft)]">
                        <th className="px-2 py-2">{locale === 'ko' ? '검토 기간' : 'Horizon'}</th>
                        <th className="px-2 py-2">{copy.yield}</th>
                        <th className="px-2 py-2">{copy.yieldDelta}</th>
                        <th className="px-2 py-2">{copy.energyDelta}</th>
                        <th className="px-2 py-2">{copy.balanceDelta}</th>
                        <th className="px-2 py-2">{copy.confidence}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarioRows.map(({ row, baseline }, index) => (
                        <tr key={`${String(readNumber(row, 'horizon_hours') ?? 'horizon')}-${index}`} className="border-b border-[color:var(--sg-outline-soft)] last:border-b-0">
                          <td className="px-2 py-2 font-semibold">{formatNumber(readNumber(row, 'horizon_hours'), 0)}{locale === 'ko' ? '시간' : 'h'}</td>
                          <td className="sg-data-number px-2 py-2">{formatNumber(readNumber(row, 'yield_pred'), 3)}</td>
                          <td className="sg-data-number px-2 py-2 font-bold text-[color:var(--sg-color-success)]">{formatDeltaPct(row, baseline)}</td>
                          <td className="sg-data-number px-2 py-2">{formatNumber(readNumber(row, 'energy_delta_vs_baseline'), 3)}</td>
                          <td className="sg-data-number px-2 py-2">{formatNumber(readNumber(row, 'source_sink_balance_delta'), 3)}</td>
                          <td className="sg-data-number px-2 py-2">{formatNumber(readNumber(row, 'confidence_score'), 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </article>

          <article className="sg-panel bg-[color:var(--sg-surface-raised)] p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-[color:var(--sg-text-strong)]">
                <Sigma className="h-4 w-4 text-[color:var(--sg-color-primary)]" aria-hidden="true" />
                {copy.sensitivityResult}
              </h3>
              <StatusChip tone={runs.sensitivity.status === 'success' ? 'growth' : runs.sensitivity.status === 'error' ? 'critical' : 'muted'}>
                {getRunStatusLabel(runs.sensitivity.status)}
              </StatusChip>
            </div>
            {runs.sensitivity.error ? <p className="mt-3 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary-soft)] p-2 text-xs text-[color:var(--sg-color-primary-strong)]">{runs.sensitivity.error}</p> : null}
            {sensitivityRows.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--sg-text-muted)]">{copy.waiting}</p>
            ) : (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {sensitivityRows.map((row) => {
                  const control = String(row.control ?? '');
                  const meta = CONTROL_LABELS[control];
                  const derivative = readNumber(row, 'derivative');
                  const elasticity = readNumber(row, 'elasticity');
                  return (
                    <div key={control || JSON.stringify(row)} className="rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[color:var(--sg-text-strong)]">{meta ? (locale === 'ko' ? meta.ko : meta.en) : control}</p>
                        <StatusChip tone={row.direction === 'increase' ? 'growth' : row.direction === 'decrease' ? 'warning' : 'muted'}>{getDirectionLabel(row.direction, locale)}</StatusChip>
                      </div>
                      <div className="mt-3 rounded-[var(--sg-radius-sm)] bg-white/78 px-3 py-2 shadow-[var(--sg-shadow-card)]">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-[color:var(--sg-text-muted)]">{copy.derivative}</span>
                          <span className="sg-data-number font-bold text-[color:var(--sg-text-strong)]">{formatSignedNumber(derivative, 4)}</span>
                        </div>
                        <div
                          className="mt-2 h-2.5 overflow-hidden rounded-full bg-[color:var(--sg-surface-raised)]"
                          aria-label={`${copy.derivative}: ${formatSignedNumber(derivative, 4)}, ${getDirectionLabel(row.direction, locale)}`}
                        >
                          <div
                            className={`h-full rounded-full ${row.direction === 'decrease' ? 'bg-[color:var(--sg-color-primary)]' : 'bg-[color:var(--sg-color-success)]'}`}
                            style={{ width: clampBarWidth(derivative, sensitivityVisualScale) }}
                          />
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.derivative}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{formatNumber(derivative, 4)}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.elasticity}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{formatNumber(elasticity, 4)}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.confidence}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{row.valid === false ? (locale === 'ko' ? '낮음' : 'low') : (locale === 'ko' ? '정상' : 'ok')}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
