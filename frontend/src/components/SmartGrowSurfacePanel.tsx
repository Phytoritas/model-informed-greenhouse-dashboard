import { ArrowUpRight, FlaskConical, ShieldCheck, TestTubeDiagonal } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import type { SmartGrowKnowledgeSummary, SmartGrowAdvisorySurfaceSummary } from '../hooks/useSmartGrowKnowledge';
import type { CropType } from '../types';
import { getCropLabel } from '../utils/displayCopy';
import DashboardCard from './common/DashboardCard';

interface SmartGrowSurfacePanelProps {
    crop: CropType;
    summary?: SmartGrowKnowledgeSummary | null;
    loading?: boolean;
    error?: string | null;
    onOpenSurface?: (surfaceKey: SmartGrowAdvisorySurfaceSummary['key']) => void;
    layoutMode?: 'default' | 'compact';
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
            card: 'sg-tint-neutral text-[color:var(--sg-text-muted)]',
            badge: 'bg-white/90 text-[color:var(--sg-text-muted)]',
            button: 'bg-white/70 text-[color:var(--sg-text-faint)]',
        };
    }

    switch (surfaceKey) {
        case 'pesticide':
            return {
                card: 'sg-tint-green text-[color:var(--sg-text-strong)]',
                badge: 'bg-white/90 text-[color:var(--sg-accent-forest)]',
                button: 'bg-[color:var(--sg-accent-forest)] text-white',
            };
        case 'nutrient':
            return {
                card: 'sg-tint-blue text-[color:var(--sg-text-strong)]',
                badge: 'bg-white/90 text-[color:var(--sg-accent-blue)]',
                button: 'bg-[color:var(--sg-accent-blue)] text-white',
            };
        default:
            return {
                card: 'sg-tint-violet text-[color:var(--sg-text-strong)]',
                badge: 'bg-white/90 text-[color:var(--sg-accent-violet)]',
                button: 'bg-[color:var(--sg-accent-violet)] text-white',
            };
    }
}

function LauncherStatPill({
    label,
    value,
}: {
    label: string;
    value: string | number;
}) {
    return (
        <div
            className="min-w-0 rounded-[var(--sg-radius-md)] bg-white/84 px-3 py-2"
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                {label}
            </div>
            <div className="sg-data-number mt-1 text-sm font-bold text-[color:var(--sg-text-strong)]">
                {value}
            </div>
        </div>
    );
}

