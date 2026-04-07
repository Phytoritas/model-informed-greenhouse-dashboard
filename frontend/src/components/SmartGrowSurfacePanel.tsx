import { useState } from 'react';
import { FlaskConical, ShieldCheck, TestTubeDiagonal } from 'lucide-react';
import type { CropType } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { getCropLabel } from '../utils/displayCopy';
import type {
    SmartGrowAdvisorySurfaceSummary,
    SmartGrowKnowledgeSummary,
} from '../hooks/useSmartGrowKnowledge';

interface SmartGrowSurfacePanelProps {
    crop: CropType;
    summary?: SmartGrowKnowledgeSummary | null;
    loading?: boolean;
    error?: string | null;
}

const SURFACE_ICON = {
    pesticide: ShieldCheck,
    nutrient: FlaskConical,
    nutrient_correction: TestTubeDiagonal,
} as const;

function getSurfaceAccent(
    surfaceKey: SmartGrowAdvisorySurfaceSummary['key'],
    ready: boolean,
) {
    if (!ready) {
        return {
            button: 'border-slate-200 bg-slate-50 text-slate-500',
            badge: 'bg-slate-100 text-slate-600',
        };
    }

    switch (surfaceKey) {
        case 'pesticide':
            return {
                button: 'border-emerald-200 bg-emerald-50 text-emerald-800',
                badge: 'bg-emerald-100 text-emerald-700',
            };
        case 'nutrient':
            return {
                button: 'border-sky-200 bg-sky-50 text-sky-800',
                badge: 'bg-sky-100 text-sky-700',
            };
        default:
            return {
                button: 'border-violet-200 bg-violet-50 text-violet-800',
                badge: 'bg-violet-100 text-violet-700',
            };
    }
}

