import { useMemo, useState } from 'react';
import { Activity, Calculator, Gauge, Sigma } from 'lucide-react';
import { useModelRuntimeWorkbench, type ModelScenarioControls } from '../../hooks/useModelRuntimeWorkbench';
import { useLocale } from '../../i18n/LocaleProvider';
import type { CropType } from '../../types';
import { getControlDisplayCopy } from '../../utils/displayCopy';
import { Button } from '../ui/button';
import ScientificText from '../common/ScientificText';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { StatusChip } from '../ui/status-chip';

interface ModelScenarioWorkbenchProps {
  crop: CropType;
}

const MODEL_SCENARIO_CONTROL_KEYS = [
  'temperature_day',
  'temperature_night',
  'co2_setpoint_day',
  'rh_target',
  'screen_close',
] as const;

/**
 * The backend returns heuristic relative-response indices, not calibrated harvest
 * mass or currency, so the visible labels stay comparative. The option values are
 * the canonical API keys and must not be renamed.
 */
const SENSITIVITY_TARGETS: readonly { value: string; ko: string; en: string }[] = [
  { value: 'predicted_yield_24h', ko: '생산 비교 지표 (24시간)', en: 'Production comparison index (24 h)' },
  { value: 'predicted_yield_72h', ko: '생산 비교 지표 (72시간)', en: 'Production comparison index (72 h)' },
  { value: 'predicted_yield_7d', ko: '생산 비교 지표 (7일)', en: 'Production comparison index (7 d)' },
  { value: 'predicted_yield_14d', ko: '생산 비교 지표 (14일)', en: 'Production comparison index (14 d)' },
  { value: 'source_sink_balance_72h', ko: '소스/싱크 균형 (72시간)', en: 'Source–sink balance (72 h)' },
  { value: 'energy_load_index_72h', ko: '에너지 비교 지표 (무차원)', en: 'Energy comparison index (dimensionless)' },
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

function deltaPct(
  output: Record<string, unknown>,
  baseline: Record<string, unknown> | undefined,
): number | null {
  const scenarioYield = readNumber(output, 'yield_pred');
  const baselineYield = baseline ? readNumber(baseline, 'yield_pred') : null;
  if (scenarioYield === null || baselineYield === null || Math.abs(baselineYield) <= 1e-9) {
    return null;
  }
  return ((scenarioYield - baselineYield) / baselineYield) * 100;
}

function formatSigned(value: number | null, digits: number): string {
  if (value === null) {
    return '-';
  }
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function formatHorizon(hours: number | null, locale: 'ko' | 'en'): string {
  if (hours === null) {
    return '-';
  }
  if (hours % 24 === 0 && hours >= 24) {
    const days = hours / 24;
    return locale === 'ko' ? `${days}일 후` : `after ${days} d`;
  }
  return locale === 'ko' ? `${hours}시간 후` : `after ${hours} h`;
}

function formatNumber(value: number | null, digits = 2): string {
  return value === null ? '-' : value.toFixed(digits);
}

export default function ModelScenarioWorkbench({ crop }: ModelScenarioWorkbenchProps) {
  const { locale } = useLocale();
  const {
    runs,
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
        eyebrow: '시나리오 비교',
        title: '설정을 바꾸면 어떻게 되는지 비교',
        description: '지금 설정을 기준안으로 두고 온도, CO2, 습도를 바꾼 비교안을 계산합니다. 기준안 대비 생산과 에너지가 어느 방향으로 움직이는지 비교합니다.',
        methodNote: '설정 변화의 상대 반응을 비교하는 모델 지표입니다. 실제 수확량이나 비용 금액이 아닙니다.',
        runScenario: '비교안 계산',
        runSensitivity: '민감도 계산',
        demoNote: '예시 데이터로 계산한 결과입니다.',
        horizon: '검토 기간',
        sensitivityTarget: '민감도 기준 지표',
        inputs: '기준안 대비 변경량',
        scenarioResult: '기준안 대비 비교안 결과',
        sensitivityResult: '어떤 설정이 가장 크게 움직이나',
        yieldDelta: '생산 비교 지표 변화',
        yield: '비교안 생산 비교 지표',
        baselineYield: '기준안 생산 비교 지표',
        energyDelta: '에너지 비교 지표 변화',
        balanceDelta: '소스/싱크 변화',
        confidence: '신뢰도',
        perUnit: '설정 1단위당 변화',
        elasticity: '상대 민감도',
        increase: '올리면 증가',
        decrease: '올리면 감소',
        flat: '거의 변화 없음',
        waiting: '아직 계산한 비교안이 없습니다. 변경량을 넣고 계산해 보세요.',
        running: '계산 중입니다...',
        failed: '계산에 실패했습니다',
        nextStep: '다음 단계',
        nextStepUp: '생산 비교 지표가 올라가는 방향입니다. 바로 적용하지 말고 현재 제약 조건과 입력값을 확인한 뒤, RTR 최적화 화면에서 온도 전략과 함께 비교하세요.',
        nextStepDown: '생산 비교 지표가 내려가는 방향입니다. 입력한 변경량과 현재 제약 조건을 다시 확인하고, RTR 최적화 화면에서 함께 비교하세요.',
        nextStepFlat: '기준안과 차이가 거의 없습니다. 입력값과 제약 조건이 맞는지 먼저 확인하세요.',
        strongest: '가장 민감한 설정',
      }
    : {
        eyebrow: 'Scenario comparison',
        title: 'Compare a candidate setting against the baseline',
        description: 'Keep the current setting as the baseline, apply temperature, CO2, and humidity changes, and compare which way production and energy move.',
        methodNote: 'These are model indices for comparing the relative response to a setting change. They are not harvested mass or a cost amount.',
        runScenario: 'Compare candidate',
        runSensitivity: 'Rank sensitivity',
        demoNote: 'Computed on example data.',
        horizon: 'Horizon',
        sensitivityTarget: 'Sensitivity target',
        inputs: 'Change from baseline',
        scenarioResult: 'Candidate vs baseline',
        sensitivityResult: 'Which setting moves the result most',
        yieldDelta: 'Production index change',
        yield: 'Candidate production index',
        baselineYield: 'Baseline production index',
        energyDelta: 'Energy index change',
        balanceDelta: 'Source–sink change',
        confidence: 'Confidence',
        perUnit: 'Change per unit of setting',
        elasticity: 'Relative sensitivity',
        increase: 'Raising it increases',
        decrease: 'Raising it decreases',
        flat: 'Little effect',
        waiting: 'No candidate computed yet. Enter changes and run the comparison.',
        running: 'Computing...',
        failed: 'The computation failed',
        nextStep: 'Next step',
        nextStepUp: 'The production index moves up. Do not apply it directly: check the current constraints and inputs, then compare it against the temperature strategy on the RTR screen.',
        nextStepDown: 'The production index moves down. Recheck the entered change and the current constraints, then compare on the RTR screen.',
        nextStepFlat: 'There is almost no difference from the baseline. Check that the inputs and constraints are correct first.',
        strongest: 'Most sensitive setting',
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

  const headlineDeltaPct = useMemo(() => {
    for (const { row, baseline } of scenarioRows) {
      const value = deltaPct(row, baseline);
      if (value !== null) {
        return value;
      }
    }
    return null;
  }, [scenarioRows]);

  const nextStepMessage = headlineDeltaPct === null
    ? null
    : headlineDeltaPct > 0.5
      ? copy.nextStepUp
      : headlineDeltaPct < -0.5
        ? copy.nextStepDown
        : copy.nextStepFlat;

  const strongestControl = useMemo(() => {
    let best: { label: string; value: number } | null = null;
    for (const row of sensitivityRows) {
      const derivative = readNumber(row, 'derivative');
      if (derivative === null) continue;
      if (!best || Math.abs(derivative) > Math.abs(best.value)) {
        best = { label: getControlDisplayCopy(String(row.control ?? ''), locale).compactLabel, value: derivative };
      }
    }
    return best;
  }, [sensitivityRows, locale]);

  const normalizedControls: ModelScenarioControls = {
    temperature_day: toNumber(controls.temperature_day),
    temperature_night: toNumber(controls.temperature_night),
    co2_setpoint_day: toNumber(controls.co2_setpoint_day),
    rh_target: toNumber(controls.rh_target),
    screen_close: toNumber(controls.screen_close),
  };
  const isBusy = runs.scenario.status === 'loading' || runs.sensitivity.status === 'loading';

  return (
    <section className="sg-panel bg-[color:var(--sg-surface-raised)] p-4" aria-labelledby="model-scenario-title">
      <header className="flex flex-col gap-3 border-b border-[color:var(--sg-outline-soft)] pb-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="sg-eyebrow">{copy.eyebrow}</p>
          <h2 id="model-scenario-title" className="mt-1 text-base font-bold text-[color:var(--sg-text-strong)]">{copy.title}</h2>
          {/* 'CO2' in the copy renders as CO₂ through the shared formatter. */}
          <p className="mt-1 max-w-4xl text-sm leading-6 text-[color:var(--sg-text-muted)]"><ScientificText text={copy.description} /></p>
          <p className="mt-2 max-w-4xl rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
            {copy.methodNote}
          </p>
        </div>
        <StatusChip tone="stable">{copy.demoNote}</StatusChip>
      </header>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="sg-panel bg-white p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--sg-text-strong)]">
              <Gauge className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
              {copy.inputs}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              {MODEL_SCENARIO_CONTROL_KEYS.map((key) => {
                const controlCopy = getControlDisplayCopy(key, locale);
                return (
                  <label key={key} className="text-xs font-semibold text-[color:var(--sg-text-muted)]">
                    <span>
                      <ScientificText text={controlCopy.compactLabel} />
                      {controlCopy.unit ? <> (<ScientificText text={controlCopy.unit} className="scientific-unit" />)</> : null}
                    </span>
                    <Input
                      className="mt-1"
                      type="number"
                      step={key === 'co2_setpoint_day' ? 10 : 0.1}
                      value={controls[key as keyof typeof controls]}
                      onChange={(event) => setControls((current) => ({ ...current, [key]: event.target.value }))}
                      aria-label={`${controlCopy.compactLabel} delta`}
                    />
                  </label>
                );
              })}
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
                {SENSITIVITY_TARGETS.map((option) => (
                  <option key={option.value} value={option.value}>{locale === 'ko' ? option.ko : option.en}</option>
                ))}
              </Select>
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
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
                  controls: [...MODEL_SCENARIO_CONTROL_KEYS],
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
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                <Activity className="h-4 w-4 text-[color:var(--sg-color-success)]" aria-hidden="true" />
                {copy.scenarioResult}
              </h3>
              {runs.scenario.status === 'loading' ? <StatusChip tone="stable">{copy.running}</StatusChip> : null}
            </div>
            {runs.scenario.error ? (
              <p role="alert" className="mt-3 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary-soft)] p-2 text-xs text-[color:var(--sg-color-primary-strong)]">
                {copy.failed}: {runs.scenario.error}
              </p>
            ) : null}
            {scenarioRows.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--sg-text-muted)]">{copy.waiting}</p>
            ) : (
              <div className="mt-3 grid gap-3">
                {scenarioRows.map(({ row, baseline }, index) => {
                  const horizonHours = readNumber(row, 'horizon_hours');
                  const change = deltaPct(row, baseline);
                  const tone = change === null ? 'muted' : change > 0.5 ? 'growth' : change < -0.5 ? 'warning' : 'stable';
                  return (
                    <div
                      key={`${String(horizonHours ?? 'horizon')}-${index}`}
                      className="rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-bold text-[color:var(--sg-text-strong)]">
                          {formatHorizon(horizonHours, locale)}
                        </p>
                        <StatusChip tone={tone}>
                          {copy.yieldDelta} {formatSigned(change, 1)}%
                        </StatusChip>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.baselineYield}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">
                            {formatNumber(baseline ? readNumber(baseline, 'yield_pred') : null, 2)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.yield}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">
                            {formatNumber(readNumber(row, 'yield_pred'), 2)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.energyDelta}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">
                            {formatSigned(readNumber(row, 'energy_delta_vs_baseline'), 2)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.balanceDelta}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">
                            {formatSigned(readNumber(row, 'source_sink_balance_delta'), 2)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
                {nextStepMessage ? (
                  <div className="rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-white p-3">
                    <p className="sg-eyebrow">{copy.nextStep}</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--sg-text-strong)]">{nextStepMessage}</p>
                  </div>
                ) : null}
              </div>
            )}
          </article>

          <article className="sg-panel bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                <Sigma className="h-4 w-4 text-[color:var(--sg-color-primary)]" aria-hidden="true" />
                {copy.sensitivityResult}
              </h3>
              {runs.sensitivity.status === 'loading' ? <StatusChip tone="stable">{copy.running}</StatusChip> : null}
            </div>
            {runs.sensitivity.error ? (
              <p role="alert" className="mt-3 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary-soft)] p-2 text-xs text-[color:var(--sg-color-primary-strong)]">
                {copy.failed}: {runs.sensitivity.error}
              </p>
            ) : null}
            {sensitivityRows.length === 0 ? (
              <p className="mt-4 text-sm text-[color:var(--sg-text-muted)]">{copy.waiting}</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {strongestControl ? (
                  <p className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] p-2 text-xs leading-5 text-[color:var(--sg-text-strong)]">
                    <span className="font-bold">{copy.strongest}:</span> {strongestControl.label}
                  </p>
                ) : null}
                <div className="grid gap-2 md:grid-cols-2">
                {sensitivityRows.map((row) => {
                  const control = String(row.control ?? '');
                  const controlCopy = getControlDisplayCopy(control, locale);
                  const directionLabel = row.direction === 'increase'
                    ? copy.increase
                    : row.direction === 'decrease'
                      ? copy.decrease
                      : copy.flat;
                  return (
                    <div key={control || JSON.stringify(row)} className="rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-muted)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[color:var(--sg-text-strong)]">{controlCopy.compactLabel}</p>
                        <StatusChip tone={row.direction === 'increase' ? 'growth' : row.direction === 'decrease' ? 'warning' : 'muted'}>
                          {directionLabel}
                        </StatusChip>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.perUnit}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{formatSigned(readNumber(row, 'derivative'), 3)}</dd>
                        </div>
                        <div>
                          <dt className="text-[color:var(--sg-text-muted)]">{copy.elasticity}</dt>
                          <dd className="sg-data-number mt-1 font-bold text-[color:var(--sg-text-strong)]">{formatNumber(readNumber(row, 'elasticity'), 3)}</dd>
                        </div>
                      </dl>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