export default function SmartGrowSurfacePanel({
    crop,
    summary = null,
    loading = false,
    error = null,
    onOpenSurface,
    layoutMode = 'default',
}: SmartGrowSurfacePanelProps) {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            title: '바로 실행 도구',
            subtitle: `${cropLabel} 운영에서 바로 실행할 수 있는 안전 계산기와 추천 도구입니다.`,
            loading: '바로 실행 도구를 불러오는 중입니다...',
            unavailable: '도구 정보를 아직 불러오지 못했습니다.',
            pendingParser: '일부 참고 문서 파싱이 아직 진행 중입니다.',
            ready: '준비됨',
            unavailableStatus: '대기',
            empty: '아직 연결된 도구가 없습니다.',
            pesticide: '농약 검토',
            nutrient: '양액 레시피',
            nutrientCorrection: '양액 보정',
            open: '도구 열기',
            openNow: '바로 열기',
            unavailableAction: '준비 중',
            requiredInputs: '필수 입력',
            optionalInputs: '보조 입력',
            supportRange: '지원 범위',
            readyCount: '준비 완료',
            pendingCount: '대기 중',
            parserCount: '파서 대기',
            readyLead: '지금 바로 실행할 수 있는 도구가 먼저 보이도록 배치했습니다.',
            pendingLead: '입력 조건이나 문서 연결이 더 필요한 운영 화면만 따로 표시합니다.',
            parserLead: '자료 정리가 끝나면 설명 범위가 더 넓어집니다.',
            pesticideDescription: '등록 우선 농약 후보와 교호 사용 순서를 바로 검토합니다.',
            nutrientDescription: '작기와 배지 조건에 맞는 양액 기준을 확인합니다.',
            nutrientCorrectionDescription: '원수와 배액 입력을 바탕으로 보정 초안을 계산합니다.',
            featuredSurface: '지금 가장 바로 쓰기 좋은 도구',
            supportingSurface: '함께 볼 도구',
            limitation: '제약',
            draftMode: '초안 모드',
            macroMode: '매크로 모드',
            pendingHint: '입력 조건이 아직 부족합니다.',
            readyHint: '즉시 계산을 열 수 있습니다.',
        }
        : {
            title: 'Quick operating tools',
            subtitle: `Open the bounded operating tools for ${cropLabel}.`,
            loading: 'Loading quick operating tools...',
            unavailable: 'Tool information is unavailable.',
            pendingParser: 'Some source documents are still being parsed.',
            ready: 'Ready',
            unavailableStatus: 'Pending',
            empty: 'No tool is available yet.',
            pesticide: 'Pesticide review',
            nutrient: 'Nutrient recipe',
            nutrientCorrection: 'Nutrient correction',
            open: 'Open tool',
            openNow: 'Open now',
            unavailableAction: 'Pending',
            requiredInputs: 'Required inputs',
            optionalInputs: 'Optional inputs',
            supportRange: 'Coverage',
            readyCount: 'Ready',
            pendingCount: 'Pending',
            parserCount: 'Parser pending',
            readyLead: 'The launcher now puts the tools you can use immediately first.',
            pendingLead: 'Only operating screens that still need inputs or source links stay in the support lane.',
            parserLead: 'Coverage expands after document preparation finishes.',
            pesticideDescription: 'Review registered-first pesticide candidates and rotation order.',
            nutrientDescription: 'Check the nutrient reference for crop stage and substrate.',
            nutrientCorrectionDescription: 'Compute a bounded correction draft from source and drain water inputs.',
            featuredSurface: 'Best tool to open now',
            supportingSurface: 'Supporting tools',
            limitation: 'Limitation',
            draftMode: 'Draft mode',
            macroMode: 'Macro mode',
            pendingHint: 'Input conditions are still incomplete.',
            readyHint: 'You can open this calculation immediately.',
        };

    const surfaces = summary?.surfaces ?? [];
    const readyCount = surfaces.filter((surface) => surface.status === 'ready').length;
    const pendingCount = surfaces.filter((surface) => surface.status === 'pending').length;
    const parserPendingCount = summary?.pendingParsers.length ?? 0;
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
    const orderedSurfaces = [...surfaces].sort((left, right) => {
        const leftReady = left.status === 'ready' ? 1 : 0;
        const rightReady = right.status === 'ready' ? 1 : 0;
        return rightReady - leftReady;
    });
    const featuredSurface = orderedSurfaces[0] ?? null;
    const supportingSurfaces = orderedSurfaces.slice(1);
    const isCompact = layoutMode === 'compact';

    return (
        <DashboardCard
            eyebrow={copy.title}
            title={cropLabel}
            description={copy.subtitle}
            className="sg-tint-neutral"
            actions={summary?.pendingParsers.includes('pdf') ? (
                <div className="rounded-full px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-amber)] sg-tint-amber">
                    {copy.pendingParser}
                </div>
            ) : null}
        >
            {loading ? (
                <div
                    className="rounded-[var(--sg-radius-lg)] bg-white/82 px-4 py-6 text-center text-sm text-[color:var(--sg-text-muted)]"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    {copy.loading}
                </div>
            ) : error ? (
                <div className="rounded-[var(--sg-radius-lg)] px-4 py-6 text-center text-sm text-[color:var(--sg-accent-amber)] sg-tint-amber">
                    {copy.unavailable}: {error}
                </div>
            ) : surfaces.length === 0 ? (
                <div
                    className="rounded-[var(--sg-radius-lg)] bg-white/82 px-4 py-6 text-center text-sm text-[color:var(--sg-text-muted)]"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    {copy.empty}
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                        <div
                            className="min-w-0 rounded-[var(--sg-radius-md)] px-3 py-2.5 sg-tint-green"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {copy.readyCount}
                            </div>
                            <div className="mt-1 flex items-baseline justify-between gap-2">
                                <span className="sg-data-number text-lg font-bold leading-none text-[color:var(--sg-text-strong)]">
                                    {readyCount}
                                </span>
                                {featuredSurface ? (
                                    <span className="truncate text-[11px] font-semibold text-[color:var(--sg-accent-forest)]">
                                        {labels[featuredSurface.key]}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <div
                            className="min-w-0 rounded-[var(--sg-radius-md)] px-3 py-2.5 sg-tint-blue"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {copy.pendingCount}
                            </div>
                            <div className="sg-data-number mt-1 text-lg font-bold leading-none text-[color:var(--sg-text-strong)]">
                                {pendingCount}
                            </div>
                        </div>
                        <div
                            className="min-w-0 rounded-[var(--sg-radius-md)] px-3 py-2.5 sg-tint-amber"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {copy.parserCount}
                            </div>
                            <div className="sg-data-number mt-1 text-lg font-bold leading-none text-[color:var(--sg-text-strong)]">
                                {parserPendingCount}
                            </div>
                        </div>
                    </div>

                    {featuredSurface ? (
                        <div className={`grid gap-2 ${isCompact ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1.28fr)_minmax(0,0.92fr)]'}`}>
                            {(() => {
                                const Icon = SURFACE_ICON[featuredSurface.key];
                                const ready = featuredSurface.status === 'ready';
                                const accent = getSurfaceAccent(featuredSurface.key, ready);
                                const coverageCount = featuredSurface.key === 'nutrient_correction'
                                    ? featuredSurface.sourceWaterAnalytes.length + featuredSurface.drainWaterAnalytes.length
                                    : featuredSurface.stages.length + featuredSurface.mediums.length;
                                const detailChips = [
                                    featuredSurface.draftMode ? `${copy.draftMode}: ${featuredSurface.draftMode}` : null,
                                    featuredSurface.macroBundleMode ? `${copy.macroMode}: ${featuredSurface.macroBundleMode}` : null,
                                    featuredSurface.limitation ? `${copy.limitation}: ${featuredSurface.limitation}` : null,
                                ].filter(Boolean) as string[];

                                return (
                                    <article
                                        className={`rounded-[var(--sg-radius-lg)] px-4 py-3 ${accent.card}`}
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                                <div className="flex min-w-0 items-start gap-2.5">
                                                    <div
                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] bg-white/84"
                                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="sg-eyebrow">{copy.featuredSurface}</div>
                                                        <div className="mt-1 text-lg font-bold leading-tight text-[color:var(--sg-text-strong)]">
                                                            {labels[featuredSurface.key]}
                                                        </div>
                                                        <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--sg-text-muted)]">
                                                            {descriptions[featuredSurface.key]} {ready ? copy.readyHint : copy.pendingHint}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div
                                                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${accent.badge}`}
                                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                                >
                                                    {ready ? copy.ready : copy.unavailableStatus}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2">
                                                <LauncherStatPill label={copy.requiredInputs} value={featuredSurface.requiredFields.length} />
                                                <LauncherStatPill label={copy.optionalInputs} value={featuredSurface.optionalFields.length} />
                                                <LauncherStatPill label={copy.supportRange} value={coverageCount} />
                                            </div>

                                            {detailChips.length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {detailChips.map((chip) => (
                                                        <div
                                                            key={chip}
                                                            className="rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--sg-text-muted)]"
                                                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                                        >
                                                            {chip}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}

                                            <div className="flex flex-wrap items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSurface?.(featuredSurface.key)}
                                                    disabled={!ready || !onOpenSurface}
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition ${
                                                        ready && onOpenSurface
                                                            ? `${accent.button} hover:opacity-90`
                                                            : 'cursor-not-allowed bg-white/70 text-[color:var(--sg-text-faint)]'
                                                    }`}
                                                >
                                                    {ready ? copy.openNow : copy.unavailableAction}
                                                    {ready ? <ArrowUpRight className="h-3.5 w-3.5" /> : null}
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })()}

                            <div className="grid gap-2">
                                {supportingSurfaces.map((surface) => {
                                    const Icon = SURFACE_ICON[surface.key];
                                    const ready = surface.status === 'ready';
                                    const accent = getSurfaceAccent(surface.key, ready);
                                    const coverageCount = surface.key === 'nutrient_correction'
                                        ? surface.sourceWaterAnalytes.length + surface.drainWaterAnalytes.length
                                        : surface.stages.length + surface.mediums.length;

                                    return (
                                        <article
                                            key={surface.key}
                                            className={`rounded-[var(--sg-radius-lg)] px-4 py-3 ${accent.card}`}
                                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                        >
                                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
                                                <div className="flex min-w-0 items-start gap-2.5">
                                                    <div
                                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] bg-white/84"
                                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                            <span className="text-sm font-bold text-[color:var(--sg-text-strong)]">
                                                                {labels[surface.key]}
                                                            </span>
                                                            <span
                                                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${accent.badge}`}
                                                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                                            >
                                                                {ready ? copy.ready : copy.unavailableStatus}
                                                            </span>
                                                        </div>
                                                        <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--sg-text-muted)]">
                                                            {descriptions[surface.key]} · {copy.requiredInputs} {surface.requiredFields.length} · {copy.supportRange} {coverageCount}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenSurface?.(surface.key)}
                                                    disabled={!ready || !onOpenSurface}
                                                    className={`inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                                                        ready && onOpenSurface
                                                            ? `${accent.button} hover:opacity-90`
                                                            : 'cursor-not-allowed bg-white/70 text-[color:var(--sg-text-faint)]'
                                                    }`}
                                                >
                                                    {ready ? copy.open : copy.unavailableAction}
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>
            )}
        </DashboardCard>
    );
}
