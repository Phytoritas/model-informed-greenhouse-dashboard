import { useMemo, useState } from 'react';
import { BookOpenCheck, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { getCropLabel } from '../utils/displayCopy';
import { useRtrCalibration } from '../hooks/useRtrCalibration';
import type {
    CropType,
    RtrCalibrationSelectionMode,
    RtrCalibrationWindow,
} from '../types';

interface RTRCalibrationWorkspaceProps {
    crop: CropType;
    onSaved?: () => void | Promise<void>;
}

function buildEmptyWindow(): RtrCalibrationWindow {
    return {
        label: '',
        startDate: '',
        endDate: '',
        enabled: true,
        notes: '',
        approvalStatus: 'grower-approved',
        approvalSource: '',
        approvalReason: '',
        evidenceNotes: '',
    };
}

const RTRCalibrationWorkspace = ({
    crop,
    onSaved,
}: RTRCalibrationWorkspaceProps) => {
    const { locale } = useLocale();
    const {
        stateResponse,
        previewResponse,
        loadingState,
        loadingPreview,
        saving,
        error,
        refreshState,
        previewCalibration,
        saveCalibration,
    } = useRtrCalibration({ crop });
    const [draftSelectionMode, setDraftSelectionMode] = useState<RtrCalibrationSelectionMode | null>(null);
    const [draftWindowsState, setDraftWindowsState] = useState<RtrCalibrationWindow[] | null>(null);

    const copy = locale === 'ko'
        ? {
            title: 'RTR 칼리브레이션 워크스페이스',
            subtitle: `${getCropLabel(crop, locale)} 고생산 구간을 직접 입력해 RTR 설정을 다시 맞춥니다.`,
            loading: '보정 상태를 불러오는 중...',
            rangeTitle: '사용 가능한 환경 이력',
            rangeMissing: '아직 이 작물의 환경 이력이 로드되지 않았습니다. 시뮬레이터 시작 후 다시 시도하세요.',
            rangeReady: '현재 로드된 환경 이력에서 일별 RTR 포인트를 다시 계산합니다.',
            currentTitle: '현재 보정 상태',
            currentMode: '현재 모드',
            currentSamples: '샘플 일수',
            currentFit: '현재 적합도',
            selectionMode: '선정 방식',
            windowsOnly: '입력 구간만 사용',
            auto: '입력 구간 우선',
            heuristicOnly: '휴리스틱만 사용',
            addWindow: '구간 추가',
            resetDraft: '저장본으로 되돌리기',
            preview: '미리 보기',
            save: '저장하고 반영',
            label: '구간 이름',
            startDate: '시작일',
            endDate: '종료일',
            approvalStatus: '승인 상태',
            approvalSource: '승인자/출처',
            approvalReason: '선정 이유',
            evidenceNotes: '참고 메모',
            notes: '추가 메모',
            enabled: '사용',
            remove: '삭제',
            previewTitle: '미리 보기 결과',
            previewMode: '예측 모드',
            previewBase: '기준 온도',
            previewSlope: '기울기',
            previewSource: '선정 경로',
            previewFiltered: '사용 일수',
            previewFit: '미리 보기 적합도',
            saveDone: '저장 후 RTR profile을 즉시 다시 불러옵니다.',
            houseWindow: '하우스 입력 구간',
            growerApproved: '농가 승인',
            managerApproved: '매니저 승인',
            consultantApproved: '컨설턴트 승인',
            internalReview: '내부 검토',
            heuristicDemo: '데모/가설',
        }
        : {
            title: 'RTR calibration workspace',
            subtitle: `Enter grower-approved windows for ${getCropLabel(crop, locale)} and refit the RTR baseline.`,
            loading: 'Loading calibration state...',
            rangeTitle: 'Available environment history',
            rangeMissing: 'Environment history for this crop is not loaded yet. Start the simulator and try again.',
            rangeReady: 'Daily RTR points will be recalculated from the currently loaded environment history.',
            currentTitle: 'Current calibration status',
            currentMode: 'Current mode',
            currentSamples: 'Sample days',
            currentFit: 'Current fit',
            selectionMode: 'Selection mode',
            windowsOnly: 'Windows only',
            auto: 'Windows first',
            heuristicOnly: 'Heuristic only',
            addWindow: 'Add window',
            resetDraft: 'Reset to saved',
            preview: 'Preview fit',
            save: 'Save and apply',
            label: 'Window label',
            startDate: 'Start date',
            endDate: 'End date',
            approvalStatus: 'Approval status',
            approvalSource: 'Approval source',
            approvalReason: 'Why this period was good',
            evidenceNotes: 'Reference note',
            notes: 'Extra note',
            enabled: 'Enabled',
            remove: 'Remove',
            previewTitle: 'Preview result',
            previewMode: 'Preview mode',
            previewBase: 'Base temperature',
            previewSlope: 'Slope',
            previewSource: 'Selection source',
            previewFiltered: 'Filtered days',
            previewFit: 'Preview fit',
            saveDone: 'Saving updates the RTR profile immediately.',
            houseWindow: 'House window',
            growerApproved: 'Grower approved',
            managerApproved: 'Manager approved',
            consultantApproved: 'Consultant approved',
            internalReview: 'Internal review',
            heuristicDemo: 'Heuristic demo',
        };

    const previewProfile = previewResponse?.preview_profile ?? null;
    const environmentSummary = stateResponse?.environment_summary ?? previewResponse?.environment_summary ?? null;
    const selectionSummary = previewResponse?.selection_summary ?? null;
    const savedWindows = useMemo(
        () => (stateResponse?.windows.length ? stateResponse.windows : [buildEmptyWindow()]),
        [stateResponse],
    );
    const selectionMode = draftSelectionMode ?? stateResponse?.selection_mode ?? 'windows-only';
    const draftWindows = draftWindowsState ?? savedWindows;

    const canPreview = useMemo(
        () =>
            draftWindows.some(
                (window) =>
                    Boolean(window.startDate)
                    && Boolean(window.endDate)
                    && Boolean(window.approvalSource)
                    && Boolean(window.approvalReason)
                    && Boolean(window.evidenceNotes),
            ),
        [draftWindows],
    );

    const updateWindow = (index: number, patch: Partial<RtrCalibrationWindow>) => {
        setDraftWindowsState((current) =>
            (current ?? savedWindows).map((window, windowIndex) =>
                windowIndex === index ? { ...window, ...patch } : window,
            ),
        );
    };

    if (loadingState && stateResponse === null) {
        return (
            <section className="sg-warm-panel border border-[color:var(--sg-outline-soft)] p-4">
                <p className="text-sm text-[color:var(--sg-text)]">{copy.loading}</p>
            </section>
        );
    }

    return (
        <section className="sg-warm-panel border border-[color:var(--sg-outline-soft)] p-4">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-[color:var(--sg-text-strong)]">
                        <BookOpenCheck className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                        <h4 className="text-sm font-semibold">{copy.title}</h4>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.subtitle}</p>
                </div>
                <button
                    type="button"
                    onClick={() => void refreshState()}
                    className="rounded-full border border-[color:var(--sg-outline-soft)] px-3 py-2 text-xs font-medium text-[color:var(--sg-text)] transition hover:border-[color:var(--sg-accent-earth)] hover:bg-[color:var(--sg-surface-muted)]"
                >
                    {locale === 'ko' ? '상태 새로고침' : 'Refresh state'}
                </button>
            </div>

            {error ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
                <div className="sg-warm-subpanel p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--sg-text-muted)]">{copy.rangeTitle}</div>
                    {environmentSummary?.has_environment_history ? (
                        <>
                            <p className="mt-2 text-sm font-medium text-[color:var(--sg-text-strong)]">
                                {environmentSummary.start_date} ~ {environmentSummary.end_date}
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--sg-text-muted)]">
                                {locale === 'ko'
                                    ? `전체 ${environmentSummary.total_days}일 / ${environmentSummary.total_rows}행`
                                    : `${environmentSummary.total_days} days / ${environmentSummary.total_rows} rows`}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.rangeReady}</p>
                        </>
                    ) : (
                        <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.rangeMissing}</p>
                    )}
                </div>

                <div className="sg-warm-subpanel p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--sg-text-muted)]">{copy.currentTitle}</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.currentMode}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{stateResponse?.current_profile.calibration.mode ?? '-'}</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.currentSamples}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{stateResponse?.current_profile.calibration.sampleDays ?? 0}</div>
                        </div>
                        <div className="sm:col-span-2">
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.currentFit}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                R² {stateResponse?.current_profile.calibration.rSquared?.toFixed(2) ?? '-'} / MAE {stateResponse?.current_profile.calibration.meanAbsoluteErrorC?.toFixed(2) ?? '-'}°C
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-xs font-medium text-[color:var(--sg-text)]">
                    <span>{copy.selectionMode}</span>
                    <select
                        className="sg-field-input mt-2"
                        value={selectionMode}
                        onChange={(event) => setDraftSelectionMode(event.target.value as RtrCalibrationSelectionMode)}
                    >
                        <option value="windows-only">{copy.windowsOnly}</option>
                        <option value="auto">{copy.auto}</option>
                        <option value="heuristic-only">{copy.heuristicOnly}</option>
                    </select>
                </label>
                <button
                    type="button"
                    onClick={() => setDraftWindowsState((current) => [...(current ?? savedWindows), buildEmptyWindow()])}
                    className="rounded-full border border-[color:var(--sg-outline-soft)] px-3 py-2 text-xs font-medium text-[color:var(--sg-text)] transition hover:border-[color:var(--sg-accent-earth)] hover:bg-[color:var(--sg-surface-muted)]"
                >
                    <span className="inline-flex items-center gap-1">
                        <Plus className="h-3.5 w-3.5" />
                        {copy.addWindow}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setDraftSelectionMode(null);
                        setDraftWindowsState(null);
                    }}
                    className="rounded-full border border-[color:var(--sg-outline-soft)] px-3 py-2 text-xs font-medium text-[color:var(--sg-text)] transition hover:border-[color:var(--sg-accent-earth)] hover:bg-[color:var(--sg-surface-muted)]"
                >
                    {copy.resetDraft}
                </button>
            </div>

            <div className="mt-4 space-y-3">
                {draftWindows.map((window, index) => (
                    <div key={`${window.label ?? 'window'}-${index}`} className="sg-warm-subpanel border border-[color:var(--sg-outline-soft)] p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-[color:var(--sg-text)]">
                                {copy.houseWindow} {index + 1}
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setDraftWindowsState((current) =>
                                        (current ?? savedWindows).filter((_, rowIndex) => rowIndex !== index),
                                    )
                                }
                                disabled={draftWindows.length === 1}
                                className="rounded-lg border border-[color:var(--sg-outline-soft)] px-2 py-1 text-[11px] font-medium text-[color:var(--sg-text)] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <span className="inline-flex items-center gap-1">
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {copy.remove}
                                </span>
                            </button>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.label}</span>
                                <input
                                    className="sg-field-input mt-2"
                                    value={window.label ?? ''}
                                    onChange={(event) => updateWindow(index, { label: event.target.value })}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.startDate}</span>
                                <input
                                    type="date"
                                    className="sg-field-input mt-2"
                                    value={window.startDate}
                                    onChange={(event) => updateWindow(index, { startDate: event.target.value })}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.endDate}</span>
                                <input
                                    type="date"
                                    className="sg-field-input mt-2"
                                    value={window.endDate}
                                    onChange={(event) => updateWindow(index, { endDate: event.target.value })}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.approvalStatus}</span>
                                <select
                                    className="sg-field-input mt-2"
                                    value={window.approvalStatus}
                                    onChange={(event) => updateWindow(index, { approvalStatus: event.target.value as RtrCalibrationWindow['approvalStatus'] })}
                                >
                                    <option value="grower-approved">{copy.growerApproved}</option>
                                    <option value="manager-approved">{copy.managerApproved}</option>
                                    <option value="consultant-approved">{copy.consultantApproved}</option>
                                    <option value="internal-review">{copy.internalReview}</option>
                                    <option value="heuristic-demo">{copy.heuristicDemo}</option>
                                </select>
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)]">
                                <span>{copy.approvalSource}</span>
                                <input
                                    className="sg-field-input mt-2"
                                    value={window.approvalSource ?? ''}
                                    onChange={(event) => updateWindow(index, { approvalSource: event.target.value })}
                                />
                            </label>
                            <label className="flex items-center gap-2 pt-7 text-xs font-medium text-[color:var(--sg-text)]">
                                <input
                                    type="checkbox"
                                    checked={window.enabled}
                                    onChange={(event) => updateWindow(index, { enabled: event.target.checked })}
                                />
                                {copy.enabled}
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)] md:col-span-2 xl:col-span-3">
                                <span>{copy.approvalReason}</span>
                                <input
                                    className="sg-field-input mt-2"
                                    value={window.approvalReason ?? ''}
                                    onChange={(event) => updateWindow(index, { approvalReason: event.target.value })}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)] md:col-span-2 xl:col-span-3">
                                <span>{copy.evidenceNotes}</span>
                                <input
                                    className="sg-field-input mt-2"
                                    value={window.evidenceNotes ?? ''}
                                    onChange={(event) => updateWindow(index, { evidenceNotes: event.target.value })}
                                />
                            </label>
                            <label className="text-xs font-medium text-[color:var(--sg-text)] md:col-span-2 xl:col-span-3">
                                <span>{copy.notes}</span>
                                <input
                                    className="sg-field-input mt-2"
                                    value={window.notes ?? ''}
                                    onChange={(event) => updateWindow(index, { notes: event.target.value })}
                                />
                            </label>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => void previewCalibration({ windows: draftWindows, selectionMode })}
                    disabled={!canPreview || loadingPreview || saving}
                    className="rounded-full bg-[color:var(--sg-accent-violet)] px-3 py-2 text-xs font-medium text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:bg-[color:var(--sg-surface-muted)] disabled:text-[color:var(--sg-text-muted)]"
                >
                    <span className="inline-flex items-center gap-1">
                        <Search className="h-3.5 w-3.5" />
                        {copy.preview}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={async () => {
                        await saveCalibration({ windows: draftWindows, selectionMode });
                        setDraftSelectionMode(null);
                        setDraftWindowsState(null);
                        await onSaved?.();
                    }}
                    disabled={!canPreview || saving}
                    className="rounded-lg border border-[color:var(--sg-outline-soft)] px-3 py-2 text-xs font-medium text-[color:var(--sg-text)] transition hover:border-[color:var(--sg-accent-violet)] hover:bg-[color:var(--sg-status-live-bg)] hover:text-[color:var(--sg-accent-violet)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <span className="inline-flex items-center gap-1">
                        <Save className="h-3.5 w-3.5" />
                        {copy.save}
                    </span>
                </button>
                <span className="self-center text-[11px] text-[color:var(--sg-text-muted)]">{copy.saveDone}</span>
            </div>

            {previewProfile ? (
                <div className="mt-4 rounded-xl border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-status-live-bg)] p-4">
                    <div className="mb-3 text-sm font-semibold text-[color:var(--sg-text-strong)]">{copy.previewTitle}</div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.previewMode}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{previewProfile.calibration.mode}</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.previewBase}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{previewProfile.baseTempC.toFixed(3)}°C</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.previewSlope}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{previewProfile.slopeCPerMjM2.toFixed(4)}</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.previewSource}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{selectionSummary?.selection_source ?? '-'}</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.previewFiltered}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{selectionSummary?.filtered_days ?? 0}</div>
                        </div>
                        <div>
                            <div className="text-[11px] text-[color:var(--sg-text-muted)]">{copy.previewFit}</div>
                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                R² {previewProfile.calibration.rSquared?.toFixed(2) ?? '-'} / MAE {previewProfile.calibration.meanAbsoluteErrorC?.toFixed(2) ?? '-'}°C
                            </div>
                        </div>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-[color:var(--sg-text)]">{previewProfile.sourceNote}</p>
                </div>
            ) : null}
        </section>
    );
};

export default RTRCalibrationWorkspace;
