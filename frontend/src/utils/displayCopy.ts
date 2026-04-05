import type { CropType } from '../types';
import type { AppLocale } from '../i18n/locale';

export const UNIT_LABELS = {
    temperature: '°C',
    humidity: '%',
    carbonDioxide: 'ppm',
    photonFlux: 'µmol m⁻² s⁻¹',
    radiativeFlux: 'W m⁻²',
    vpd: 'kPa',
    stomatalConductance: 'mol H₂O m⁻² s⁻¹',
    transpirationRate: 'mm H₂O h⁻¹',
    transpirationDepth: 'mm H₂O',
    biomassGrowthRate: 'g m⁻² d⁻¹',
    biomassDensity: 'g m⁻²',
    leafAreaIndex: 'm² m⁻²',
    weeklyYield: 'kg',
    energyDemand: 'kW',
    energyUse: 'kWh',
} as const;

const DASHBOARD_SENSOR_TITLES = {
    en: {
        temperature: 'Air Temperature',
        humidity: 'Relative Humidity',
        carbonDioxide: 'CO₂ Concentration',
        light: 'Photosynthetic Photon Flux Density',
        vpd: 'Vapor Pressure Deficit',
        stomatalConductance: 'Stomatal Conductance',
    },
    ko: {
        temperature: '기온',
        humidity: '상대습도',
        carbonDioxide: 'CO₂ 농도',
        light: '광합성 광양자속 밀도',
        vpd: '증기압 포차',
        stomatalConductance: '기공전도도',
    },
} as const;

const IDEAL_RANGES: Record<CropType, Record<'temperature' | 'humidity' | 'light' | 'vpd', string>> = {
    Tomato: {
        temperature: '18-26 °C',
        humidity: '60-80 %',
        light: '> 600 µmol m⁻² s⁻¹',
        vpd: '0.5-1.2 kPa',
    },
    Cucumber: {
        temperature: '20-28 °C',
        humidity: '70-90 %',
        light: '> 600 µmol m⁻² s⁻¹',
        vpd: '0.5-1.2 kPa',
    },
};

const WEATHER_LABELS_KO: Record<number, string> = {
    0: '맑음',
    1: '대체로 맑음',
    2: '구름 조금',
    3: '흐림',
    45: '안개',
    48: '착빙 안개',
    51: '약한 이슬비',
    53: '보통 이슬비',
    55: '강한 이슬비',
    56: '약한 어는 이슬비',
    57: '강한 어는 이슬비',
    61: '약한 비',
    63: '보통 비',
    65: '강한 비',
    66: '약한 어는 비',
    67: '강한 어는 비',
    71: '약한 눈',
    73: '보통 눈',
    75: '강한 눈',
    77: '싸락눈',
    80: '약한 소나기',
    81: '보통 소나기',
    82: '매우 강한 소나기',
    85: '약한 눈 소나기',
    86: '강한 눈 소나기',
    95: '뇌우',
    96: '약한 우박을 동반한 뇌우',
    99: '강한 우박을 동반한 뇌우',
};

const WEATHER_LABELS_BY_ENGLISH: Record<string, string> = {
    'Clear sky': '맑음',
    'Mainly clear': '대체로 맑음',
    'Partly cloudy': '구름 조금',
    'Overcast': '흐림',
    'Fog': '안개',
    'Rime fog': '착빙 안개',
    'Light drizzle': '약한 이슬비',
    'Moderate drizzle': '보통 이슬비',
    'Dense drizzle': '강한 이슬비',
    'Light freezing drizzle': '약한 어는 이슬비',
    'Dense freezing drizzle': '강한 어는 이슬비',
    'Slight rain': '약한 비',
    'Moderate rain': '보통 비',
    'Heavy rain': '강한 비',
    'Light freezing rain': '약한 어는 비',
    'Heavy freezing rain': '강한 어는 비',
    'Slight snow': '약한 눈',
    'Moderate snow': '보통 눈',
    'Heavy snow': '강한 눈',
    'Snow grains': '싸락눈',
    'Light rain showers': '약한 소나기',
    'Moderate rain showers': '보통 소나기',
    'Violent rain showers': '매우 강한 소나기',
    'Light snow showers': '약한 눈 소나기',
    'Heavy snow showers': '강한 눈 소나기',
    'Thunderstorm': '뇌우',
    'Thunderstorm with slight hail': '약한 우박을 동반한 뇌우',
    'Thunderstorm with heavy hail': '강한 우박을 동반한 뇌우',
    'Unknown conditions': '상태 정보 없음',
};

