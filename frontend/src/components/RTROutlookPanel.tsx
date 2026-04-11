import { CalendarDays, Leaf, Sun, Target, Thermometer } from 'lucide-react';
import type { CropType, RtrProfile, SensorData, TemperatureSettings, WeatherOutlook } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate } from '../i18n/locale';
import { getCropLabel, getWeatherLabel } from '../utils/displayCopy';
import { getRequestErrorCopy } from '../utils/requestErrorCopy';
import {
    getRtrProfile,
    buildRTRForecastTargets,
    buildRTRLiveSnapshot,
} from '../utils/rtr';

interface RTROutlookPanelProps {
    crop: CropType;
    currentData: SensorData;
    history: SensorData[];
    temperatureSettings: TemperatureSettings;
    weather: WeatherOutlook | null;
    loading: boolean;
    error: string | null;
    profile: RtrProfile | null;
    profileLoading: boolean;
    profileError: string | null;
    compact?: boolean;
}

const getCalibrationModeLabel = (mode: RtrProfile['calibration']['mode'], locale: 'en' | 'ko'): string => {
    if (locale === 'ko') {
        if (mode === 'fitted') return '하우스 보정';
        if (mode === 'insufficient-data') return '평소 설정 유지';
        return '평소 설정';
    }

    if (mode === 'fitted') return 'House-tuned';
    if (mode === 'insufficient-data') return 'Baseline only';
    return 'Baseline';
};

const getLocalizedStrategyLabel = (profile: RtrProfile, locale: 'en' | 'ko'): string => {
    const cropLabel = getCropLabel(profile.crop, locale);
    if (profile.calibration.mode === 'fitted') {
        return locale === 'ko'
            ? `${cropLabel} 하우스 맞춤 광-온도 설정`
            : `${cropLabel} house-tuned light-temperature line`;
    }
    if (profile.calibration.mode === 'insufficient-data') {
        return locale === 'ko'
            ? `${cropLabel} 광-온도 설정(데이터 보강 필요)`
            : `${cropLabel} baseline line (needs more data)`;
    }
    return locale === 'ko'
        ? `${cropLabel} 광-온도 설정`
        : `${cropLabel} baseline line`;
};

const getLocalizedSourceNote = (profile: RtrProfile, locale: 'en' | 'ko'): string => {
    const { calibration } = profile;
    if (calibration.mode === 'fitted') {
        if (calibration.selectionSource === 'curated-windows') {
            return locale === 'ko'
                ? `고생산 구간 ${calibration.windowCount ?? 0}개와 유효 일수 ${calibration.sampleDays}일을 바탕으로 맞춘 하우스 설정입니다.`
                : `House-tuned line built from ${calibration.windowCount ?? 0} high-yield windows and ${calibration.sampleDays} valid days.`;
        }
        return locale === 'ko'
            ? `이 하우스의 유효 일수 ${calibration.sampleDays}일을 바탕으로 맞춘 하우스 설정입니다.`
            : `House-tuned line built from ${calibration.sampleDays} valid days in this house.`;
    }

    if (calibration.mode === 'insufficient-data') {
        if (calibration.selectionSource === 'curated-windows') {
            return locale === 'ko'
                ? '고생산 구간은 정했지만 설정을 다시 맞출 만큼 데이터가 아직 부족합니다.'
                : 'High-yield windows are selected, but there is not enough data yet to retune the baseline.';
        }
        return locale === 'ko'
            ? '하우스 데이터를 더 모을 때까지 기본 설정을 유지합니다.'
            : 'The built-in baseline stays in place until this house collects more data.';
    }

    if (profile.crop === 'Tomato') {
        return locale === 'ko'
            ? '토마토 광·온도 가이드를 바탕으로 만든 기본 설정입니다. 하우스 데이터가 쌓이면 다시 맞춥니다.'
            : 'Tomato baseline line based on grower light-temperature guidance. Retune it when house data is ready.';
    }

    return locale === 'ko'
        ? '오이 광·온도 가이드를 바탕으로 만든 기본 설정입니다. 하우스 데이터가 쌓이면 다시 맞춥니다.'
        : 'Cucumber baseline line based on grower light-temperature guidance. Retune it when house data is ready.';
};

