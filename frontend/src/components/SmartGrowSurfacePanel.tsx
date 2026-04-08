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
    onOpenSurface?: (surfaceKey: SmartGrowAdvisorySurfaceSummary['key']) => void;
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
            card: 'border-slate-200 bg-slate-50 text-slate-500',
            badge: 'bg-slate-100 text-slate-600',
        };
    }

    switch (surfaceKey) {
        case 'pesticide':
            return {
                card: 'border-emerald-200 bg-emerald-50 text-emerald-800',
                badge: 'bg-emerald-100 text-emerald-700',
            };
        case 'nutrient':
            return {
                card: 'border-sky-200 bg-sky-50 text-sky-800',
                badge: 'bg-sky-100 text-sky-700',
            };
        default:
            return {
                card: 'border-violet-200 bg-violet-50 text-violet-800',
                badge: 'bg-violet-100 text-violet-700',
            };
    }
}

const SmartGrowSurfacePanel = ({
    crop,
    summary = null,
    loading = false,
    error = null,
    onOpenSurface,
}: SmartGrowSurfacePanelProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            title: '스마트 제어 바로가기',
            subtitle: `${cropLabel} 재배에서 바로 실행할 수 있는 도구를 엽니다.`,
            loading: '스마트 제어 바로가기를 불러오는 중...',
            unavailable: '스마트 제어 바로가기를 아직 불러오지 못했습니다.',
            pendingParser: '일부 참고 문서는 아직 정리 중입니다.',
            ready: '준비됨',
            unavailableStatus: '미준비',
            empty: '표시할 스마트 제어 도구가 아직 없습니다.',
            pesticide: '농약 후보',
            nutrient: '양액 레시피',
            nutrientCorrection: '양액 보정',
            open: '도구 열기',
            unavailableAction: '준비 중',
            requiredInputs: '주요 입력',
            supportRange: '지원 범위',
            pesticideDescription: '병해충 후보와 교호 대안을 바로 확인합니다.',
            nutrientDescription: '작기와 배지 기준으로 양액 레시피를 확인합니다.',
            nutrientCorrectionDescription: '원수·배액을 입력해 양액 보정 초안을 계산합니다.',
        }
        : {
            title: 'SmartGrow Quick Actions',
            subtitle: `Open the live SmartGrow tools for ${cropLabel}.`,
            loading: 'Loading SmartGrow quick actions...',
            unavailable: 'SmartGrow quick actions are unavailable.',
            pendingParser: 'Some PDF parsers are still pending.',
            ready: 'Ready',
            unavailableStatus: 'Unavailable',
            empty: 'No SmartGrow tool is available yet.',
            pesticide: 'Pesticide lookup',
            nutrient: 'Nutrient recipe',
            nutrientCorrection: 'Nutrient correction',
            open: 'Open tool',
            unavailableAction: 'Unavailable',
            requiredInputs: 'Primary inputs',
            supportRange: 'Coverage',
            pesticideDescription: 'Open crop-safe pesticide candidates and rotation options.',
            nutrientDescription: 'Open the nutrient recipe reference for stage and medium.',
            nutrientCorrectionDescription: 'Open the bounded nutrient correction draft workflow.',
        };

    const surfaces = summary?.surfaces ?? [];
    const labels: Record<SmartGrowAdvisorySurfaceSummary['key'], string> = {
        pesticide: copy.pesticide,
        nutrient: copy.nutrient,
        nutrient_correction: copy.nutrientCorrection,
    };
    const descriptions: Record<SmartGrowAdvisorySurfaceSummary['key'], string> = {
        pesticide: copy.pesticideDescription,
        nutrient: copy.nutrientDescription,
        nutrient_correction: copy.nutrientCorrectionDescription,
    };

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
            ) : surfaces.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    {copy.empty}
                </div>
            ) : (
                <div className="mt-6 grid gap-3 lg:grid-cols-3">
                    {surfaces.map((surface) => {
                        const Icon = SURFACE_ICON[surface.key];
                        const ready = surface.status === 'ready';
                        const accent = getSurfaceAccent(surface.key, ready);
                        const inputCount = surface.requiredFields.length;
                        const coverageCount =
                            surface.key === 'nutrient_correction'
                                ? surface.sourceWaterAnalytes.length + surface.drainWaterAnalytes.length
                                : surface.stages.length + surface.mediums.length;

                        return (
                            <article
                                key={surface.key}
                                className={`rounded-2xl border p-4 ${accent.card}`}
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
                                                {descriptions[surface.key]}
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${accent.badge}`}>
                                        {ready ? copy.ready : copy.unavailableStatus}
                                    </span>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                                        {copy.requiredInputs} {inputCount}개
                                    </span>
                                    <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                                        {copy.supportRange} {coverageCount}개
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onOpenSurface?.(surface.key)}
                                    disabled={!ready || !onOpenSurface}
                                    className={`mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                                        ready && onOpenSurface
                                            ? 'bg-slate-900 text-white hover:bg-slate-800'
                                            : 'cursor-not-allowed bg-white/70 text-slate-400'
                                    }`}
                                >
                                    {ready ? copy.open : copy.unavailableAction}
                                </button>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default SmartGrowSurfacePanel;