const DEVELOPMENT_STAGE_LABELS: Record<string, { en: string; ko: string }> = {
    Init: { en: 'Init', ko: '초기화' },
    Growing: { en: 'Growing', ko: '생육 중' },
    Vegetative: { en: 'Vegetative', ko: '영양생장' },
    Generative: { en: 'Generative', ko: '생식생장' },
    Flowering: { en: 'Flowering', ko: '개화기' },
    Fruiting: { en: 'Fruiting', ko: '결실기' },
    Harvest: { en: 'Harvest', ko: '수확기' },
};

const PRODUCE_LABELS: Record<string, { en: string; ko: string }> = {
    Tomato: { en: 'Tomato', ko: '토마토' },
    'Cherry Tomato': { en: 'Cherry Tomato', ko: '방울토마토' },
    'Cucumber (Dadagi)': { en: 'Cucumber (Dadagi)', ko: '오이(다다기)' },
    'Cucumber (Chuicheong)': { en: 'Cucumber (Chuicheong)', ko: '오이(취청)' },
};

export function getDashboardSensorCopy(locale: AppLocale) {
    const titles = DASHBOARD_SENSOR_TITLES[locale];
    return {
        temperature: { title: titles.temperature, unit: UNIT_LABELS.temperature },
        humidity: { title: titles.humidity, unit: UNIT_LABELS.humidity },
        carbonDioxide: { title: titles.carbonDioxide, unit: UNIT_LABELS.carbonDioxide },
        light: { title: titles.light, unit: UNIT_LABELS.photonFlux },
        vpd: { title: titles.vpd, unit: UNIT_LABELS.vpd },
        stomatalConductance: { title: titles.stomatalConductance, unit: UNIT_LABELS.stomatalConductance },
    } as const;
}

export const getIdealRanges = (_locale: AppLocale) => {
    void _locale;
    return IDEAL_RANGES;
};

export const getCropLabel = (crop: CropType, locale: AppLocale): string =>
    crop === 'Tomato'
        ? (locale === 'ko' ? '토마토' : 'Tomato')
        : (locale === 'ko' ? '오이' : 'Cucumber');

export const getCropModelLabel = (crop: CropType, locale: AppLocale): string =>
    crop === 'Tomato'
        ? (locale === 'ko' ? '토마토 디지털 트윈' : 'Tomato digital twin')
        : (locale === 'ko' ? '오이 디지털 트윈' : 'Cucumber digital twin');

export const getCropStatusLabel = (crop: CropType, locale: AppLocale): string =>
    crop === 'Tomato'
        ? (locale === 'ko' ? '활성 화방 수' : 'Active trusses')
        : (locale === 'ko' ? '마디 수' : 'Node count');

export const getForecastTitle = (crop: CropType, locale: AppLocale): string =>
    locale === 'ko'
        ? `7일 수확·관수 전망: ${getCropLabel(crop, locale)}`
        : `7-day harvest and water forecast: ${crop}`;

export const getWeatherLabel = (
    weatherCode: number | null | undefined,
    fallbackLabel: string | undefined,
    locale: AppLocale,
): string => {
    if (locale === 'en') {
        return fallbackLabel || 'Unknown conditions';
    }

    if (typeof weatherCode === 'number' && weatherCode in WEATHER_LABELS_KO) {
        return WEATHER_LABELS_KO[weatherCode];
    }

    return WEATHER_LABELS_BY_ENGLISH[fallbackLabel ?? ''] ?? fallbackLabel ?? '상태 정보 없음';
};

export const getDevelopmentStageLabel = (stage: string, locale: AppLocale): string =>
    DEVELOPMENT_STAGE_LABELS[stage]?.[locale] ?? stage;

export const getProduceDisplayName = (name: string, locale: AppLocale): string =>
    PRODUCE_LABELS[name]?.[locale] ?? name;

export const getCountryLabel = (country: string, locale: AppLocale): string =>
    country === 'South Korea' && locale === 'ko' ? '대한민국' : country;
