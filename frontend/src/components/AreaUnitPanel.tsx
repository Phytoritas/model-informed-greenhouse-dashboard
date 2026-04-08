import type { CropType, RtrActualAreaProjection } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { getCropLabel } from '../utils/displayCopy';
import { parseAreaInput } from '../utils/areaUnits';

interface AreaUnitPanelProps {
    crop: CropType;
    canonicalAreaM2: number;
    actualAreaM2: number | null;
    actualAreaPyeong: number | null;
    projection: RtrActualAreaProjection | null;
    onActualAreaM2Change: (value: number | null) => void;
    onActualAreaPyeongChange: (value: number | null) => void;
}

const formatNumber = (value: number | null | undefined, digits = 1): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-';
    }
    return value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
};

const AreaUnitPanel = ({
    crop,
    canonicalAreaM2,
    actualAreaM2,
    actualAreaPyeong,
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
            projectionYieldDay: '총 수확량 / 일',
            projectionYieldWeek: '총 수확량 / 주',
            projectionEnergy: '총 에너지 / 일',
            projectionCost: '총 에너지 비용 / 일',
            projectionLabor: '총 작업부하 지수 / 일',
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
            projectionYieldDay: 'Projected yield / day',
            projectionYieldWeek: 'Projected yield / week',
            projectionEnergy: 'Projected energy / day',
            projectionCost: 'Projected energy cost / day',
            projectionLabor: 'Projected labor index / day',
            pyeongPlaceholder: 'e.g. 850',
            m2Placeholder: 'e.g. 2809.9',
            costUnit: 'KRW',
        };

    return (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3">
                <h4 className="text-sm font-semibold text-slate-900">{copy.title}</h4>
                <p className="mt-1 text-xs leading-5 text-slate-500">{copy.subtitle}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    <span>{copy.pyeong}</span>
                    <input
                        aria-label={copy.pyeong}
                        inputMode="decimal"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        value={actualAreaPyeong ?? ''}
                        onChange={(event) => onActualAreaPyeongChange(parseAreaInput(event.target.value))}
                        placeholder={copy.pyeongPlaceholder}
                    />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-600">
                    <span>{copy.m2}</span>
                    <input
                        aria-label={copy.m2}
                        inputMode="decimal"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                        value={actualAreaM2 ?? ''}
                        onChange={(event) => onActualAreaM2Change(parseAreaInput(event.target.value))}
                        placeholder={copy.m2Placeholder}
                    />
                </label>
            </div>

            <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-xs text-slate-600">
                <span className="font-medium text-slate-900">{copy.canonical}:</span>{' '}
                {formatNumber(canonicalAreaM2, 1)} m²
            </div>

            {projection ? (
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-white px-3 py-2">
                        <dt className="text-[11px] text-slate-500">{copy.projectionYieldDay}</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(projection.yield_kg_day, 1)} kg</dd>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                        <dt className="text-[11px] text-slate-500">{copy.projectionYieldWeek}</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(projection.yield_kg_week, 1)} kg</dd>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                        <dt className="text-[11px] text-slate-500">{copy.projectionEnergy}</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(projection.energy_kwh_day, 1)} kWh</dd>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2">
                        <dt className="text-[11px] text-slate-500">{copy.projectionCost}</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(projection.energy_krw_day, 0)} {copy.costUnit}</dd>
                    </div>
                    <div className="rounded-lg bg-white px-3 py-2 sm:col-span-2">
                        <dt className="text-[11px] text-slate-500">{copy.projectionLabor}</dt>
                        <dd className="mt-1 text-sm font-semibold text-slate-900">{formatNumber(projection.labor_index_day, 2)}</dd>
                    </div>
                </dl>
            ) : null}
        </section>
    );
};

export default AreaUnitPanel;
