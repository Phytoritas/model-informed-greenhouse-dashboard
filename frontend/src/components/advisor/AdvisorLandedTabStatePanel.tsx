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
            stateDescriptionLoading: '결정형 어드바이저가 현재 대시보드 문맥으로 새 응답을 생성하고 있습니다.',
            stateDescriptionReady: '이 어드바이저 패널은 이미 적용되어 있으며, 실행하면 최신 결정형 가이드를 확인할 수 있습니다.',
            landedAdvisor: '적용된 어드바이저',
            landed: '적용됨',
            deterministic: '결정형',
            runLoading: '어드바이저 실행 중...',
            run: '어드바이저 실행',
            executionFailed: '실행 실패',
            executionState: '실행 상태',
            refreshing: '새로 계산 중',
            ready: '준비됨',
            landedContract: '이 탭은 임시 화면이 아니라 실제 적용된 결정형 계약을 사용합니다.',
            rerunHint: '대시보드 문맥이 바뀌면 어드바이저를 다시 실행하세요.',
        }
        : {
            stateDescriptionLoading: 'The deterministic advisor is generating a fresh response from the current dashboard context.',
            stateDescriptionReady: 'This advisor surface is already landed. Run it to inspect the latest deterministic guidance.',
            landedAdvisor: 'Landed advisor',
            landed: 'Landed',
            deterministic: 'Deterministic',
            runLoading: 'Running advisor...',
            run: 'Run advisor',
            executionFailed: 'Execution failed',
            executionState: 'Execution state',
            refreshing: 'Refreshing',
            ready: 'Ready',
            landedContract: 'The tab is using the landed deterministic contract, not a pending placeholder.',
            rerunHint: 'Run the advisor again whenever the dashboard context changes.',
        };
    const stateDescription = status === 'loading'
        ? copy.stateDescriptionLoading
        : copy.stateDescriptionReady;

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {copy.landedAdvisor}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <AdvisorConfidenceBadge label={copy.landed} tone="success" />
                        <AdvisorConfidenceBadge label={copy.deterministic} tone="info" />
                    </div>
                    <ul className="space-y-2 text-sm text-slate-600">
                        {notes.map((note) => (
                            <li key={note} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                {note}
                            </li>
                        ))}
                    </ul>
                    <button
                        type="button"
                        onClick={onRun}
                        disabled={status === 'loading'}
                        className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                    >
                        {status === 'loading' ? copy.runLoading : copy.run}
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                {status === 'error' ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                        {copy.executionFailed}: {error}
                    </div>
                ) : (
                    <AdvisorActionCard
                        title={copy.executionState}
                        subtitle={stateDescription}
                        badges={status === 'loading' ? [copy.refreshing] : [copy.ready]}
                    >
                        <div className="space-y-2 text-sm text-slate-600">
                            <div>{copy.landedContract}</div>
                            <div>{copy.rerunHint}</div>
                        </div>
                    </AdvisorActionCard>
                )}
            </div>
        </div>
    );
};

export default AdvisorLandedTabStatePanel;
