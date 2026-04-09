import type { CropType } from '../types';
import type { AppLocale } from '../i18n/locale';
import type { NumericRange } from './sensorStatus';

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
        light: '유효 광량 (PPFD)',
        vpd: '수분부족분 (VPD)',
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

export type KpiSensorKey = 'temperature' | 'humidity' | 'co2' | 'light' | 'vpd' | 'stomatalConductance';

export const NUMERIC_IDEAL_RANGES: Record<CropType, Partial<Record<KpiSensorKey, NumericRange>>> = {
    Tomato: {
        temperature: { min: 18, max: 26 },
        humidity: { min: 60, max: 80 },
        co2: { min: 400, max: 800 },
        light: { min: 600, max: 1200 },
        vpd: { min: 0.5, max: 1.2 },
        stomatalConductance: { min: 0.3, max: 1.0 },
    },
    Cucumber: {
        temperature: { min: 20, max: 28 },
        humidity: { min: 70, max: 90 },
        co2: { min: 400, max: 800 },
        light: { min: 600, max: 1200 },
        vpd: { min: 0.5, max: 1.2 },
        stomatalConductance: { min: 0.3, max: 1.0 },
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
    Cucumber: { en: 'Cucumber', ko: '오이' },
    Tomato: { en: 'Tomato', ko: '토마토' },
    'Cherry Tomato': { en: 'Cherry Tomato', ko: '방울토마토' },
    'Cucumber (Dadagi)': { en: 'Cucumber (Dadagi)', ko: '오이(다다기)' },
    'Cucumber (Chuicheong)': { en: 'Cucumber (Chuicheong)', ko: '오이(취청)' },
};

const CULTIVATION_MEDIUM_LABELS: Record<string, { en: string; ko: string }> = {
    soil: { en: 'Soil', ko: '토양' },
    substrate: { en: 'Substrate', ko: '배지' },
    rockwool: { en: 'Rockwool', ko: '암면' },
    coco: { en: 'Coco', ko: '코코피트' },
    cocopeat: { en: 'Coco peat', ko: '코코피트' },
    perlite: { en: 'Perlite', ko: '펄라이트' },
    peat: { en: 'Peat moss', ko: '피트모스' },
    hydroponic: { en: 'Hydroponic', ko: '수경' },
    water: { en: 'Water', ko: '수경' },
    slab: { en: 'Slab', ko: '슬래브' },
};

const COMMON_TOKEN_LABELS: Record<string, { en: string; ko: string }> = {
    high: { en: 'high', ko: '높음' },
    medium: { en: 'medium', ko: '보통' },
    low: { en: 'low', ko: '낮음' },
    critical: { en: 'critical', ko: '위험' },
    warning: { en: 'warning', ko: '주의' },
    success: { en: 'success', ko: '정상' },
    error: { en: 'error', ko: '오류' },
    loading: { en: 'loading', ko: '로딩 중' },
    idle: { en: 'idle', ko: '대기' },
    ready: { en: 'ready', ko: '준비됨' },
    'history unavailable': { en: 'history unavailable', ko: '이력 없음' },
    'retrieval unavailable': { en: 'retrieval unavailable', ko: '검색 불가' },
    'database missing': { en: 'database missing', ko: '데이터베이스 없음' },
    'intent routed hybrid': { en: 'Intent-routed hybrid', ko: '의도 기반 혼합 검색' },
    'lexical fallback': { en: 'Lexical fallback', ko: '키워드 보완 검색' },
    'no matches': { en: 'no matches', ko: '일치 근거 없음' },
    active: { en: 'Active', ko: '가동' },
    balanced: { en: 'Balanced', ko: '균형' },
    staggered: { en: 'Staggered', ko: '분산 작업' },
    minor: { en: 'Minor', ko: '경미' },
    skipped: { en: 'skipped', ko: '건너뜀' },
    unavailable: { en: 'unavailable', ko: '사용 불가' },
    actionable: { en: 'actionable', ko: '실행 가능' },
    'monitoring first': { en: 'monitoring first', ko: '모니터링 우선' },
    environment: { en: 'Environment', ko: '환경제어' },
    physiology: { en: 'Physiology', ko: '재배생리' },
    work: { en: 'Work', ko: '재배작업' },
    pesticide: { en: 'Pesticide', ko: '병해충 / 농약' },
    nutrient: { en: 'Nutrient', ko: '양액 레시피' },
    'harvest market': { en: 'Harvest & Market', ko: '수확 / 가격' },
    immediate: { en: 'Immediate', ko: '즉시' },
    today: { en: 'Today', ko: '오늘' },
    now: { en: 'Now', ko: '지금' },
    monitor: { en: 'Monitor', ko: '모니터링' },
    'next 3d': { en: 'Next 3d', ko: '3일 내' },
    'next 3 days': { en: 'Next 3 days', ko: '향후 3일' },
    'today am': { en: 'Today AM', ko: '오늘 오전' },
    'today pm': { en: 'Today PM', ko: '오늘 오후' },
    'next 6h': { en: 'Next 6h', ko: '앞으로 6시간' },
    'next 24h': { en: 'Next 24h', ko: '앞으로 24시간' },
    'next run': { en: 'Next run', ko: '다음 실행' },
    'this week': { en: 'This week', ko: '이번주' },
    up: { en: 'up', ko: '상승' },
    down: { en: 'down', ko: '하락' },
    flat: { en: 'flat', ko: '보합' },
    stable: { en: 'stable', ko: '안정' },
    increase: { en: 'increase', ko: '상향' },
    decrease: { en: 'decrease', ko: '하향' },
    maintain: { en: 'maintain', ko: '유지' },
    hold: { en: 'hold', ko: '유지' },
    yes: { en: 'yes', ko: '예' },
    no: { en: 'no', ko: '아니오' },
    'above seasonal normal': { en: 'above seasonal normal', ko: '계절 평균 이상' },
    'below seasonal normal': { en: 'below seasonal normal', ko: '계절 평균 이하' },
    'near seasonal normal': { en: 'near seasonal normal', ko: '계절 평균 부근' },
    weather: { en: 'Weather', ko: '날씨' },
    'produce prices': { en: 'Produce prices', ko: '가격 데이터' },
    'rtr profile': { en: 'RTR profile', ko: 'RTR 프로필' },
    history: { en: 'History', ko: '이력' },
    telemetry: { en: 'Telemetry', ko: '실시간 계측' },
    forecast: { en: 'Forecast', ko: '예보' },
    'current data': { en: 'Current data', ko: '현재 데이터' },
    'model runtime': { en: 'Model runtime', ko: '예측 모델 분석' },
    deterministic: { en: 'Deterministic', ko: '실행형' },
    'single fertilizer stoichiometric': { en: 'Single-fertilizer draft', ko: '단일 비료 처방안' },
    'macro lane bundle candidate': { en: 'Macro bundle draft', ko: '다량 원소 혼합 처방안' },
    'workflow visibility': { en: 'Workflow visibility', ko: '작업 가시성' },
    'workflow stability': { en: 'Workflow stability', ko: '작업 안정성' },
    'labor balance': { en: 'Labor balance', ko: '작업 균형' },
    'harvest load': { en: 'Harvest load', ko: '수확 부하' },
    'touch work separation': { en: 'Touch-work separation', ko: '접촉 작업 분리' },
    'irrigation precheck': { en: 'Irrigation precheck', ko: '급액 사전 점검' },
    'tomato load balance': { en: 'Tomato load balance', ko: '토마토 착과 균형' },
    'cucumber canopy rhythm': { en: 'Cucumber canopy rhythm', ko: '오이 캐노피 리듬' },
    'humidity control': { en: 'Humidity control', ko: '습도 제어' },
    'rtr recovery': { en: 'RTR recovery', ko: 'RTR 회복' },
    'rtr balance': { en: 'RTR balance', ko: 'RTR 균형' },
    'heat stress': { en: 'Heat stress', ko: '고온 스트레스' },
    'heat preparation': { en: 'Heat preparation', ko: '고온 사전 준비' },
    'forecast humidity': { en: 'Forecast humidity', ko: '예보 습도' },
    'co2 support': { en: 'CO2 support', ko: 'CO2 보강' },
    'stability watch': { en: 'Stability watch', ko: '안정성 모니터링' },
    'inside climate missing': { en: 'Inside climate missing', ko: '실내 기후 누락' },
    'workflow visibility missing': { en: 'Workflow visibility missing', ko: '작업 이력 부족' },
    'humidity sensitive window': { en: 'Humidity-sensitive window', ko: '고습 민감 창' },
    'harvest window open': { en: 'Harvest window open', ko: '수확 창 열림' },
    'high etc day': { en: 'High ETc day', ko: '고 ETc 일' },
    'heat peak risk': { en: 'Heat-peak risk', ko: '고온 피크 위험' },
    'storm risk': { en: 'Storm risk', ko: '기상 위험' },
    'rtr cool gap': { en: 'RTR cool gap', ko: 'RTR 냉각 편차' },
    'fruit load pressure': { en: 'Fruit-load pressure', ko: '착과 부하 압력' },
    'fruit pressure': { en: 'Fruit pressure', ko: '과실 압력' },
    'watch load': { en: 'Load watch', ko: '부하 주의' },
    'fruit load': { en: 'Fruit load', ko: '과실 부하' },
    'canopy extension pressure': { en: 'Canopy-extension pressure', ko: '캐노피 확장 압력' },
    'steady rhythm': { en: 'Steady rhythm', ko: '기본 작업 리듬' },
    'protected harvest window': { en: 'Protected harvest window', ko: '보호 수확 창' },
    'irrigation and heat prep': { en: 'Irrigation and heat prep', ko: '급액·고온 대비' },
    'load protected rhythm': { en: 'Load-protected rhythm', ko: '부하 보호 리듬' },
    'harvest first': { en: 'Harvest first', ko: '수확 우선' },
    'dehumidify and rtr recovery': { en: 'Dehumidify + RTR recovery', ko: '제습 + RTR 회복' },
    'dehumidify first': { en: 'Dehumidify first', ko: '제습 우선' },
    'heat buffering': { en: 'Heat buffering', ko: '고온 완충' },
    'transpiration protection': { en: 'Transpiration protection', ko: '증산 보호' },
    'co2 recovery': { en: 'CO2 recovery', ko: 'CO2 회복' },
    'steady state': { en: 'Steady state', ko: '안정 운전' },
    'harvest heavy': { en: 'Harvest heavy', ko: '수확 중심' },
    'humidity constrained': { en: 'Humidity constrained', ko: '습도 제약' },
    'recommendation available': { en: 'Recommendation available', ko: '추천 가능' },
    'calculation available': { en: 'Calculation available', ko: '계산 가능' },
    'no safe recommendation': { en: 'No safe recommendation', ko: '안전 추천 없음' },
    'macro bundle': { en: 'Macro bundle', ko: '매크로 번들' },
    'source water review': { en: 'Source-water review', ko: '원수 검토' },
    'drain water review': { en: 'Drain-water review', ko: '배액 검토' },
    'drain feedback plan': { en: 'Drain-feedback plan', ko: '배액 피드백 계획' },
    'bundle execution': { en: 'Bundle execution', ko: '번들 실행안' },
    'residual safe alternative': { en: 'Residual-safe alternative', ko: '잔여 안전 대안' },
    'workbook drain stage': { en: 'Workbook drain stage', ko: '워크북 배액 단계' },
    'bounded step cap': { en: 'Bounded step cap', ko: '보정 상한' },
    'label check required': { en: 'Label check required', ko: '라벨 확인 필요' },
    'manual review': { en: 'Manual review', ko: '수동 검토' },
    adjusted: { en: 'Adjusted', ko: '조정됨' },
    provisional: { en: 'Provisional', ko: '임시안' },
    supported: { en: 'Supported', ko: '지원됨' },
    unsupported: { en: 'Unsupported', ko: '지원되지 않음' },
    clamped: { en: 'Clamped', ko: '상한 적용' },
    none: { en: 'None', ko: '없음' },
    'n/a': { en: 'n/a', ko: '정보 없음' },
    'tank n/a': { en: 'tank:n/a', ko: '탱크 미정' },
    'moa n/a': { en: 'MOA n/a', ko: 'MOA 미상' },
    'leaf removal': { en: 'Leaf removal', ko: '적엽' },
    'fruit thinning': { en: 'Fruit thinning', ko: '적과' },
    'leaf guard': { en: 'Leaf guard', ko: '최소 엽수' },
    'sink overload': { en: 'Sink overload', ko: '싱크 과부하' },
    'vegetative leaning': { en: 'Vegetative leaning', ko: '웃자람 주의' },
    'generative leaning': { en: 'Generative leaning', ko: '생식생장 치우침' },
    'stress watch': { en: 'Stress watch', ko: '스트레스 주의' },
    agronomy: { en: 'Grower notes', ko: '재배 메모' },
    '14d fruit dm': { en: '14d fruit DM', ko: '14일 과실 건물중' },
    '14d lai': { en: '14d LAI', ko: '14일 LAI' },
    score: { en: 'Score', ko: '점수' },
};

function normalizeLookupKey(value: string): string {
    return value.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

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

    return WEATHER_LABELS_BY_ENGLISH[fallbackLabel ?? ''] ?? '상태 정보 없음';
};

export const getDevelopmentStageLabel = (stage: string, locale: AppLocale): string =>
    DEVELOPMENT_STAGE_LABELS[stage]?.[locale] ?? stage;

export const getProduceDisplayName = (name: string, locale: AppLocale): string =>
    PRODUCE_LABELS[name]?.[locale] ?? name;

export const getGenericCropLabel = (name: string, locale: AppLocale): string => {
    const normalized = normalizeLookupKey(name);
    if (normalized === 'tomato') {
        return locale === 'ko' ? '토마토' : 'Tomato';
    }
    if (normalized === 'cucumber') {
        return locale === 'ko' ? '오이' : 'Cucumber';
    }
    return PRODUCE_LABELS[name]?.[locale] ?? name;
};

export const getCultivationMediumLabel = (medium: string, locale: AppLocale): string => {
    const normalized = normalizeLookupKey(medium);
    return CULTIVATION_MEDIUM_LABELS[normalized]?.[locale] ?? medium;
};

export const getLocalizedTokenLabel = (value: string, locale: AppLocale): string => {
    const normalized = normalizeLookupKey(value);
    return COMMON_TOKEN_LABELS[normalized]?.[locale] ?? value;
};

export const getCountryLabel = (country: string, locale: AppLocale): string =>
    country === 'South Korea' && locale === 'ko' ? '대한민국' : country;
