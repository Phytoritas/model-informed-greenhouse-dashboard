import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
import { getLocalizedTokenLabel } from '../../utils/displayCopy';
import AdvisorActionCard from './AdvisorActionCard';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';

interface AdvisorPendingTabPanelProps {
    title: string;
    subtitle: string;
    notes: string[];
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    result?: PlannedAdvisorTabPayload;
    onRun: () => void;
}

const AdvisorPendingTabPanel = ({
    title,
    subtitle,
    notes,
    status,
    error,
    result,
    onRun,
}: AdvisorPendingTabPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            plannedDomain: '준비 중인 기능',
            promptLevelTab: '준비 단계',
            enginePending: '연결 준비 중',
            checking: '현재 준비 범위를 확인 중...',
            run: '준비 범위 확인',
            failed: '실행 실패',
            idleDescription: '이 기능은 화면 준비가 먼저 끝났고, 실제 계산 연결은 아직 마무리 중입니다. 준비 범위를 확인하면 지금 바로 쓸 수 있는 부분을 볼 수 있습니다.',
            currentBoundary: '현재 준비 범위',
            tabKey: '탭',
            catalogVersion: '기준 버전',
            existingTabs: '현재 사용 가능 탭',
            available: '사용 가능',
        }
        : {
            plannedDomain: 'Preparing panel',
            promptLevelTab: 'Preparing now',
            enginePending: 'Link in progress',
            checking: 'Checking what is ready now...',
            run: 'Check what is ready',
            failed: 'Execution failed',
            idleDescription: 'This panel is visible now, but some linked calculations are still being finished. Check what is ready before using it.',
            currentBoundary: 'Current ready scope',
            tabKey: 'Tab key',
            catalogVersion: 'Catalog version',
            existingTabs: 'Existing advisor tabs',
            available: 'Available',
        };

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-2xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] p-5">
                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-muted)]">
                            {copy.plannedDomain}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-[color:var(--sg-text-strong)]">{title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--sg-text-muted)]">{subtitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <AdvisorConfidenceBadge label={copy.promptLevelTab} tone="info" />
                        <AdvisorConfidenceBadge label={copy.enginePending} tone="warning" />
                    </div>
                    <ul className="space-y-2 text-sm text-[color:var(--sg-text-muted)]">
                        {notes.map((note) => (
                            <li key={note} className="rounded-xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-3 py-2">
                                {note}
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        onClick={onRun}
                        disabled={status === 'loading'}
                        className="w-full rounded-2xl bg-[linear-gradient(135deg,var(--sg-accent-earth),#c45d47)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--sg-shadow-card)] transition-[filter] hover:brightness-[1.04] disabled:opacity-60"
                    >
                        {status === 'loading' ? copy.checking : copy.run}
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] p-5">
                {status === 'error' ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                        {copy.failed}: {error}
                    </div>
                ) : null}
                {status !== 'error' && !result ? (
                    <div className="text-sm leading-relaxed text-[color:var(--sg-text-muted)]">
                        {copy.idleDescription}
                    </div>
                ) : null}
                {status !== 'error' && result ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <AdvisorConfidenceBadge label={getLocalizedTokenLabel(result.status, locale)} tone="warning" />
                            {result.available_tabs.map((tab) => (
                                <AdvisorConfidenceBadge
                                    key={tab}
                                    label={`${copy.available}: ${getLocalizedTokenLabel(tab, locale)}`}
                                    tone="success"
                                />
                            ))}
                            {result.machine_payload.missing_data.map((item) => (
                                <AdvisorConfidenceBadge
                                    key={item}
                                    label={getLocalizedTokenLabel(item, locale)}
                                    tone="neutral"
                                />
                            ))}
                        </div>
                        <AdvisorActionCard
                            title={copy.currentBoundary}
                            subtitle={result.message}
                        >
                            <div className="space-y-2 text-sm text-[color:var(--sg-text-muted)]">
                                <div>{copy.tabKey}: {result.tab_name}</div>
                                <div>
                                    {copy.existingTabs}: {result.available_tabs.join(', ') || '-'}
                                </div>
                            </div>
                        </AdvisorActionCard>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default AdvisorPendingTabPanel;
