import type { PlannedAdvisorTabPayload } from '../../hooks/useSmartGrowAdvisor';
import { useLocale } from '../../i18n/LocaleProvider';
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
            plannedDomain: '예정된 도메인',
            promptLevelTab: 'prompt-level tab',
            enginePending: 'engine pending',
            checking: '현재 경계 확인 중...',
            run: '현재 경계 확인',
            failed: '실행 실패',
            idleDescription: '이 prompt-level 탭은 먼저 surface만 올라와 있으며, deterministic engine은 아직 landed되지 않았습니다. 현재 backend contract와 누락 surface는 boundary check로 확인할 수 있습니다.',
            currentBoundary: '현재 contract 경계',
            tabKey: '탭 키',
            catalogVersion: '카탈로그 버전',
            existingTabs: '현재 advisor 탭',
        }
        : {
            plannedDomain: 'Planned Domain',
            promptLevelTab: 'prompt-level tab',
            enginePending: 'engine pending',
            checking: 'Checking current boundary...',
            run: 'Check current boundary',
            failed: 'Execution failed',
            idleDescription: 'This prompt-level tab is visible now, but its deterministic engine has not landed yet. Run the boundary check to see the current backend contract and missing surfaces.',
            currentBoundary: 'Current contract boundary',
            tabKey: 'Tab key',
            catalogVersion: 'Catalog version',
            existingTabs: 'Existing advisor tabs',
        };

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(300px,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                <div className="space-y-4">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {copy.plannedDomain}
                        </div>
                        <h3 className="mt-2 text-lg font-semibold text-slate-900">{title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">{subtitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <AdvisorConfidenceBadge label={copy.promptLevelTab} tone="info" />
                        <AdvisorConfidenceBadge label={copy.enginePending} tone="warning" />
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
                        {status === 'loading' ? copy.checking : copy.run}
                    </button>
                </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
                {status === 'error' ? (
                    <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-6 text-sm text-rose-700">
                        {copy.failed}: {error}
                    </div>
                ) : null}
                {status !== 'error' && !result ? (
                    <div className="text-sm leading-relaxed text-slate-500">
                        {copy.idleDescription}
                    </div>
                ) : null}
                {status !== 'error' && result ? (
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <AdvisorConfidenceBadge label={result.status} tone="warning" />
                            {result.available_tabs.map((tab) => (
                                <AdvisorConfidenceBadge key={tab} label={`available:${tab}`} tone="success" />
                            ))}
                            {result.machine_payload.missing_data.map((item) => (
                                <AdvisorConfidenceBadge key={item} label={item} tone="neutral" />
                            ))}
                        </div>
                        <AdvisorActionCard
                            title={copy.currentBoundary}
                            subtitle={result.message}
                            badges={result.machine_payload.internal_provenance?.pending_parsers ?? []}
                        >
                            <div className="space-y-2 text-sm text-slate-600">
                                <div>{copy.tabKey}: {result.tab_name}</div>
                                <div>
                                    {copy.catalogVersion}:{' '}
                                    {result.machine_payload.internal_provenance?.catalog_version ?? '-'}
                                </div>
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
