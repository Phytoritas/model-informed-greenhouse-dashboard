import { ArrowRight, BrainCircuit, CalendarClock, Sparkles } from 'lucide-react';
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

function formatMetric(value: number | null | undefined, digits = 2): string {
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
    onOpenAdvisor,
    onOpenAssistant,
}: HeroControlCardProps) {
    const { locale } = useLocale();
    const primaryAction = actions[0] ?? null;
    const supportingActions = primaryAction ? actions.slice(1, 3) : [];

    const copy = locale === 'ko'
        ? {
            eyebrow: '오늘 한눈에',
            title: '오늘 운영 방향',
            issue: '지금 가장 중요한 문제',
            modelRuntime: '모델 해석',
            focusNow: '지금 집중',
            nextActions: '다음 조치',
            noActions: '지금은 급한 조정보다 상태 유지와 추세 확인이 우선입니다.',
            openRtr: '시나리오 비교',
            openAdvisor: '생육·작업 보기',
            openAssistant: '질문하기',
            sourceSink: '탄소 여유',
            canopy: '순광합성',
            lai: 'LAI',
            quickActions: '빠른 실행',
        }
        : {
            eyebrow: 'Command Center',
            title: 'Today operating direction',
            issue: 'Primary issue now',
            modelRuntime: 'Model interpretation',
            focusNow: 'Focus now',
            nextActions: 'Next actions',
            noActions: 'Hold the current regime before making a new move.',
            openRtr: 'Compare scenarios',
            openAdvisor: 'Open grower support',
            openAssistant: 'Open ask lane',
            sourceSink: 'Carbon margin',
            canopy: 'Net assimilation',
            lai: 'LAI',
            quickActions: 'Quick actions',
        };

    return (
        <DashboardCard
            variant="hero"
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={summary}
            actions={(
                <div className="flex flex-wrap gap-2">
                    <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
                    <ConfidenceBadge value={confidence} />
                </div>
            )}
        >
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(320px,0.78fr)]">
                <div className="space-y-5">
                    <div
                        className="overflow-hidden rounded-[34px] bg-[linear-gradient(135deg,rgba(255,250,245,0.98),rgba(248,227,215,0.84)_52%,rgba(237,216,206,0.88))] p-6"
                        style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div
                                className="inline-flex items-center gap-2 rounded-full bg-white/84 px-4 py-2 text-sm font-semibold text-[color:var(--sg-accent-violet)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                <Sparkles className="h-4 w-4" />
                                {operatingMode}
                            </div>
                            <div className="rounded-full bg-[color:var(--sg-accent-violet)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                                {copy.sourceSink}
                            </div>
                        </div>

                        <p className="mt-5 sg-metric-value text-[clamp(2.4rem,1.7rem+1.8vw,4rem)]">
                            {primaryNarrative}
                        </p>
                        <p className="mt-3 max-w-3xl text-base leading-8 text-[color:var(--sg-text-muted)]">
                            {summary}
                        </p>

                        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
                            {importantIssue ? (
                                <div
                                    className="rounded-[24px] bg-[color:var(--sg-accent-amber-soft)] px-4 py-4 text-sm text-[color:var(--sg-text-strong)]"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-accent-amber)]">
                                        {copy.issue}
                                    </div>
                                    <div className="mt-2 leading-6">{importantIssue}</div>
                                </div>
                            ) : (
                                <div
                                    className="rounded-[24px] bg-[color:var(--sg-surface-muted)] px-4 py-4 text-sm text-[color:var(--sg-text-muted)]"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    {locale === 'ko'
                                        ? '현재 가장 중요한 이슈는 모델이 안정 범위 안에 있습니다.'
                                        : 'The model is not flagging a new primary issue right now.'}
                                </div>
                            )}
                            {modelRuntimeSummary ? (
                                <div
                                    className="flex items-start gap-3 rounded-[24px] bg-[color:var(--sg-surface-muted)] px-4 py-4 text-sm text-[color:var(--sg-text)]"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <BrainCircuit className="mt-0.5 h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                                    <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                            {copy.modelRuntime}
                                        </div>
                                        <p className="mt-1 leading-6">{modelRuntimeSummary}</p>
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                        {primaryAction ? (
                            <div
                                className="rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,244,255,0.92))] px-5 py-5"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                    {copy.focusNow}
                                </div>
                                <div className="mt-3 flex items-start gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--sg-accent-forest-soft)] text-sm font-semibold text-[color:var(--sg-accent-forest)]">
                                        01
                                    </div>
                                    <div className="text-base leading-7 text-[color:var(--sg-text-strong)]">
                                        {primaryAction}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div
                                className="rounded-[28px] bg-white/76 px-5 py-5 text-sm leading-7 text-[color:var(--sg-text-muted)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                {copy.noActions}
                            </div>
                        )}
                        <div>
                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                                {copy.nextActions}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {supportingActions.map((action, index) => (
                                    <div
                                        key={action}
                                        className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(239,244,255,0.92))] px-4 py-4 text-sm font-medium text-[color:var(--sg-text-strong)]"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--sg-accent-forest-soft)] text-xs font-semibold text-[color:var(--sg-accent-forest)]">
                                                0{index + 2}
                                            </div>
                                            <div className="leading-6">{action}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div
                            className="rounded-[28px] sg-tint-green px-4 py-5 sm:col-span-2"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="sg-eyebrow">{copy.sourceSink}</div>
                            <div className="mt-3 text-4xl font-semibold tracking-[-0.06em] text-[color:var(--sg-text-strong)]">
                                {formatMetric(sourceSinkBalance)}
                            </div>
                        </div>
                        <div className="rounded-[28px] sg-tint-blue px-4 py-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="sg-eyebrow">{copy.canopy}</div>
                            <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                {formatMetric(canopyAssimilation, 1)}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--sg-text-faint)]">μmol m² s⁻¹</div>
                        </div>
                        <div className="rounded-[28px] sg-tint-violet px-4 py-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <div className="sg-eyebrow">{copy.lai}</div>
                            <div className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                {formatMetric(lai)}
                            </div>
                        </div>
                    </div>

                    <div
                        className="rounded-[30px] bg-[linear-gradient(135deg,var(--sg-accent-forest),#295c47)] px-5 py-5 text-white"
                        style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                    >
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                            <CalendarClock className="h-4 w-4" />
                            {copy.quickActions}
                        </div>
                        <div className="mt-4 space-y-2">
                            <button type="button" onClick={onOpenRtr} className="flex w-full items-center justify-between rounded-[20px] bg-white/10 px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/15">
                                <span>{copy.openRtr}</span>
                                <ArrowRight className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={onOpenAdvisor} className="flex w-full items-center justify-between rounded-[20px] bg-white/10 px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/15">
                                <span>{copy.openAdvisor}</span>
                                <ArrowRight className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={onOpenAssistant} className="flex w-full items-center justify-between rounded-[20px] bg-white/10 px-4 py-3 text-left text-sm font-semibold transition hover:bg-white/15">
                                <span>{copy.openAssistant}</span>
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
}
