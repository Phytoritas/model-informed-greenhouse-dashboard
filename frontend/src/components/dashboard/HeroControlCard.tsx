import type { CSSProperties } from 'react';
import { ArrowRight, CircleAlert, Sparkles } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
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

function formatMetric(value: number | null | undefined, digits = 1): string {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '-';
    }
    return value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

export default function HeroControlCard({
    operatingMode,
    primaryNarrative,
    summary,
    importantIssue,
    actions,
    confidence,
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
    const secondaryNotes = actions.slice(1, 3);

    const copy = locale === 'ko'
        ? {
            eyebrow: '오늘 운영 요약',
            title: '오늘 운영 방향',
            issue: '지금 주의',
            next: '다음 메모',
            openRtr: '온도 전략 보기',
            mode: '오늘 비교안',
            summaryFallback: '오늘은 상태를 크게 바꾸기보다 흐름을 단단히 붙잡는 쪽이 유리합니다.',
            primaryAction: '지금 할 일',
            sourceSink: '동화 여유',
            canopy: '광합성',
            lai: '잎층',
        }
        : {
            eyebrow: 'Today summary',
            title: 'Today operating direction',
            issue: 'Watch now',
            next: 'Next notes',
            openRtr: 'Open control strategy',
            mode: 'Current scenario',
            summaryFallback: 'Hold the working rhythm before forcing a bigger change.',
            primaryAction: 'Do now',
            sourceSink: 'Carbon margin',
            canopy: 'Assimilation',
            lai: 'Canopy',
        };

    const signalTiles = [
        { key: 'source-sink', label: copy.sourceSink, value: formatMetric(sourceSinkBalance) },
        { key: 'canopy', label: copy.canopy, value: formatMetric(canopyAssimilation) },
        { key: 'lai', label: copy.lai, value: formatMetric(lai) },
    ];

    return (
        <DashboardCard
            variant="hero"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={undefined}
            actions={(
                <div className="flex flex-wrap gap-2">
                    <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
                    <ConfidenceBadge value={confidence} />
                </div>
            )}
            contentClassName="flex h-full flex-col"
            className="h-full overflow-hidden"
        >
            <div className="grid h-full gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(250px,0.7fr)]">
                <div className="flex min-h-0 flex-col gap-4 rounded-[28px] bg-[linear-gradient(135deg,rgba(255,251,246,0.98),rgba(248,231,223,0.92))] p-5" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/84 px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-accent-violet)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <Sparkles className="h-4 w-4" />
                            <span style={clampOneStyle}>{operatingMode}</span>
                        </div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                            {copy.mode}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <p className="text-[clamp(1.45rem,1.05rem+0.8vw,2.1rem)] font-semibold leading-tight tracking-[-0.05em] text-[color:var(--sg-text-strong)]" style={clampTwoStyle}>
                            {primaryNarrative}
                        </p>
                        <p className="text-sm leading-6 text-[color:var(--sg-text-muted)]" style={clampTwoStyle}>
                            {summary || copy.summaryFallback}
                        </p>
                    </div>

                    <div className="mt-auto grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                        <div className="rounded-[22px] bg-white/82 px-4 py-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {copy.primaryAction}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-[color:var(--sg-text-strong)]" style={clampTwoStyle}>
                                {primaryAction ?? copy.summaryFallback}
                            </div>
                        </div>
                        <div className="rounded-[22px] bg-[color:var(--sg-surface-soft)] px-4 py-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                <CircleAlert className="h-4 w-4 text-[color:var(--sg-accent-amber)]" />
                                {copy.issue}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-[color:var(--sg-text-strong)]" style={clampTwoStyle}>
                                {importantIssue ?? modelRuntimeSummary ?? copy.summaryFallback}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 flex-col gap-3">
                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                        {signalTiles.map((tile) => (
                            <div
                                key={tile.key}
                                className="rounded-[22px] bg-white/82 px-4 py-3"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                    {tile.label}
                                </div>
                                <div className="mt-2 text-[1.35rem] font-semibold leading-none tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                    {tile.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {secondaryNotes.length > 0 ? (
                        <div className="rounded-[22px] bg-[color:var(--sg-surface-soft)] px-4 py-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {copy.next}
                            </div>
                            <div className="mt-2 space-y-2 text-sm leading-6 text-[color:var(--sg-text-strong)]">
                                {secondaryNotes.map((note) => (
                                    <div key={note} style={clampOneStyle}>
                                        {note}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <button
                        type="button"
                        onClick={onOpenRtr}
                        className="mt-auto inline-flex w-full items-center justify-between rounded-[22px] bg-[color:var(--sg-accent-violet)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#e04e52]"
                        style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                    >
                        <span>{copy.openRtr}</span>
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </DashboardCard>
    );
}
