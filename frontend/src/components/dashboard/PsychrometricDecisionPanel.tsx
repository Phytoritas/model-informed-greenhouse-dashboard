import { useId, useMemo } from 'react';
import { Droplets } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleTime } from '../../i18n/locale';
import type { SensorData, TelemetryStatus } from '../../types';
import ChartFrame from '../charts/ChartFrame';
import ScientificText from '../common/ScientificText';
import {
  calculatePsychrometrics,
  psychrometricsFromFrame,
  selectPsychrometricFrame,
  type PsychrometricState,
} from '../../utils/psychrometrics';

interface Props {
  history: SensorData[];
  telemetryStatus: TelemetryStatus;
  selectedTimestamp?: number | null;
}

function MoistAirDiagram({ state, ko, width }: { state: PsychrometricState; ko: boolean; width: number }) {
  const id = useId();
  const left = 50, right = Math.max(210, width - 30), top = 32, bottom = 239;
  const tickStep = width < 430 ? 10 : 5;
  const tMin = Math.max(0, Math.min(10, Math.floor((state.temperatureC - 12) / 5) * 5));
  const tMax = Math.min(50, Math.max(40, Math.ceil((state.temperatureC + 8) / 5) * 5));
  const wMax = Math.max(30, Math.ceil(state.humidityRatioGKg * 1.4 / 10) * 10);
  const x = (t: number) => left + (t - tMin) / (tMax - tMin) * (right - left);
  const y = (w: number) => bottom - w / wMax * (bottom - top);
  const px = x(state.temperatureC), py = y(state.humidityRatioGKg);
  const heatingStart = px + 7;
  const heatingEnd = x(Math.min(tMax - 0.5, state.temperatureC + 5));
  const curves = [20, 40, 60, 80, 100].map((rh) => {
    const points = Array.from({ length: 101 }, (_, i) => {
      const t = tMin + (tMax - tMin) * i / 100;
      return { t, w: calculatePsychrometrics(t, rh)!.humidityRatioGKg };
    });
    const label = [...points].reverse().find((p) => p.w < wMax * 0.92)!;
    return { rh, label, d: points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.w)}`).join(' ') };
  });
  const valueLabel = `${state.temperatureC.toFixed(1)}°C · ${state.relativeHumidityPercent.toFixed(1)}% RH`;
  return (
    <svg viewBox={`0 0 ${width} 280`} className="block h-full w-full" role="img"
      aria-label={ko ? `온도–수분량 습공기선도, ${valueLabel}. 곡선은 상대습도입니다.` : `Temperature–humidity ratio chart, ${valueLabel}. Curves show relative humidity.`}>
      <defs>
        <clipPath id={`${id}-clip`}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
        <marker id={`${id}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L8 4 L0 8" fill="none" stroke="var(--sg-color-primary)" strokeWidth="1.5" />
        </marker>
      </defs>
      <g fontSize="12" fill="var(--sg-text-muted)" fontFamily="inherit">
        <text x={left} y="17">{ko ? '수분량 (g/kg 건조공기)' : 'Water (g/kg dry air)'}</text>
        {Array.from({ length: 5 }, (_, i) => wMax * i / 4).map((w) => (
          <g key={w}>
            <line x1={left} x2={right} y1={y(w)} y2={y(w)} stroke="var(--sg-outline-soft)" />
            <text x={left - 10} y={y(w) + 4} textAnchor="end">{Number(w.toFixed(1))}</text>
          </g>
        ))}
        {Array.from({ length: Math.floor((tMax - tMin) / tickStep) + 1 }, (_, i) => tMin + tickStep * i).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={bottom} stroke="var(--sg-outline-soft)" />
            <text x={x(t)} y={bottom + 18} textAnchor="middle">{t}</text>
          </g>
        ))}
        <text x={(left + right) / 2} y="277" textAnchor="middle">{ko ? '온도 (°C)' : 'Temperature (°C)'}</text>
        <g clipPath={`url(#${id}-clip)`}>
          {curves.map(({ rh, d }) => <path key={rh} d={d} fill="none" stroke="var(--sg-text-faint)" strokeWidth={rh === 100 ? 1.5 : 1} strokeDasharray={rh === 100 ? undefined : '3 4'} />)}
          <line x1={px} x2={px} y1={py} y2={bottom} stroke="var(--sg-color-primary)" opacity="0.45" strokeDasharray="3 4" />
          {state.dewPointC !== null && state.dewPointC >= tMin ? (
            <line x1={x(state.dewPointC)} x2={px} y1={py} y2={py} stroke="var(--sg-color-primary)" opacity="0.6" strokeDasharray="3 4" />
          ) : null}
          {heatingEnd > heatingStart + 6 ? <line x1={heatingStart} x2={heatingEnd} y1={py} y2={py} stroke="var(--sg-color-primary)" strokeWidth="1.5" markerEnd={`url(#${id}-arrow)`} /> : null}
        </g>
        {curves.filter(({ rh }) => width >= 430 || rh % 40 === 20).map(({ rh, label }) => <text key={rh} x={x(label.t) - 5} y={y(label.w) - 5} textAnchor="end" fontSize="11">{rh}%</text>)}
        <circle cx={px} cy={py} r="5" fill="var(--sg-color-primary)" stroke="var(--sg-surface-raised)" strokeWidth="2" />
        <text x={Math.min(right - 4, Math.max(left + 4, px))} y={py < top + 25 ? py + 24 : py - 14}
          textAnchor={px > right - 120 ? 'end' : px < left + 100 ? 'start' : 'middle'} fill="var(--sg-text-strong)" fontWeight="700"
          stroke="var(--sg-surface-raised)" strokeWidth="4" paintOrder="stroke">{valueLabel}</text>
      </g>
    </svg>
  );
}

