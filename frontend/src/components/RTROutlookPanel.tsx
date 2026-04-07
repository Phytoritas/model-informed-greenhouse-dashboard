import { CalendarDays, Leaf, Sun, Target, Thermometer } from 'lucide-react';
import type { CropType, RtrProfile, SensorData, TemperatureSettings, WeatherOutlook } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { formatLocaleDate } from '../i18n/locale';
import { getCropLabel, getWeatherLabel } from '../utils/displayCopy';
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
        if (mode === 'insufficient-data') return '기준선 유지(데이터 부족)';
        return '기준선';
    }

    return mode;
};

const getLocalizedStrategyLabel = (profile: RtrProfile, locale: 'en' | 'ko'): string => {
    if (locale !== 'ko') {
        return profile.strategyLabel;
    }

    const cropLabel = getCropLabel(profile.crop, locale);
    if (profile.calibration.mode === 'fitted') {
        return `${cropLabel} 하우스 보정 RTR 선`;
    }
    if (profile.calibration.mode === 'insufficient-data') {
        return `${cropLabel} RTR 기준선(데이터 보강 필요)`;
    }
    return `${cropLabel} RTR 기준선`;
};

const getLocalizedSourceNote = (profile: RtrProfile, locale: 'en' | 'ko'): string => {
    if (locale !== 'ko') {
        return profile.sourceNote;
    }

    const { calibration } = profile;
    if (calibration.mode === 'fitted') {
        if (calibration.selectionSource === 'curated-windows') {
            return `고생산 구간 ${calibration.windowCount ?? 0}개에서 quality-filtered 일별 RTR 포인트 ${calibration.sampleDays}개를 사용해 보정한 하우스 맞춤 RTR 선입니다.`;
        }
        return `이 하우스의 quality-filtered 일별 RTR 포인트 ${calibration.sampleDays}개를 사용해 보정한 하우스 맞춤 RTR 선입니다.`;
    }

    if (calibration.mode === 'insufficient-data') {
        if (calibration.selectionSource === 'curated-windows') {
            return '고생산 구간은 설정되어 있지만 보정에 충분한 일별 RTR 포인트가 아직 부족해 기준선을 유지합니다.';
        }
        return '하우스별 데이터를 더 확보하기 전까지는 RTR 기준선을 유지합니다.';
    }

    if (profile.crop === 'Tomato') {
        return 'WUR RTR 프레이밍과 TomatoesNZ 예시 그래프를 기준으로 한 토마토 RTR 기준선입니다. 하우스별 고생산 구간이 확보되면 다시 보정하세요.';
    }

    return '오이의 24시간 평균온도 가이드를 기준으로 한 RTR 기준선입니다. 하우스별 고생산 구간이 확보되면 다시 보정하세요.';
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
            title: 'RTR 모니터',
            subtitle: `${getCropLabel(crop, locale)}의 최근 24시간 광-온도 균형`,
            profileLoading: 'RTR 프로파일을 불러오는 중...',
            rolling: '최근 24시간 RTR',
            vsProfile: '프로파일 기준선 대비',
            coverage: '윈도우 커버리지',
            radiationSum: '광량 합계',
            meanTemp: '24시간 평균 온도',
            exampleTarget: '예시 목표',
            steeringPlan: '3일 RTR 제어 계획',
            forecastLoading: '대구 복사 예보를 불러오는 중...',
            forecastWaiting: '복사량 데이터가 들어오면 RTR 목표가 계산됩니다.',
            weatherUnavailable: '날씨 기반 RTR 예측을 불러올 수 없습니다',
            referenceLine: '기준식',
            profileMode: '프로파일 모드',
            selectionPath: '선정 경로',
            fitQuality: '적합도',
            currentControlWindow: '현재 제어 범위',
            profileEndpointUnavailable: 'RTR 프로파일 엔드포인트를 사용할 수 없어 내장 기준선을 사용합니다',
            selectionCurated: '선별 윈도우',
            selectionFallback: '휴리스틱 fallback',
            badgeFitted: '하우스 보정',
            badgeBaselineNeedMore: '기준선 (데이터 부족)',
            badgeBaseline: '기준선',
            balanced: {
                badge: 'RTR 기준선 근처',
                tone: 'bg-emerald-100 text-emerald-700',
                description: '온도와 광이 비교적 균형 있게 움직이고 있습니다.',
            },
            'warm-for-light': {
                badge: '광량 대비 고온',
                tone: 'bg-rose-100 text-rose-700',
                description: '현재 광량보다 온도가 앞서 있어 작물이 더 생식생장 쪽으로 기울 수 있습니다.',
            },
            'cool-for-light': {
                badge: '광량 대비 저온',
                tone: 'bg-sky-100 text-sky-700',
                description: '현재 온도보다 광이 강해 작물이 더 영양생장 쪽으로 기울 수 있습니다.',
            },
        }
        : {
            title: 'RTR Monitor',
            subtitle: `Rolling 24 h radiation-to-temperature balance for ${crop}`,
            profileLoading: 'Loading RTR profile...',
            rolling: 'Rolling 24 h RTR',
            vsProfile: 'vs profile line',
            coverage: 'Window coverage',
            radiationSum: 'Radiation sum',
            meanTemp: '24 h mean temp',
            exampleTarget: 'Example target',
            steeringPlan: '3-day RTR steering plan',
            forecastLoading: 'Loading Daegu radiation forecast...',
            forecastWaiting: 'Forecast-linked RTR targets are waiting for radiation data.',
            weatherUnavailable: 'Weather-linked RTR forecast is unavailable',
            referenceLine: 'Reference line',
            profileMode: 'Profile mode',
            selectionPath: 'Selection path',
            fitQuality: 'Fit quality',
            currentControlWindow: 'Current control window',
            profileEndpointUnavailable: 'RTR profile endpoint unavailable, using bundled baseline',
            selectionCurated: 'curated windows',
            selectionFallback: 'heuristic fallback',
            badgeFitted: 'House-fit',
            badgeBaselineNeedMore: 'Baseline (needs more data)',
            badgeBaseline: 'Baseline',
            balanced: {
                badge: 'Near RTR line',
                tone: 'bg-emerald-100 text-emerald-700',
                description: 'Temperature and light are moving together in a balanced range.',
            },
            'warm-for-light': {
                badge: 'Warm for light',
                tone: 'bg-rose-100 text-rose-700',
                description: 'Temperature is running ahead of the available light, which can push the crop more generative.',
            },
            'cool-for-light': {
                badge: 'Cool for light',
                tone: 'bg-sky-100 text-sky-700',
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
    const profileBadge = effectiveProfile.calibration.mode === 'fitted'
        ? `${copy.badgeFitted} (${effectiveProfile.calibration.sampleDays}${locale === 'ko' ? '일' : ' d'})`
        : effectiveProfile.calibration.mode === 'insufficient-data'
            ? copy.badgeBaselineNeedMore
            : copy.badgeBaseline;
    const selectionLabel = effectiveProfile.calibration.selectionSource === 'curated-windows'
        ? `${copy.selectionCurated} (${effectiveProfile.calibration.windowCount ?? 0})`
        : copy.selectionFallback;

    return (
        <div className={`flex h-full flex-col rounded-xl border border-slate-100 bg-white shadow-sm ${compact ? 'p-3' : 'p-5'}`}>
            <div className={`flex items-start justify-between gap-3 ${compact ? 'mb-2' : 'mb-4'}`}>
                <div>
                    <div className="flex items-center gap-2 text-slate-800">
                        <Target className="h-5 w-5 text-emerald-600" />
                        <h3 className={compact ? 'text-sm font-semibold' : 'font-semibold'}>{copy.title}</h3>
                    </div>
                    {!compact && (
                    <p className="mt-1 text-xs text-slate-400">
                        {copy.subtitle}
                    </p>
                    )}
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
                        {profileBadge}
                    </div>
                    {profileLoading ? (
                        <div className="text-[11px] text-slate-400">{copy.profileLoading}</div>
                    ) : null}
                </div>
            </div>

            <div className="flex h-full flex-col space-y-4">
                <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-lime-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <Leaf className="h-3.5 w-3.5 text-emerald-600" />
                                <span>{copy.rolling}</span>
                            </div>
                            <div className="mt-2 flex items-baseline gap-2 text-slate-900">
                                <span className="text-3xl font-bold">{liveSnapshot.deltaTempC.toFixed(1)}&deg;C</span>
                                <span className="text-sm text-slate-500">{copy.vsProfile}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-700">{balanceCopy.description}</p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500">{localizedSourceNote}</p>
                        </div>
                        <div className={`rounded-2xl px-3 py-2 text-right text-xs font-medium shadow-sm ${balanceCopy.tone}`}>
                            {balanceCopy.badge}
                        </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">
                        {copy.coverage} {liveSnapshot.windowHours.toFixed(1)} h / 24 h
                        <span className="ml-2 font-medium text-slate-700">{liveSnapshot.coveragePct.toFixed(0)}%</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Sun className="h-4 w-4 text-amber-500" />
                            <span>{copy.radiationSum}</span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-800">
                            {liveSnapshot.radiationSumMjM2D.toFixed(1)} MJ m⁻²
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            DLI {liveSnapshot.dliMolM2D.toFixed(1)} mol m⁻² d⁻¹
                        </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <Thermometer className="h-4 w-4 text-orange-500" />
                            <span>{copy.meanTemp}</span>
                        </div>
                        <div className="mt-2 text-lg font-semibold text-slate-800">
                            {liveSnapshot.averageTempC.toFixed(1)}&deg;C
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            {copy.exampleTarget} {liveSnapshot.targetTempC.toFixed(1)}&deg;C
                        </div>
                    </div>
                </div>

                {!compact && (
                <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <CalendarDays className="h-4 w-4 text-slate-500" />
                        <span>{copy.steeringPlan}</span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        {loading ? (
                            <div className="rounded-md bg-white px-3 py-3 text-sm text-slate-500">
                                {copy.forecastLoading}
                            </div>
                        ) : forecastTargets.length > 0 ? (
                            forecastTargets.map((day) => (
                                <div key={day.date} className="h-full rounded-md bg-white px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-slate-800">{formatForecastLabel(day.date)}</div>
                                            <div className="mt-1 text-xs text-slate-500">{getWeatherLabel(undefined, day.weatherLabel, locale)}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-semibold text-slate-800">
                                                {day.targetTempC.toFixed(1)}&deg;C
                                            </div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                {day.radiationSumMjM2D.toFixed(1)} MJ m⁻² d⁻¹
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-md bg-white px-3 py-3 text-sm text-slate-500">
                                {copy.forecastWaiting}
                            </div>
                        )}
                    </div>
                    {error ? (
                        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800">
                            {copy.weatherUnavailable}: {error}
                        </div>
                    ) : null}
                </div>
                )}

                {!compact && (
                <div className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-xs leading-relaxed text-slate-500">
                    <div className="font-medium text-slate-700">{localizedStrategyLabel}</div>
                    <div className="mt-1">
                        {copy.referenceLine}: T24 = {effectiveProfile.baseTempC.toFixed(1)} + {effectiveProfile.slopeCPerMjM2.toFixed(2)} x radiation sum (MJ m⁻² d⁻¹).
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
                    {profileError ? (
                        <div className="mt-1 text-amber-700">
                            {copy.profileEndpointUnavailable}: {profileError}
                        </div>
                    ) : null}
                </div>
                )}
            </div>
        </div>
    );
};

export default RTROutlookPanel;