const RTROutlookPanel = ({
    crop,
    currentData,
    history,
    temperatureSettings,
    weather,
    loading,
    error,
    profile,
    profileLoading,
    profileError,
    compact = false,
}: RTROutlookPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            title: '빛·온도 균형',
            subtitle: `${getCropLabel(crop, locale)}의 최근 24시간 광량·온도 흐름`,
            profileLoading: '온도 설정을 불러오는 중...',
            rolling: '최근 24시간 균형',
            vsProfile: '평소 설정 대비',
            coverage: '적용 시간',
            radiationSum: '광량 합계',
            meanTemp: '24시간 평균 온도',
            exampleTarget: '오늘 목표',
            steeringPlan: '3일 온도 계획',
            forecastLoading: '대구 복사 예보를 불러오는 중...',
            forecastWaiting: '복사량 데이터가 들어오면 오늘 목표 온도가 계산됩니다.',
            weatherUnavailable: '날씨를 반영한 온도 계획을 불러오지 못했습니다',
            referenceLine: '온도 설정 식',
            profileMode: '설정 방식',
            selectionPath: '선정 방식',
            fitQuality: '맞춤 정도',
            currentControlWindow: '현재 온도 범위',
            profileEndpointUnavailable: '온도 설정을 불러오지 못해 기본 설정을 사용합니다',
            selectionCurated: '선별 구간',
            selectionFallback: '기본 설정',
            badgeFitted: '하우스 맞춤',
            badgeBaselineNeedMore: '기본 설정 · 데이터 보강 필요',
            badgeBaseline: '기본 설정',
            balanced: {
                badge: '평소 설정 근처',
                tone: 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]',
                description: '온도와 광이 비교적 균형 있게 움직이고 있습니다.',
            },
            'warm-for-light': {
                badge: '광량 대비 고온',
                tone: 'bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]',
                description: '현재 광량보다 온도가 앞서 있어 작물이 더 생식생장 쪽으로 기울 수 있습니다.',
            },
            'cool-for-light': {
                badge: '광량 대비 저온',
                tone: 'bg-[color:var(--sg-status-provisional-bg)] text-[color:var(--sg-status-provisional-text)]',
                description: '현재 온도보다 광이 강해 작물이 더 영양생장 쪽으로 기울 수 있습니다.',
            },
        }
        : {
            title: 'Light and temperature',
            subtitle: `Rolling 24 h light-temperature balance for ${crop}`,
            profileLoading: 'Loading strategy line...',
            rolling: 'Rolling 24 h balance',
            vsProfile: 'vs baseline',
            coverage: 'Window coverage',
            radiationSum: 'Radiation sum',
            meanTemp: '24 h mean temp',
            exampleTarget: 'Today target',
            steeringPlan: '3-day temperature plan',
            forecastLoading: 'Loading Daegu radiation forecast...',
            forecastWaiting: 'Target temperature will appear once radiation data is available.',
            weatherUnavailable: 'Could not load the weather-linked temperature plan',
            referenceLine: 'Baseline line',
            profileMode: 'Line mode',
            selectionPath: 'Source',
            fitQuality: 'Fit quality',
            currentControlWindow: 'Current temperature range',
            profileEndpointUnavailable: 'Could not load the strategy line, using the built-in baseline',
            selectionCurated: 'selected windows',
            selectionFallback: 'baseline fallback',
            badgeFitted: 'House-tuned',
            badgeBaselineNeedMore: 'Baseline (needs more data)',
            badgeBaseline: 'Baseline',
            balanced: {
                badge: 'Near baseline',
                tone: 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]',
                description: 'Temperature and light are moving together in a balanced range.',
            },
            'warm-for-light': {
                badge: 'Too warm for light',
                tone: 'bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]',
                description: 'Temperature is running ahead of the available light, which can push the crop more generative.',
            },
            'cool-for-light': {
                badge: 'Cool under strong light',
                tone: 'bg-[color:var(--sg-status-provisional-bg)] text-[color:var(--sg-status-provisional-text)]',
                description: 'Light is strong relative to the current temperature, which can push the crop more vegetative.',
            },
        };
    const formatForecastLabel = (date: string): string =>
        formatLocaleDate(locale, `${date}T00:00:00`, { month: 'short', day: 'numeric', weekday: 'short' });
    const effectiveProfile = getRtrProfile(crop, profile);
    const liveSnapshot = buildRTRLiveSnapshot(currentData, history, crop, effectiveProfile);
    const forecastTargets = buildRTRForecastTargets(
        weather?.daily ?? [],
        crop,
        effectiveProfile,
    );
    const balanceCopy = copy[liveSnapshot.balanceState];
    const localizedStrategyLabel = getLocalizedStrategyLabel(effectiveProfile, locale);
    const localizedSourceNote = getLocalizedSourceNote(effectiveProfile, locale);
    const calibrationModeLabel = getCalibrationModeLabel(effectiveProfile.calibration.mode, locale);
    const weatherErrorCopy = getRequestErrorCopy(error, locale, {
        resourceKo: '날씨를 반영한 온도 계획',
        resourceEn: 'the weather-linked temperature plan',
    });
    const profileErrorCopy = getRequestErrorCopy(profileError, locale, {
        resourceKo: '온도 설정',
        resourceEn: 'the strategy line',
    });
    const profileBadge = effectiveProfile.calibration.mode === 'fitted'
        ? `${copy.badgeFitted} (${effectiveProfile.calibration.sampleDays}${locale === 'ko' ? '일' : ' d'})`
        : effectiveProfile.calibration.mode === 'insufficient-data'
            ? copy.badgeBaselineNeedMore
            : copy.badgeBaseline;
    const selectionLabel = effectiveProfile.calibration.selectionSource === 'curated-windows'
        ? `${copy.selectionCurated} (${effectiveProfile.calibration.windowCount ?? 0})`
        : copy.selectionFallback;

    return (
        <div className={`sg-warm-panel flex h-full flex-col ${compact ? 'p-3' : 'p-5'}`}>
            <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-2' : 'mb-4'}`}>
                <div>
                    <div className="flex items-center gap-2 text-[color:var(--sg-text-strong)]">
                        <Target className="h-5 w-5 text-[color:var(--sg-accent-violet)]" />
                        <h3 className={compact ? 'text-sm font-semibold' : 'font-semibold'}>{copy.title}</h3>
                    </div>
                    {!compact && (
                    <p className="mt-1 text-xs text-[color:var(--sg-text-faint)]">
                        {copy.subtitle}
                    </p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="rounded-full bg-[color:var(--sg-status-live-bg)] px-3 py-1 text-[11px] font-medium text-[color:var(--sg-status-live-text)]">
                        {profileBadge}
                    </div>
                    {profileLoading ? (
                        <div className="text-[11px] text-[color:var(--sg-text-faint)]">{copy.profileLoading}</div>
                    ) : null}
                </div>
            </div>

            <div className="flex h-full flex-col space-y-4">
                <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(255,247,239,0.98),rgba(247,215,216,0.92))] p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--sg-text-muted)]">
                                <Leaf className="h-3.5 w-3.5 text-[color:var(--sg-accent-violet)]" />
                                <span>{copy.rolling}</span>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2 text-[color:var(--sg-text-strong)]">
                                <span className="text-3xl font-bold">{liveSnapshot.deltaTempC.toFixed(1)}&deg;C</span>
                                <span className="text-sm text-[color:var(--sg-text-muted)]">{copy.vsProfile}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-[color:var(--sg-text)]">{balanceCopy.description}</p>
                            <p className="mt-2 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">{localizedSourceNote}</p>
                        </div>
                        <div className={`rounded-2xl px-3 py-2 text-right text-xs font-medium shadow-sm ${balanceCopy.tone}`}>
                            {balanceCopy.badge}
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-[color:var(--sg-text-muted)]">
                        {copy.coverage} {liveSnapshot.windowHours.toFixed(1)} h / 24 h
                        <span className="ml-2 font-medium text-[color:var(--sg-text)]">{liveSnapshot.coveragePct.toFixed(0)}%</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="sg-warm-subpanel p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--sg-text-muted)]">
                            <Sun className="h-4 w-4 text-[color:var(--sg-accent-amber)]" />
                            <span>{copy.radiationSum}</span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-[color:var(--sg-text-strong)]">
                            {liveSnapshot.radiationSumMjM2D.toFixed(1)} MJ m⁻²
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--sg-text-muted)]">
                            DLI {liveSnapshot.dliMolM2D.toFixed(1)} mol m⁻² d⁻¹
                        </div>
                    </div>
                    <div className="sg-warm-subpanel p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--sg-text-muted)]">
                            <Thermometer className="h-4 w-4 text-[color:var(--sg-accent-earth)]" />
                            <span>{copy.meanTemp}</span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-[color:var(--sg-text-strong)]">
                            {liveSnapshot.averageTempC.toFixed(1)}&deg;C
                        </div>
                        <div className="mt-1 text-xs text-[color:var(--sg-text-muted)]">
                            {copy.exampleTarget} {liveSnapshot.targetTempC.toFixed(1)}&deg;C
                        </div>
                    </div>
                </div>

                {!compact && (
                <div className="sg-warm-subpanel p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--sg-text-muted)]">
                        <CalendarDays className="h-4 w-4 text-[color:var(--sg-text-faint)]" />
                        <span>{copy.steeringPlan}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        {loading ? (
                            <div className="rounded-[18px] bg-white/84 px-3 py-3 text-sm text-[color:var(--sg-text-muted)]">
                                {copy.forecastLoading}
                            </div>
                        ) : forecastTargets.length > 0 ? (
                            forecastTargets.map((day) => (
                                <div key={day.date} className="h-full rounded-[18px] bg-white/84 px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{formatForecastLabel(day.date)}</div>
                                            <div className="mt-1 text-xs text-[color:var(--sg-text-muted)]">{getWeatherLabel(undefined, day.weatherLabel, locale)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                                {day.targetTempC.toFixed(1)}&deg;C
                                            </div>
                                            <div className="mt-1 text-xs text-[color:var(--sg-text-muted)]">
                                                {day.radiationSumMjM2D.toFixed(1)} MJ m⁻² d⁻¹
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[18px] bg-white/84 px-3 py-3 text-sm text-[color:var(--sg-text-muted)]">
                                {copy.forecastWaiting}
                            </div>
                        )}
                    </div>
                    {weatherErrorCopy ? (
                        <div className="mt-3 rounded-[18px] border border-[color:var(--sg-accent-amber-soft)] bg-[color:var(--sg-accent-amber-soft)] px-3 py-3 text-xs text-[color:var(--sg-accent-earth)]">
                            {weatherErrorCopy}
                        </div>
                    ) : null}
                </div>
                )}

                {!compact && (
                <div className="rounded-[20px] border border-[color:var(--sg-outline-soft)] px-3 py-3 text-xs leading-relaxed text-[color:var(--sg-text-muted)]">
                    <div className="font-medium text-[color:var(--sg-text)]">{localizedStrategyLabel}</div>
                    <div className="mt-1">
                        {copy.referenceLine}: T24 = {effectiveProfile.baseTempC.toFixed(1)} + {effectiveProfile.slopeCPerMjM2.toFixed(2)} x {locale === 'ko' ? '광량 합계' : 'radiation sum'} (MJ m⁻² d⁻¹).
                    </div>
                    <div className="mt-1">
                        {copy.profileMode}: {calibrationModeLabel}, {locale === 'ko' ? '샘플 일수' : 'sample days'} {effectiveProfile.calibration.sampleDays}.
                    </div>
                    <div className="mt-1">
                        {copy.selectionPath}: {selectionLabel}.
                    </div>
                    {effectiveProfile.calibration.rSquared !== null ? (
                        <div className="mt-1">
                            {copy.fitQuality}: R² {effectiveProfile.calibration.rSquared.toFixed(2)}, MAE {effectiveProfile.calibration.meanAbsoluteErrorC?.toFixed(2)}°C.
                        </div>
                    ) : null}
                    <div className="mt-1">
                        {copy.currentControlWindow}: {temperatureSettings.heating}&deg;C to {temperatureSettings.cooling}&deg;C.
                    </div>
                    {profileErrorCopy ? (
                        <div className="mt-1 text-[color:var(--sg-accent-earth)]">
                            {profileErrorCopy}
                        </div>
                    ) : null}
                </div>
                )}
            </div>
        </div>
    );
};

export default RTROutlookPanel;
