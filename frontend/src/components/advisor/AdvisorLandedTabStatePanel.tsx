import AdvisorActionCard from './AdvisorActionCard';
import AdvisorConfidenceBadge from './AdvisorConfidenceBadge';
import { useLocale } from '../../i18n/LocaleProvider';

interface AdvisorLandedTabStatePanelProps {
    title: string;
    subtitle: string;
    notes: string[];
    status: 'idle' | 'loading' | 'success' | 'error';
    error: string | null;
    onRun: () => void;
}

const AdvisorLandedTabStatePanel = ({
    title,
    subtitle,
    notes,
    status,
    error,
    onRun,
}: AdvisorLandedTabStatePanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            stateDescriptionLoading: '현재 대시보드 문맥으로 최신 조치를 다시 계산하고 있습니다.',
            stateDescriptionReady: '이 어드바이저 패널은 이미 적용되어 있으며, 실행하면 최신 실행안을 확인할 수 있습니다.',
            landedAdvisor: '실행 준비된 어드바이저',
            landed: '적용됨',
            deterministic: '바로 계산',
            runLoading: '어드바이저 실행 중...',
            run: '어드바이저 실행',
            executionFailed: '실행 실패',
            executionState: '실행 상태',
            refreshing: '새로 계산 중',
            ready: '준비됨',
            rerunHint: '대시보드 문맥이 바뀌면 어드바이저를 다시 실행하세요.',
        }
        : {
            stateDescriptionLoading: 'Refreshing actions from the current dashboard context.',
            stateDescriptionReady: 'This grower-help panel is ready. Run it to inspect the latest actions.',
            landedAdvisor: 'Ready-to-run help',
            landed: 'Ready now',
            deterministic: 'Direct calc',
            runLoading: 'Running advisor...',
            run: 'Run advisor',
            executionFailed: 'Execution failed',
            executionState: 'Execution state',
            refreshing: 'Refreshing',
            ready: 'Ready',
            rerunHint: 'Run the advisor again whenever the dashboard context changes.',
        };
    const stateDescription = status === 'loading'
        ? copy.stateDescriptionLoading
        : copy.stateDescriptionReady;

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
            <div className="sg-advisor-shell sg-advisor-shell-rose">
                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                            {copy.landedAdvisor}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-[color:var(--sg-text-strong)]">{title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-[color:var(--sg-text-muted)]">{subtitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <AdvisorConfidenceBadge label={copy.landed} tone="success" />
                        <AdvisorConfidenceBadge label={copy.deterministic} tone="info" />
                    </div>
                    <ul className="space-y-2 text-sm text-[color:var(--sg-text-muted)]">
                        {notes.map((note) => (
                            <li key={note} className="sg-advisor-note">
                                {note}
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        onClick={onRun}
                        disabled={status === 'loading'}
                        className="w-full rounded-full bg-[color:var(--sg-color-primary)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--sg-color-primary-strong)] disabled:opacity-60"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        {status === 'loading' ? copy.runLoading : copy.run}
                    </button>
                </div>
            </div>

            <div className="sg-advisor-shell sg-advisor-shell-neutral">
                {status === 'error' ? (
                    <div
                        className="rounded-[24px] bg-rose-50 px-4 py-6 text-sm text-rose-700"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        {copy.executionFailed}: {error}
                    </div>
                ) : (
                    <AdvisorActionCard
                        title={copy.executionState}
                        subtitle={stateDescription}
                        badges={status === 'loading' ? [copy.refreshing] : [copy.ready]}
                    >
                        <div className="space-y-2 text-sm text-[color:var(--sg-text-muted)]">
                            <div>{copy.rerunHint}</div>
                        </div>
                    </AdvisorActionCard>
                )}
            </div>
        </div>
    );
};

export default AdvisorLandedTabStatePanel;
