import type { CSSProperties } from 'react';
import { ArrowRight, CircleAlert, Sparkles } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime } from '../../i18n/locale';
import DashboardCard from '../common/DashboardCard';
import ConfidenceBadge from '../status/ConfidenceBadge';
import TelemetryFreshnessChip from '../status/TelemetryFreshnessChip';

interface HeroControlCardProps {
    operatingMode: string;
    primaryNarrative: string;
    summary: string;
    importantIssue: string | null;
    actions: string[];
    confidence: number | null | undefined;
    advisorUpdatedAt?: number | null;
    advisorRefreshing?: boolean;
    telemetryStatus: 'loading' | 'live' | 'delayed' | 'stale' | 'offline' | 'blocked' | 'provisional';
    telemetryDetail?: string | null;
    modelRuntimeSummary?: string | null;
    sourceSinkBalance?: number | null;
    canopyAssimilation?: number | null;
    lai?: number | null;
    onOpenRtr: () => void;
    onOpenAdvisor: () => void;
    onOpenAssistant: () => void;
}

const clampOneStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 1,
};

const clampTwoStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
};

const clampThreeStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
};

function formatMetric(value: number | null | undefined, digits = 1): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-';
    }
    return value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function formatMetricWithUnit(
    value: number | null | undefined,
    unit: string,
    digits = 1,
): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-';
    }
    return `${value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })} ${unit}`;
}

export default function HeroControlCard({
    operatingMode,
    primaryNarrative,
    summary,
    importantIssue,
    actions,
    confidence,
    advisorUpdatedAt = null,
    advisorRefreshing = false,
    telemetryStatus,
    telemetryDetail,
    modelRuntimeSummary,
    sourceSinkBalance,
    canopyAssimilation,
    lai,
    onOpenRtr,
}: HeroControlCardProps) {
    const { locale } = useLocale();
    const primaryAction = actions[0] ?? null;

    const copy = locale === 'ko'
        ? {
            eyebrow: '오늘 운영 요약',
            title: '오늘 운영 방향',
            issue: '긴급 확인',
            next: '다음 메모',
            openRtr: '온도 전략 보기',
            mode: '추천 설정값 비교',
            refreshing: '분석 갱신 중',
            updated: '분석',
            summaryFallback: '오늘은 상태를 크게 바꾸기보다 흐름을 단단히 붙잡는 쪽이 유리합니다.',
            primaryAction: '지금 할 일',
            sourceSink: '소스-싱크 균형 지수',
            canopy: '광합성',
            lai: '엽면적 지수',
            sourceSinkMeaning: '광합성 공급 대비 생장 소비의 여유',
            canopyMeaning: '현재 잎이 만드는 탄소량',
            laiMeaning: '',
        }
        : {
            eyebrow: 'Today summary',
            title: 'Today operating direction',
            issue: 'Watch now',
            next: 'Next notes',
            openRtr: 'Open control strategy',
            mode: 'Current scenario',
            refreshing: 'Refreshing',
            updated: 'Updated',
            summaryFallback: 'Hold the working rhythm before forcing a bigger change.',
            primaryAction: 'Do now',
            sourceSink: 'Carbon margin',
            canopy: 'Assimilation',
            lai: 'Canopy',
            sourceSinkMeaning: 'Supply margin over growth demand',
            canopyMeaning: 'Current canopy carbon assimilation',
            laiMeaning: 'Leaf area index over floor area',
        };

    const signalTiles = [
        {
            key: 'source-sink',
            label: copy.sourceSink,
            value: formatMetric(sourceSinkBalance, 2),
            description: copy.sourceSinkMeaning,
        },
        {
            key: 'canopy',
            label: copy.canopy,
            value: formatMetricWithUnit(canopyAssimilation, 'µmol/m²/s', 1),
            description: copy.canopyMeaning,
        },
        {
            key: 'lai',
            label: copy.lai,
            value: formatMetric(lai, 2),
            description: copy.laiMeaning,
        },
    ];
    const advisorFreshnessLabel = advisorRefreshing
        ? copy.refreshing
        : advisorUpdatedAt
            ? `${copy.updated} ${formatLocaleDateTime(locale, advisorUpdatedAt, {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            })}`
            : null;

    return (
        <DashboardCard
            variant="hero"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={undefined}
            actions={(
                <div className="flex flex-wrap gap-1.5">
                    <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
                    <ConfidenceBadge value={confidence} />
                </div>
            )}
            contentClassName="flex flex-col"
            className="h-full !p-4"
        >
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(210px,0.75fr)] xl:items-start">
                <div className="flex min-h-0 flex-col gap-3 rounded-[24px] bg-[linear-gradient(135deg,rgba(255,251,246,0.98),rgba(248,231,223,0.92))] p-4" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/84 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--sg-accent-violet)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <Sparkles className="h-3.5 w-3.5" />
                            <span style={clampOneStyle}>{operatingMode}</span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                                {copy.mode}
                            </div>
                            {advisorFreshnessLabel ? (
                                <div className="rounded-full bg-white/84 px-2.5 py-1 text-[10px] font-semibold text-[color:var(--sg-text-faint)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                                    {advisorFreshnessLabel}
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[clamp(1.2rem,0.95rem+0.6vw,1.8rem)] font-semibold leading-tight tracking-[-0.04em] text-[color:var(--sg-text-strong)]" style={clampTwoStyle}>
                            {primaryNarrative}
                        </p>
                        <p className="text-[13px] leading-5 text-[color:var(--sg-text-muted)]" style={clampTwoStyle}>
                            {summary || copy.summaryFallback}
                        </p>
                    </div>

                    <div className="grid gap-2 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                        <div className="rounded-[18px] bg-white/82 px-3 py-3" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                                {copy.primaryAction}
                            </div>
                            <div className="mt-1.5 text-[13px] leading-5 text-[color:var(--sg-text-strong)]" style={clampThreeStyle}>
                                {primaryAction ?? copy.summaryFallback}
                            </div>
                        </div>
                        <div className="rounded-[18px] bg-[color:var(--sg-surface-soft)] px-3 py-3" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                                <CircleAlert className="h-3.5 w-3.5 text-[color:var(--sg-accent-amber)]" />
                                {copy.issue}
                            </div>
                            <div className="mt-1.5 text-[13px] leading-5 text-[color:var(--sg-text-strong)]" style={clampThreeStyle}>
                                {importantIssue ?? modelRuntimeSummary ?? copy.summaryFallback}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 flex-col gap-2">
                    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        {signalTiles.map((tile) => (
                            <div
                                key={tile.key}
                                className="rounded-[18px] bg-white/82 px-3 py-2.5"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sg-text-faint)]">
                                    {tile.label}
                                </div>
                                <div className="mt-1.5 text-[1.18rem] font-semibold leading-none tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
                                    {tile.value}
                                </div>
                                {tile.description ? (
                                    <p className="mt-1 text-[11px] leading-4 text-[color:var(--sg-text-muted)]">
                                        {tile.description}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={onOpenRtr}
                        className="mt-auto inline-flex w-full items-center justify-between rounded-[18px] bg-[color:var(--sg-accent-violet)] px-3 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#e04e52]"
                        style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                    >
                        <span>{copy.openRtr}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </DashboardCard>
    );
}
