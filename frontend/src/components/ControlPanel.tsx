import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, PlugZap } from 'lucide-react';
import type { ControlStatus, TemperatureSettings } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { Button } from './ui/button';
import { StatusChip } from './ui/status-chip';

interface ControlPanelProps {
    status: ControlStatus;
    /**
     * Accepted for call-site compatibility. Equipment is not connected in this
     * build, so no manual actuator toggle is rendered.
     */
    onToggle?: (key: keyof ControlStatus) => void;
    /**
     * May run an async request. The panel awaits the returned value so the
     * pending, success, and failure states reflect what the server accepted.
     */
    onSettingsChange: (settings: TemperatureSettings) => void | Promise<void>;
}

type ApplyState = 'idle' | 'pending' | 'success' | 'error';

interface DraftSettings {
    heating: number;
    cooling: number;
    pBand: string;
    co2Target: string;
    drainTarget: string;
}

type ParseResult =
    | { ok: true; settings: TemperatureSettings }
    | { ok: false; reason: 'order' | 'number' };

const DEFAULT_P_BAND = 4;
const DEFAULT_CO2_TARGET = 800;
const DEFAULT_DRAIN_TARGET = 0.3;

function toDraft(settings: TemperatureSettings): DraftSettings {
    return {
        heating: settings.heating,
        cooling: settings.cooling,
        pBand: String(settings.pBand ?? DEFAULT_P_BAND),
        co2Target: String(settings.co2Target ?? DEFAULT_CO2_TARGET),
        drainTarget: String(settings.drainTarget ?? DEFAULT_DRAIN_TARGET),
    };
}

function signatureOf(settings: TemperatureSettings): string {
    return [
        settings.heating,
        settings.cooling,
        settings.pBand ?? DEFAULT_P_BAND,
        settings.co2Target ?? DEFAULT_CO2_TARGET,
        settings.drainTarget ?? DEFAULT_DRAIN_TARGET,
    ].join('|');
}

function parseDraft(draft: DraftSettings): ParseResult {
    const pBand = Number(draft.pBand);
    const co2Target = Number(draft.co2Target);
    const drainTarget = Number(draft.drainTarget);

    if (
        !draft.pBand.trim() || !draft.co2Target.trim() || !draft.drainTarget.trim()
        || pBand <= 0 || co2Target < 0 || drainTarget < 0 || drainTarget > 1
        ||
        !Number.isFinite(draft.heating)
        || !Number.isFinite(draft.cooling)
        || !Number.isFinite(pBand)
        || !Number.isFinite(co2Target)
        || !Number.isFinite(drainTarget)
    ) {
        return { ok: false, reason: 'number' };
    }

    // Heating must start below cooling; an inverted pair would ask the model to
    // heat and cool across the same band.
    if (draft.heating >= draft.cooling) {
        return { ok: false, reason: 'order' };
    }

    return {
        ok: true,
        settings: {
            heating: draft.heating,
            cooling: draft.cooling,
            pBand,
            co2Target,
            drainTarget,
        },
    };
}

