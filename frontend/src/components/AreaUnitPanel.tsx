import type { CropType, RtrActualAreaProjection, RtrUnitsM2Projection } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { getCropLabel } from '../utils/displayCopy';
import { parseAreaInput } from '../utils/areaUnits';

interface AreaUnitPanelProps {
    crop: CropType;
    canonicalAreaM2: number;
    actualAreaM2: number | null;
    actualAreaPyeong: number | null;
    source: 'default' | 'server' | 'local';
    unitsM2: RtrUnitsM2Projection | null;
    projection: RtrActualAreaProjection | null;
    onActualAreaM2Change: (value: number | null) => void;
    onActualAreaPyeongChange: (value: number | null) => void;
}

const formatNumber = (value: number | null | undefined, digits = 1, locale: 'en' | 'ko' = 'ko'): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-';
    }
    return value.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const AreaUnitPanel = ({
    crop,
    canonicalAreaM2,
    actualAreaM2,
    actualAreaPyeong,
    source,
    unitsM2,
    projection,
    onActualAreaM2Change,
    onActualAreaPyeongChange,
}: AreaUnitPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            title: '실평수 환산',
            subtitle: `${getCropLabel(crop, locale)} 하우스 기준 총량 환산`,
            pyeong: '실평수',
            m2: '실면적 (m²)',
            canonical: '기준 면적',
            canonicalMetrics: 'm² 기준 지표',
            actualProjection: '실평수 총량 환산',
            sourceDefault: '실면적을 아직 입력하지 않았습니다. 서버 기본 면적을 받으면 자동으로 반영됩니다.',
            sourceServer: '현재는 서버에 저장된 하우스 기준 면적으로 총량을 환산하고 있습니다.',
            sourceLocal: '현재는 직접 입력한 실면적으로 총량을 환산하고 있습니다.',
            sourceChipDefault: '기본값 대기',
            sourceChipServer: '서버 기준',
            sourceChipLocal: '직접 입력',
            canonicalYieldDay: '수확량 / 일 (kg/m²/day)',
            canonicalYieldWeek: '수확량 / 주 (kg/m²/week)',
            canonicalEnergy: '에너지 / 일 (kWh/m²/day)',
            canonicalCost: '에너지 비용 / 일 (KRW/m²/day)',
            canonicalHeating: '난방 / 일 (kWh/m²/day)',
            canonicalCooling: '냉방 / 일 (kWh/m²/day)',
            canonicalLabor: '작업부하 / 일 (index/m²/day)',
            canonicalLaborHours: '작업시간 / 일 (h/m²/day)',
            canonicalLaborCost: '노동비 / 일 (KRW/m²/day)',
            canonicalNode: '마디 전개 / 일 (nodes/day)',
            canonicalMargin: '마진 추정 / 일 (KRW/m²/day)',
            projectionYieldDay: '총 수확량 / 일',
            projectionYieldWeek: '총 수확량 / 주',
            projectionEnergy: '총 에너지 / 일',
            projectionHeating: '총 난방 / 일',
            projectionCooling: '총 냉방 / 일',
            projectionCost: '총 에너지 비용 / 일',
            projectionLabor: '총 작업부하 지수 / 일',
            projectionLaborHours: '총 작업시간 / 일',
            projectionLaborCost: '총 노동비 / 일',
            projectionMargin: '총 마진 추정 / 일',
            pyeongPlaceholder: '예: 850',
            m2Placeholder: '예: 2809.9',
            costUnit: '원',
        }
        : {
            title: 'Actual area projection',
            subtitle: `Whole-house projection for ${getCropLabel(crop, locale)}`,
            pyeong: 'Actual area (pyeong)',
            m2: 'Actual area (m²)',
            canonical: 'Canonical area',
            canonicalMetrics: 'Per-m² canonical metrics',
            actualProjection: 'Whole-house projection',
            sourceDefault: 'Actual area is still empty. Server house area will hydrate automatically when available.',
            sourceServer: 'Whole-house totals currently use the server-stored house area.',
            sourceLocal: 'Whole-house totals currently use your manual area override.',
            sourceChipDefault: 'Awaiting area',
            sourceChipServer: 'Server area',
            sourceChipLocal: 'Manual area',
            canonicalYieldDay: 'Yield / day (kg/m²/day)',
            canonicalYieldWeek: 'Yield / week (kg/m²/week)',
            canonicalEnergy: 'Energy / day (kWh/m²/day)',
            canonicalCost: 'Energy cost / day (KRW/m²/day)',
            canonicalHeating: 'Heating / day (kWh/m²/day)',
            canonicalCooling: 'Cooling / day (kWh/m²/day)',
            canonicalLabor: 'Labor / day (index/m²/day)',
            canonicalLaborHours: 'Labor hours / day (h/m²/day)',
            canonicalLaborCost: 'Labor cost / day (KRW/m²/day)',
            canonicalNode: 'Node development / day (nodes/day)',
            canonicalMargin: 'Margin proxy / day (KRW/m²/day)',
            projectionYieldDay: 'Projected yield / day',
            projectionYieldWeek: 'Projected yield / week',
            projectionEnergy: 'Projected energy / day',
            projectionHeating: 'Projected heating / day',
            projectionCooling: 'Projected cooling / day',
            projectionCost: 'Projected energy cost / day',
            projectionLabor: 'Projected labor index / day',
            projectionLaborHours: 'Projected labor hours / day',
            projectionLaborCost: 'Projected labor cost / day',
            projectionMargin: 'Projected margin proxy / day',
            pyeongPlaceholder: 'e.g. 850',
            m2Placeholder: 'e.g. 2809.9',
            costUnit: 'KRW',
        };

    const sourceChipLabel = source === 'local'
        ? copy.sourceChipLocal
        : source === 'server'
            ? copy.sourceChipServer
            : copy.sourceChipDefault;
    const sourceDescription = source === 'local'
        ? copy.sourceLocal
        : source === 'server'
            ? copy.sourceServer
            : copy.sourceDefault;

    return (
        <section className="sg-warm-panel p-4">
            <div className="mb-3">
                <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.title}</h4>
                    <span className="sg-chip-neutral rounded-full px-2.5 py-1 text-[11px] font-medium">
                        {sourceChipLabel}
                    </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.subtitle}</p>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--sg-text-faint)]">{sourceDescription}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-[color:var(--sg-text-muted)]">
                    <span>{copy.pyeong}</span>
                    <input
                        aria-label={copy.pyeong}
                        inputMode="decimal"
                        className="sg-field-input"
                        value={actualAreaPyeong ?? ''}
                        onChange={(event) => onActualAreaPyeongChange(parseAreaInput(event.target.value))}
                        placeholder={copy.pyeongPlaceholder}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-[color:var(--sg-text-muted)]">
                    <span>{copy.m2}</span>
                    <input
                        aria-label={copy.m2}
                        inputMode="decimal"
                        className="sg-field-input"
                        value={actualAreaM2 ?? ''}
                        onChange={(event) => onActualAreaM2Change(parseAreaInput(event.target.value))}
                        placeholder={copy.m2Placeholder}
                    />
                </label>
            </div>

            <div className="mt-3 rounded-[20px] border border-[color:var(--sg-outline-soft)] bg-white/80 px-3 py-2 text-xs text-[color:var(--sg-text-muted)]">
                <span className="font-medium text-[color:var(--sg-text-strong)]">{copy.canonical}:</span>{' '}
                {formatNumber(canonicalAreaM2, 1, locale)} m²
            </div>

            {unitsM2 ? (
                <div className="mt-4">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--sg-text-faint)]">{copy.canonicalMetrics}</h5>
                    <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalYieldDay}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.yield_proxy_kg_m2_day, 3, locale)} kg</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalYieldWeek}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.yield_proxy_kg_m2_week, 3, locale)} kg</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalEnergy}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.energy_kwh_m2_day, 3, locale)} kWh</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalCost}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.energy_krw_m2_day, 0, locale)} {copy.costUnit}</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalHeating}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.heating_energy_kwh_m2_day, 3, locale)} kWh</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalCooling}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.cooling_energy_kwh_m2_day, 3, locale)} kWh</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalLabor}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.labor_index_m2_day, 3, locale)}</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalLaborHours}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.labor_hours_m2_day, 3, locale)} h</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalLaborCost}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.labor_cost_krw_m2_day, 0, locale)} {copy.costUnit}</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalNode}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.node_development_day, 3, locale)}</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.canonicalMargin}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(unitsM2.gross_margin_proxy_krw_m2_day, 0, locale)} {copy.costUnit}</dd>
                        </div>
                    </dl>
                </div>
            ) : null}

            {projection ? (
                <div className="mt-4">
                    <h5 className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--sg-text-faint)]">{copy.actualProjection}</h5>
                    <dl className="mt-2 grid gap-3 sm:grid-cols-2">
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionYieldDay}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.yield_kg_day, 1, locale)} kg</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionYieldWeek}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.yield_kg_week, 1, locale)} kg</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionEnergy}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.energy_kwh_day, 1, locale)} kWh</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionHeating}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.heating_energy_kwh_day, 1, locale)} kWh</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionCooling}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.cooling_energy_kwh_day, 1, locale)} kWh</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionCost}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.energy_krw_day, 0, locale)} {copy.costUnit}</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionLabor}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.labor_index_day, 2, locale)}</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionLaborHours}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.labor_hours_day, 2, locale)} h</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionLaborCost}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.labor_cost_krw_day, 0, locale)} {copy.costUnit}</dd>
                        </div>
                        <div className="sg-warm-subpanel px-3 py-2">
                            <dt className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.projectionMargin}</dt>
                            <dd className="mt-1 text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatNumber(projection.margin_krw_day, 0, locale)} {copy.costUnit}</dd>
                        </div>
                    </dl>
                </div>
            ) : null}
        </section>
    );
};

export default AreaUnitPanel;
