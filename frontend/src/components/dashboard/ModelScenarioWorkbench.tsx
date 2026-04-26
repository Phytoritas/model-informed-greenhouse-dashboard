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
  co2_setpoint_day: { ko: 'CO2', en: 'CO2', unit: 'ppm' },
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
  const scenarioYield = readNumber(output, 'yield_pred');
  const baselineYield = baseline ? readNumber(baseline, 'yield_pred') : null;
  if (scenarioYield === null || baselineYield === null || Math.abs(baselineYield) <= 1e-9) {
    return '-';
  }
  const percent = ((scenarioYield - baselineYield) / baselineYield) * 100;
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
}

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? '-' : value.toFixed(digits);
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
        eyebrow: 'Process Model What-if',
        title: '과정기반모델 시나리오',
        description: '현재 또는 저장된 모델 스냅샷을 기준으로 온도, CO2, 상대습도 변경량을 넣어 수량·에너지·소스/싱크 변화를 계산합니다.',
        snapshot: '스냅샷 생성',
        runScenario: 'What-if 실행',
        runSensitivity: '편미분 계산',
        noSnapshot: 'live snapshot',
        horizon: '검토 기간',
        sensitivityTarget: '편미분 대상',
        inputs: '현재 대비 변경량',
        scenarioResult: '시나리오 결과',
        sensitivityResult: '편미분 결과',
        yieldDelta: '수량 변화',
        yield: '예상 수량',
        energyDelta: '에너지 변화',
        balanceDelta: '소스/싱크 변화',
        confidence: '신뢰도',
        derivative: '편미분',
        elasticity: '탄력도',
        direction: '방향',
        waiting: '아직 실행 결과가 없습니다.',
        backendNote: '현재 백엔드는 날짜 범위 대신 horizon과 현재 대비 delta를 사용합니다.',
      }
    : {
        eyebrow: 'Process Model What-if',
        title: 'Process-model scenarios',
        description: 'Run temperature, CO2, RH, and screen deltas against the current or saved model snapshot and compare yield, energy, and source-sink response.',
        snapshot: 'Create snapshot',
        runScenario: 'Run what-if',
        runSensitivity: 'Run partials',
        noSnapshot: 'live snapshot',
        horizon: 'Horizon',
        sensitivityTarget: 'Derivative target',
        inputs: 'Delta from current',
        scenarioResult: 'Scenario result',
        sensitivityResult: 'Partial derivatives',
        yieldDelta: 'Yield change',
        yield: 'Yield',
        energyDelta: 'Energy change',
        balanceDelta: 'Source/sink change',
        confidence: 'Confidence',
        derivative: 'Derivative',
        elasticity: 'Elasticity',
        direction: 'Direction',
        waiting: 'No scenario result yet.',
        backendNote: 'The current backend uses horizon and deltas, not calendar date ranges.',
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
  const normalizedControls: ModelScenarioControls = {
    temperature_day: toNumber(controls.temperature_day),
    temperature_night: toNumber(controls.temperature_night),
    co2_setpoint_day: toNumber(controls.co2_setpoint_day),
    rh_target: toNumber(controls.rh_target),
    screen_close: toNumber(controls.screen_close),
  };
  const isBusy = runs.snapshot.status === 'loading' || runs.scenario.status === 'loading' || runs.sensitivity.status === 'loading';

  return (
    <section className="sg-panel bg-[color:var(--sg-surface-raised)] p-4" aria-labelledby="model-scenario-title">
      <header className="flex flex-col gap-3 border-b border-[color:var(--sg-outline-soft)] pb-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="sg-eyebrow">{copy.eyebrow}</p>
          <h2 id="model-scenario-title" className="mt-1 text-xl font-bold text-[color:var(--sg-text-strong)]">{copy.title}</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[color:var(--sg-text-muted)]">{copy.description}</p>
        </div>
        <StatusChip tone={latestSnapshotId ? 'growth' : 'stable'}>{latestSnapshotId ?? copy.noSnapshot}</StatusChip>
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="sg-panel bg-white p-3">
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
                    aria-label={`${locale === 'ko' ? meta.ko : meta.en} delta`}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="sg-panel bg-white p-3">
            <label className="text-xs font-semibold text-[color:var(--sg-text-muted)]">
              <span>{copy.horizon}</span>
              <Select className="mt-1" value={horizon} onChange={(event) => setHorizon(event.target.value)} aria-label={copy.horizon}>
                <option value="24">24h</option>
                <option value="72">72h</option>
                <option value="168">7d</option>
                <option value="336">14d</option>
              </Select>
            </label>
            <label className="mt-3 block text-xs font-semibold text-[color:var(--sg-text-muted)]">
              <span>{copy.sensitivityTarget}</span>
              <Select className="mt-1" value={target} onChange={(event) => setTarget(event.target.value)} aria-label={copy.sensitivityTarget}>
                {SENSITIVITY_TARGETS.map((value) => <option key={value} value={value}>{value}</option>)}
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
          <article className="sg-panel bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-[color:var(--sg-text-strong)]">
                <Activity className="h-4 w-4 text-[color:var(--sg-color-success)]" aria-hidden="true" />
                {copy.scenarioResult}
              </h3>
              <StatusChip tone={runs.scenario.status === 'success' ? 'growth' : runs.scenario.status === 'error' ? 'critical' : 'muted'}>
                {runs.scenario.status}
              </StatusChip>
            </div>
            {runs.scenario.error ? <p className="mt-3 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary-soft)] p-2 text-xs text-[color:var(--sg-color-primary-strong)]">{runs.scenario.error}</p> : null}
            {scenarioRows.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--sg-text-muted)]">{copy.waiting}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="text-[color:var(--sg-text-muted)]">
                    <tr className="border-b border-[color:var(--sg-outline-soft)]">
                      <th className="px-2 py-2">Horizon</th>
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
                        <td className="px-2 py-2 font-semibold">{formatNumber(readNumber(row, 'horizon_hours'), 0)}h</td>
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
            )}
          </article>

          <article className="sg-panel bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-bold text-[color:var(--sg-text-strong)]">
                <Sigma className="h-4 w-4 text-[color:var(--sg-color-primary)]" aria-hidden="true" />
                {copy.sensitivityResult}
              </h3>
              <StatusChip tone={runs.sensitivity.status === 'success' ? 'growth' : runs.sensitivity.status === 'error' ? 'critical' : 'muted'}>
                {runs.sensitivity.status}
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
                  return (
                    <div key={control || JSON.stringify(row)} className="rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[color:var(--sg-text-strong)]">{meta ? (locale === 'ko' ? meta.ko : meta.en) : control}</p>
                        <StatusChip tone={row.direction === 'increase' ? 'growth' : row.direction === 'decrease' ? 'warning' : 'muted'}>{String(row.direction ?? '-')}</StatusChip>
                      </div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.derivative}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{formatNumber(readNumber(row, 'derivative'), 4)}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.elasticity}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{formatNumber(readNumber(row, 'elasticity'), 4)}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.confidence}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{row.valid === false ? 'low' : 'ok'}</dd>
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