const SmartGrowSurfacePanel = ({
    crop,
    summary = null,
    loading = false,
    error = null,
}: SmartGrowSurfacePanelProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            title: '스마트그로우 권장 구성',
            subtitle: `${cropLabel} 기준 결정형 권장 계약을 정리합니다.`,
            loading: '스마트그로우 권장 구성을 불러오는 중...',
            unavailable: '스마트그로우 권장 구성을 아직 불러오지 못했습니다.',
            pendingParser: '일부 PDF 파서는 아직 준비 중입니다.',
            route: '경로',
            required: '필수',
            optional: '선택',
            stages: '생육 단계',
            mediums: '배지',
            sourceWater: '원수',
            drainWater: '배액',
            fertilizers: '비료',
            draftMode: '초안 모드',
            macroBundle: '매크로 번들',
            limitation: '제약',
            ready: '준비됨',
            unavailableStatus: '미준비',
            empty: '표시할 스마트그로우 권장 구성이 아직 없습니다.',
            pesticide: '농약 후보',
            nutrient: '양액 레시피',
            nutrientCorrection: '양액 보정',
        }
        : {
            title: 'SmartGrow Advisory Surfaces',
            subtitle: `Deterministic advisory contract for ${cropLabel}.`,
            loading: 'Loading SmartGrow surface contract...',
            unavailable: 'SmartGrow surface contract is unavailable.',
            pendingParser: 'Some PDF parsers are still pending.',
            route: 'Route',
            required: 'Required',
            optional: 'Optional',
            stages: 'Stages',
            mediums: '배지',
            sourceWater: 'Source water',
            drainWater: 'Drain water',
            fertilizers: 'Fertilizers',
            draftMode: 'Draft mode',
            macroBundle: 'Macro bundle',
            limitation: 'Boundary',
            ready: 'Ready',
            unavailableStatus: 'Unavailable',
            empty: 'No SmartGrow surface is available yet.',
            pesticide: 'Pesticide lookup',
            nutrient: 'Nutrient recipe',
            nutrientCorrection: 'Nutrient correction',
        };

    const surfaces = summary?.surfaces ?? [];
    const [selectedSurfaceKey, setSelectedSurfaceKey] = useState<
        SmartGrowAdvisorySurfaceSummary['key'] | null
    >(null);

    const activeSurfaceKey =
        selectedSurfaceKey && surfaces.some((surface) => surface.key === selectedSurfaceKey)
            ? selectedSurfaceKey
            : (surfaces.find((surface) => surface.status === 'ready') ?? surfaces[0] ?? null)?.key
            ?? null;

    const activeSurface =
        surfaces.find((surface) => surface.key === activeSurfaceKey) ?? surfaces[0] ?? null;

    const labels = {
        pesticide: copy.pesticide,
        nutrient: copy.nutrient,
        nutrient_correction: copy.nutrientCorrection,
    } as const;

    return (
        <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                        {copy.title}
                    </div>
                    <h2 className="mt-2 text-xl font-semibold text-slate-900">{cropLabel}</h2>
                    <p className="mt-1 text-sm text-slate-500">{copy.subtitle}</p>
                </div>
                {summary?.pendingParsers.includes('pdf') ? (
                    <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        {copy.pendingParser}
                    </div>
                ) : null}
            </div>

            {loading ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    {copy.loading}
                </div>
            ) : error ? (
                <div className="mt-6 rounded-xl border border-rose-100 bg-rose-50 px-4 py-10 text-center text-sm text-rose-700">
                    {copy.unavailable}
                </div>
            ) : surfaces.length === 0 || !activeSurface ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    {copy.empty}
                </div>
            ) : (
                <>
                    <div className="mt-6 grid gap-3 lg:grid-cols-3">
                        {surfaces.map((surface) => {
                            const Icon = SURFACE_ICON[surface.key];
                            const isActive = surface.key === activeSurface.key;
                            const ready = surface.status === 'ready';
                            const accent = getSurfaceAccent(surface.key, ready);

                            return (
                                <button
                                    key={surface.key}
                                    type="button"
                                    onClick={() => setSelectedSurfaceKey(surface.key)}
                                    className={`rounded-2xl border p-4 text-left transition-colors ${accent.button} ${isActive ? 'ring-2 ring-offset-2 ring-slate-200' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="rounded-xl bg-white/80 p-2 text-slate-700 shadow-sm">
                                                <Icon className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold">
                                                    {labels[surface.key]}
                                                </div>
                                                <div className="mt-1 text-xs text-slate-500">
                                                    {surface.route ?? 'n/a'}
                                                </div>
                                            </div>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${accent.badge}`}>
                                            {ready ? copy.ready : copy.unavailableStatus}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50 p-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900">
                                    {labels[activeSurface.key]}
                                </h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    {copy.route}: <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-700">{activeSurface.route ?? 'n/a'}</code>
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {activeSurface.draftMode ? (
                                    <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                                        {copy.draftMode}: {activeSurface.draftMode}
                                    </span>
                                ) : null}
                                {activeSurface.macroBundleMode ? (
                                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-700">
                                        {copy.macroBundle}: {activeSurface.macroBundleMode}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                        {copy.required}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {activeSurface.requiredFields.map((field) => (
                                            <span
                                                key={field}
                                                className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                                            >
                                                {field}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {activeSurface.optionalFields.length > 0 ? (
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {copy.optional}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {activeSurface.optionalFields.map((field) => (
                                                <span
                                                    key={field}
                                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                                                >
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {activeSurface.limitation ? (
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {copy.limitation}
                                        </div>
                                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                            {activeSurface.limitation}
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            <div className="space-y-4">
                                {activeSurface.stages.length > 0 ? (
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {copy.stages}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {activeSurface.stages.map((value) => (
                                                <span
                                                    key={value}
                                                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 shadow-sm"
                                                >
                                                    {value}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {activeSurface.mediums.length > 0 ? (
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {copy.mediums}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {activeSurface.mediums.map((value) => (
                                                <span
                                                    key={value}
                                                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                                                >
                                                    {value}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {activeSurface.sourceWaterAnalytes.length > 0 ? (
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {copy.sourceWater}
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {activeSurface.sourceWaterAnalytes.join(', ')}
                                        </p>
                                    </div>
                                ) : null}

                                {activeSurface.drainWaterAnalytes.length > 0 ? (
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {copy.drainWater}
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {activeSurface.drainWaterAnalytes.join(', ')}
                                        </p>
                                    </div>
                                ) : null}

                                {activeSurface.fertilizerNames.length > 0 ? (
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                                            {copy.fertilizers}
                                        </div>
                                        <p className="mt-2 text-sm text-slate-600">
                                            {activeSurface.fertilizerNames.join(', ')}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
};

export default SmartGrowSurfacePanel;