const ControlPanel = ({ status, onSettingsChange }: ControlPanelProps) => {
    const { locale } = useLocale();
    const settingsState = status.settingsState ?? 'ready';
    const isLoading = settingsState === 'loading';
    const loadFailed = settingsState === 'error';
    const acceptedSignature = signatureOf(status.settings);

    const [draft, setDraft] = useState<DraftSettings>(() => toDraft(status.settings));
    const [applyState, setApplyState] = useState<ApplyState>('idle');
    const [applyError, setApplyError] = useState<string | null>(null);
    const [syncedSignature, setSyncedSignature] = useState(acceptedSignature);

    const copy = locale === 'ko'
        ? {
            eyebrow: '온도 기준',
            title: '온도 기준 설정',
            description: '난방과 냉방 시작 온도, 제어 밴드를 정하고 적용합니다.',
            applyHint: '온도 기준을 적용하면 다음 계산부터 반영됩니다.',
            equipmentNotice: '장비 연결 정보가 없어 현재 장비 상태는 표시하지 않습니다.',
            heatingThreshold: '난방 시작 온도',
            coolingThreshold: '냉방 시작 온도',
            pBand: '제어 밴드',
            co2Target: 'CO₂ 목표',
            drainTarget: '배액 목표',
            accepted: '적용된 값',
            pendingChange: '적용 대기 중',
            apply: '적용',
            applying: '적용하는 중...',
            retry: '다시 적용',
            applied: '적용되었습니다.',
            applyFailed: '적용하지 못했습니다',
            keepDraft: '입력한 값은 그대로 두었습니다. 확인 후 다시 적용하세요.',
            loading: '적용된 값을 불러오는 중입니다...',
            loadError: '적용된 값을 불러오지 못했습니다. 아래 값은 아직 적용되지 않았습니다.',
            loadErrorRetry: '값을 확인한 뒤 적용을 누르면 다시 시도합니다.',
            invalidOrder: '난방 시작 온도는 냉방 시작 온도보다 낮아야 합니다.',
            invalidNumber: '숫자 값을 확인해 주세요.',
            unknownError: '알 수 없는 오류가 발생했습니다.',
            unavailable: '확인 안 됨',
        }
        : {
            eyebrow: 'Temperature targets',
            title: 'Temperature target settings',
            description: 'Set the heating and cooling start temperatures and the control band, then apply them.',
            applyHint: 'Applied temperature targets take effect from the next calculation.',
            equipmentNotice: 'Equipment connection data is unavailable, so current device status is not shown.',
            heatingThreshold: 'Heating start',
            coolingThreshold: 'Cooling start',
            pBand: 'Control band',
            co2Target: 'CO₂ target',
            drainTarget: 'Drain target',
            accepted: 'Applied values',
            pendingChange: 'Waiting to be applied',
            apply: 'Apply',
            applying: 'Applying...',
            retry: 'Apply again',
            applied: 'Applied.',
            applyFailed: 'Could not apply the settings',
            keepDraft: 'Your entered values were kept. Check them and apply again.',
            loading: 'Loading the applied values...',
            loadError: 'The applied values could not be loaded. The values below are not applied yet.',
            loadErrorRetry: 'Check the values and press apply to try again.',
            invalidOrder: 'The heating start temperature must be lower than the cooling start temperature.',
            invalidNumber: 'Check the numeric values.',
            unknownError: 'An unknown error occurred.',
            unavailable: 'Not confirmed',
        };

    // Re-sync the draft when the server-accepted values change, unless an apply is
    // in flight or a failed attempt is still holding the entered values.
    useEffect(() => {
        if (acceptedSignature === syncedSignature) {
            return;
        }
        if (applyState === 'pending' || applyState === 'error') {
            return;
        }
        setDraft(toDraft(status.settings));
        setSyncedSignature(acceptedSignature);
    }, [acceptedSignature, syncedSignature, applyState, status.settings]);

    const parsed = useMemo(() => parseDraft(draft), [draft]);
    const validationMessage = parsed.ok
        ? null
        : parsed.reason === 'order'
            ? copy.invalidOrder
            : copy.invalidNumber;

    const draftSignature = parsed.ok ? signatureOf(parsed.settings) : null;
    // Only a ready state may claim that a value is the accepted one.
    const hasPendingChange = settingsState !== 'ready'
        || draftSignature === null
        || draftSignature !== acceptedSignature;

    const handleApply = useCallback(async () => {
        const result = parseDraft(draft);
        if (!result.ok) {
            setApplyState('error');
            setApplyError(result.reason === 'order' ? copy.invalidOrder : copy.invalidNumber);
            return;
        }

        setApplyState('pending');
        setApplyError(null);
        try {
            await onSettingsChange(result.settings);
            setApplyState('success');
            setSyncedSignature(signatureOf(result.settings));
        } catch (error) {
            // The draft is left untouched so a failed attempt is not lost.
            setApplyState('error');
            setApplyError(error instanceof Error ? error.message : copy.unknownError);
        }
    }, [draft, onSettingsChange, copy.invalidOrder, copy.invalidNumber, copy.unknownError]);

    const updateDraft = (patch: Partial<DraftSettings>) => {
        setDraft((current) => ({ ...current, ...patch }));
        if (applyState === 'success') {
            setApplyState('idle');
        }
    };

    const acceptedTemperature = (value: number): string => (
        settingsState === 'ready' && Number.isFinite(value)
            ? String(value) + '°C'
            : copy.unavailable
    );

    const applyDisabled = isLoading || applyState === 'pending' || !parsed.ok || !hasPendingChange;
    const numberFieldClass = 'h-10 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 text-sm font-semibold text-[color:var(--sg-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] disabled:opacity-60';

    return (
        <div className="sg-warm-panel p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="sg-eyebrow">{copy.eyebrow}</p>
                    <h3 className="mt-1 text-lg font-semibold text-[color:var(--sg-text-strong)]">{copy.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--sg-text-muted)]">{copy.description}</p>
                </div>
                {hasPendingChange && !isLoading ? (
                    <StatusChip tone="warning">{copy.pendingChange}</StatusChip>
                ) : null}
            </div>

            <p className="mb-4 flex items-start gap-2 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-surface-muted)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                <PlugZap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {copy.equipmentNotice}
            </p>

            {isLoading ? (
                <p className="mb-4 flex items-center gap-2 text-sm text-[color:var(--sg-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    {copy.loading}
                </p>
            ) : null}

            {loadFailed ? (
                <div
                    role="alert"
                    className="mb-4 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-status-offline-bg)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-status-offline-text)]"
                >
                    <p className="font-semibold">
                        {copy.loadError}
                        {status.settingsError ? ' (' + status.settingsError + ')' : ''}
                    </p>
                    <p className="mt-1">{copy.loadErrorRetry}</p>
                </div>
            ) : null}

            <div className="space-y-4">
                <div>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <label htmlFor="control-heating-start" className="text-xs text-[color:var(--sg-text-muted)]">
                            {copy.heatingThreshold}
                        </label>
                        <span className="text-[11px] text-[color:var(--sg-text-faint)]">
                            {copy.accepted}: <span className="sg-data-number">{acceptedTemperature(status.settings.heating)}</span>
                        </span>
                    </div>
                    <input
                        id="control-heating-start"
                        type="range"
                        min="10"
                        max="30"
                        step="1"
                        disabled={isLoading || applyState === 'pending'}
                        value={draft.heating}
                        onChange={(event) => updateDraft({ heating: Number(event.target.value) })}
                        className="w-full disabled:opacity-60"
                        style={{ accentColor: 'var(--sg-accent-violet)' }}
                    />
                    <div className="flex justify-between text-xs text-[color:var(--sg-text-faint)]">
                        <span>10°C</span>
                        <span className="font-medium text-[color:var(--sg-text)]">{draft.heating}°C</span>
                        <span>30°C</span>
                    </div>
                </div>

                <div>
                    <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                        <label htmlFor="control-cooling-start" className="text-xs text-[color:var(--sg-text-muted)]">
                            {copy.coolingThreshold}
                        </label>
                        <span className="text-[11px] text-[color:var(--sg-text-faint)]">
                            {copy.accepted}: <span className="sg-data-number">{acceptedTemperature(status.settings.cooling)}</span>
                        </span>
                    </div>
                    <input
                        id="control-cooling-start"
                        type="range"
                        min="15"
                        max="35"
                        step="1"
                        disabled={isLoading || applyState === 'pending'}
                        value={draft.cooling}
                        onChange={(event) => updateDraft({ cooling: Number(event.target.value) })}
                        className="w-full disabled:opacity-60"
                        style={{ accentColor: 'var(--sg-accent-earth)' }}
                    />
                    <div className="flex justify-between text-xs text-[color:var(--sg-text-faint)]">
                        <span>15°C</span>
                        <span className="font-medium text-[color:var(--sg-text)]">{draft.cooling}°C</span>
                        <span>35°C</span>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                        {copy.pBand}
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            disabled={isLoading || applyState === 'pending'}
                            value={draft.pBand}
                            onChange={(event) => updateDraft({ pBand: event.target.value })}
                            className={numberFieldClass}
                        />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                        {copy.co2Target}
                        <input
                            type="number"
                            min="300"
                            step="25"
                            disabled={isLoading || applyState === 'pending'}
                            value={draft.co2Target}
                            onChange={(event) => updateDraft({ co2Target: event.target.value })}
                            className={numberFieldClass}
                        />
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                        {copy.drainTarget}
                        <input
                            type="number"
                            min="0"
                            max="1"
                            step="0.05"
                            disabled={isLoading || applyState === 'pending'}
                            value={draft.drainTarget}
                            onChange={(event) => updateDraft({ drainTarget: event.target.value })}
                            className={numberFieldClass}
                        />
                    </label>
                </div>

                {validationMessage ? (
                    <p className="flex items-start gap-2 text-xs leading-5 text-[color:var(--sg-status-offline-text)]">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {validationMessage}
                    </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--sg-outline-soft)] pt-4">
                    <Button
                        type="button"
                        variant="primary"
                        disabled={applyDisabled}
                        onClick={() => { void handleApply(); }}
                    >
                        {applyState === 'pending' ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : null}
                        {applyState === 'pending'
                            ? copy.applying
                            : applyState === 'error'
                                ? copy.retry
                                : copy.apply}
                    </Button>
                    {applyState === 'success' ? (
                        <span
                            aria-live="polite"
                            className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--sg-color-success)]"
                        >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            {copy.applied}
                        </span>
                    ) : null}
                    <span className="text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.applyHint}</span>
                </div>

                {applyState === 'error' ? (
                    <div
                        role="alert"
                        className="rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-status-offline-bg)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-status-offline-text)]"
                    >
                        <p className="font-semibold">
                            {copy.applyFailed}
                            {applyError ? ': ' + applyError : ''}
                        </p>
                        <p className="mt-1">{copy.keepDraft}</p>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default ControlPanel;