export default function PsychrometricDecisionPanel({ history, telemetryStatus, selectedTimestamp = null }: Props) {
  const { locale } = useLocale();
  const ko = locale === 'ko';
  const titleId = useId();
  const frame = useMemo(() => selectPsychrometricFrame(history, selectedTimestamp), [history, selectedTimestamp]);
  const state = useMemo(() => psychrometricsFromFrame(frame), [frame]);
  const replay = selectedTimestamp !== null;
  const current = telemetryStatus === 'live' || telemetryStatus === 'delayed';
  const canopy = state && frame && frame.fieldAvailability?.canopyTemp !== false && Number.isFinite(frame.canopyTemp) ? frame.canopyTemp : null;
  const margin = canopy !== null && state?.dewPointC !== null && state?.dewPointC !== undefined ? canopy - state.dewPointC : null;
  const number = (value: number | null | undefined, digits = 1) => value === null || value === undefined ? '—' : value.toFixed(digits);
  const quantities = [
    { label: ko ? '이슬점' : 'Dew point', value: number(state?.dewPointC), unit: '°C' },
    { label: ko ? '공기 VPD · 계산' : 'Air VPD · calculated', value: number(state?.vpdKPa, 2), unit: 'kPa' },
    { label: ko ? '수분량' : 'Humidity ratio', value: number(state?.humidityRatioGKg), unit: ko ? 'g/kg 건조공기' : 'g/kg dry air' },
    { label: ko ? '엔탈피' : 'Enthalpy', value: number(state?.enthalpyKJkg), unit: ko ? 'kJ/kg 건조공기' : 'kJ/kg dry air' },
  ];
  return (
    <section className="sg-panel min-w-0 bg-[color:var(--sg-surface-raised)] p-4" aria-labelledby={titleId} data-testid="psychrometric-decision-panel">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={titleId} className="flex items-center gap-2 text-base font-bold text-[color:var(--sg-text-strong)]"><Droplets className="h-4 w-4 text-[color:var(--sg-color-primary)]" aria-hidden="true" />{ko ? '습공기 의사결정' : 'Moist-air decisions'}</h3>
          <p className="mt-1 text-sm text-[color:var(--sg-text-muted)]">{ko ? '온도–수분량 선도 · 상대습도 곡선으로 현재 위치를 읽습니다.' : 'Temperature–humidity ratio chart with relative-humidity curves.'}</p>
        </div>
        <span className="text-xs text-[color:var(--sg-text-muted)]">{replay ? (ko ? '선택 시점' : 'Replay') : current ? (ko ? '최신 입력' : 'Latest input') : (ko ? '마지막 기록 · 수신 상태 확인' : 'Last record · check connection')}{frame ? ` · ${formatLocaleTime(locale, frame.timestamp, { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
      </div>
      {state ? (
        <div className="mt-3 grid min-w-0 gap-4 lg:grid-cols-[1.15fr_1fr]">
          <div className="min-w-0">
            <ChartFrame minHeight={280} style={{ height: 280 }}>
              {({ width }) => <MoistAirDiagram state={state} ko={ko} width={width} />}
            </ChartFrame>
            <p className="mt-1 text-center text-xs text-[color:var(--sg-text-muted)]">{ko ? '→ 가열 방향 · 수분량이 유지되는 경우' : '→ Heating direction · constant humidity ratio'}</p>
          </div>
          <div className="min-w-0 space-y-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {quantities.map((q) => <div key={q.label}><dt className="text-xs text-[color:var(--sg-text-muted)]">{q.label}</dt><dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5"><strong className="text-xl tabular-nums text-[color:var(--sg-text-strong)]">{q.value}</strong><ScientificText text={q.unit} className="scientific-unit text-xs text-[color:var(--sg-text-muted)]" /></dd></div>)}
            </dl>
            <div className="border-t border-[color:var(--sg-outline-soft)] pt-3 text-sm leading-6 text-[color:var(--sg-text)]">
              {margin !== null ? <p>{ko ? '군락 온도 − 이슬점' : 'Canopy temperature − dew point'} <strong className="tabular-nums">{margin > 0 ? '+' : ''}{margin.toFixed(1)}°C</strong>{ko ? ' · 군락 온도 계산값 기준' : ' · using modeled canopy temperature'}</p> : null}
              <p>{!current && !replay ? (ko ? '갱신된 온도·습도를 확인한 뒤 현재 상태를 판단하세요.' : 'Confirm updated temperature and humidity before assessing current conditions.')
                : margin !== null && margin <= 0 ? (ko ? '계산된 군락 온도가 이슬점 이하입니다. 잎 표면의 실제 온도와 젖음 여부를 확인하세요.' : 'Modeled canopy temperature is at or below dew point. Check leaf surface temperature and wetness.')
                : (ko ? '표면 온도가 이슬점 이하로 내려가면 결로가 생길 수 있습니다.' : 'Condensation can occur when a surface cools to or below dew point.')}</p>
            </div>
            {/* The reading stays short; the interpretation notes and the
                pressure assumption sit one click away but remain on the page. */}
            <details className="psychro-notes border-t border-[color:var(--sg-outline-soft)] pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-[color:var(--sg-text)]">{ko ? '해석과 계산 가정' : 'Interpretation and assumptions'}</summary>
              <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">{ko ? '가열은 상대습도를 낮추지만 수분을 제거하지 않습니다. 환기의 제습 효과는 외기 수분량과 함께 판단하세요.' : 'Heating lowers relative humidity without removing water. Ventilation drying depends on outdoor humidity ratio.'}</p>
              <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">{ko ? '온습도 입력에서 계산 · 0°C 미만 이슬점은 액체 물 기준 근사' : 'Calculated from temperature/RH · subzero dew points use a liquid-water approximation'}</p>
            </details>
          </div>
        </div>
      ) : <p className="py-7 text-sm text-[color:var(--sg-text-muted)]">{ko ? '이 시점의 유효한 온도·습도 입력이 필요합니다. 표시 계산 범위는 0–50°C, 상대습도 0–100%입니다.' : 'Valid temperature and humidity are needed at this time. Calculation range: 0–50°C, 0–100% RH.'}</p>}
      {/* The pressure assumption stays visible without opening anything: every
          number above is only valid at this pressure. */}
      <p className="mt-3 border-t border-[color:var(--sg-outline-soft)] pt-2 text-xs leading-5 text-[color:var(--sg-text-faint)]">{ko ? '대기압 101.325 kPa 가정' : 'Assumed pressure 101.325 kPa'}</p>
    </section>
  );
}
