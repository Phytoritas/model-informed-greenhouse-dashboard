import { CloudSun, Coins, Gauge, Zap } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { AdvancedModelMetrics, ProducePricesPayload, SensorData, WeatherOutlook } from '../../types';
import DashboardCard from '../common/DashboardCard';

interface DecisionSnapshotGridProps {
    currentData: SensorData;
    modelMetrics: AdvancedModelMetrics;
    weather: WeatherOutlook | null;
    weatherLoading: boolean;
    producePrices: ProducePricesPayload | null;
    produceLoading: boolean;
}

function SignalPill({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <div
            className="rounded-[22px] bg-white/82 px-4 py-3"
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--sg-text-faint)]">
                {label}
            </div>
            <div className="mt-2 text-sm font-semibold tracking-[-0.03em] text-[color:var(--sg-text-strong)]">
                {value}
            </div>
        </div>
    );
}

function CompactSnapshotTile({
    icon: Icon,
    title,
    headline,
    body,
    tone,
}: {
    icon: typeof CloudSun;
    title: string;
    headline: string;
    body: string;
    tone: 'green' | 'amber' | 'violet';
}) {
    const toneClass = {
        green: 'sg-tint-green text-[color:var(--sg-accent-forest)]',
        amber: 'sg-tint-amber text-[color:var(--sg-accent-amber)]',
        violet: 'sg-tint-violet text-[color:var(--sg-accent-violet)]',
    }[tone];

    return (
        <article
            className={`relative overflow-hidden rounded-[28px] px-5 py-5 ${toneClass}`}
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            <div className="absolute right-4 top-4 h-20 w-20 rounded-full bg-white/16 blur-2xl" />
            <div className="relative flex items-start gap-3">
                <div
                    className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/82"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="sg-eyebrow">{title}</div>
                    <div className="mt-3 text-xl font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
                        {headline}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                        {body}
                    </p>
                </div>
            </div>
        </article>
    );
}

export default function DecisionSnapshotGrid({
    currentData,
    modelMetrics,
    weather,
    weatherLoading,
    producePrices,
    produceLoading,
}: DecisionSnapshotGridProps) {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            eyebrow: '운영 스냅샷',
            title: '날씨 · 가격 · 에너지 · 생육 요약',
            description: '보조 데이터도 오늘 제어와 출하 판단에 연결되도록 짧게 요약합니다.',
            weatherTitle: '오늘 외기 변화',
            weatherLead: '오늘 제어와 환기 판단의 기준이 되는 외기 흐름입니다.',
            marketTitle: '시장/가격',
            energyTitle: '에너지/부하',
            cropTitle: '생육 해석',
            weatherLoading: '예보 수집 중',
            weatherBodyLoading: '외기 온도와 일사 예보를 불러오는 중입니다.',
            marketLoading: '시장 데이터 준비 중',
            marketBodyLoading: '출하 가격과 최근 변동률을 곧 연결합니다.',
            marketDelta: '전일 대비',
            marketLocation: '시장',
            won: '원',
            energyModeAuto: '자동',
            cropHeadline: 'LAI',
            cropAssimilation: '광합성',
            cropBodyBiomass: '생체중',
            cropBodyVpd: 'VPD',
            humidity: '습도',
            wind: '풍속',
            radiation: '일사',
            marketLead: '출하 판단에 바로 연결할 가격 신호입니다.',
            energyLoad: '현재 소비와 HVAC 효율',
            cropLead: '생육 여유와 동화 상태를 함께 봅니다.',
            mj: 'MJ/m²',
        }
        : {
            eyebrow: 'Decision snapshots',
            title: 'Weather · market · energy · crop summary',
            description: 'Keep supporting signals connected to today’s control and shipping decisions.',
            weatherTitle: 'Outdoor shift',
            weatherLead: 'The outside climate signal that should steer today’s vent and control posture.',
            marketTitle: 'Market / price',
            energyTitle: 'Energy / load',
            cropTitle: 'Crop interpretation',
            weatherLoading: 'Forecast loading',
            weatherBodyLoading: 'Outdoor temperature and radiation forecast are loading.',
            marketLoading: 'Market data loading',
            marketBodyLoading: 'Price and recent market change will appear shortly.',
            marketDelta: 'day over day',
            marketLocation: 'Market',
            won: 'KRW',
            energyModeAuto: 'Auto',
            cropHeadline: 'LAI',
            cropAssimilation: 'Assimilation',
            cropBodyBiomass: 'Biomass',
            cropBodyVpd: 'VPD',
            humidity: 'Humidity',
            wind: 'Wind',
            radiation: 'Radiation',
            marketLead: 'The shipping signal you should keep in view.',
            energyLoad: 'Current power draw and HVAC efficiency.',
            cropLead: 'Read crop slack and assimilation together.',
            mj: 'MJ/m²',
        };
    const leadMarketItem = producePrices?.items?.[0] ?? null;
    const priceLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
    const todayForecast = weather?.daily?.[0] ?? null;
    const weatherHeadline = weatherLoading || !weather
        ? copy.weatherLoading
        : `${weather.current.temperature_c.toFixed(1)}°C · ${weather.current.weather_label}`;
    const weatherBody = weatherLoading || !weather ? copy.weatherBodyLoading : weather.summary;
    const marketHeadline = produceLoading || !leadMarketItem
        ? copy.marketLoading
        : `${leadMarketItem.display_name} ${leadMarketItem.current_price_krw.toLocaleString(priceLocale)}${copy.won}`;
    const marketBody = produceLoading || !leadMarketItem
        ? copy.marketBodyLoading
        : `${leadMarketItem.market_label} · ${copy.marketDelta} ${leadMarketItem.day_over_day_pct.toFixed(1)}%`;

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.description}
        >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(0,0.92fr)]">
                <article
                    className="relative overflow-hidden rounded-[32px] px-6 py-6 sg-tint-blue"
                    style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                >
                    <div className="absolute -right-10 -top-8 h-36 w-36 rounded-full bg-white/20 blur-3xl" />
                    <div className="relative flex flex-col gap-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/84"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <CloudSun className="h-6 w-6 text-[color:var(--sg-accent-blue)]" />
                                </div>
                                <div>
                                    <div className="sg-eyebrow">{copy.weatherTitle}</div>
                                    <div className="mt-3 text-[clamp(1.7rem,2.2vw,2.6rem)] font-semibold tracking-[-0.07em] text-[color:var(--sg-text-strong)]">
                                        {weatherHeadline}
                                    </div>
                                </div>
                            </div>
                            <div
                                className="rounded-full bg-white/82 px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-blue)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                {copy.weatherLead}
                            </div>
                        </div>

                        <p className="max-w-2xl text-sm leading-7 text-[color:var(--sg-text-muted)]">
                            {weatherBody}
                        </p>

                        <div className="grid gap-3 md:grid-cols-3">
                            <SignalPill
                                label={copy.humidity}
                                value={weatherLoading || !weather ? '—' : `${weather.current.relative_humidity_pct.toFixed(0)}%`}
                            />
                            <SignalPill
                                label={copy.wind}
                                value={weatherLoading || !weather ? '—' : `${weather.current.wind_speed_kmh.toFixed(1)} km/h`}
                            />
                            <SignalPill
                                label={copy.radiation}
                                value={weatherLoading || !todayForecast ? '—' : `${todayForecast.shortwave_radiation_sum_mj_m2.toFixed(1)} ${copy.mj}`}
                            />
                        </div>
                    </div>
                </article>

                <div className="grid gap-4">
                    <article
                        className="relative overflow-hidden rounded-[28px] px-5 py-5 sg-tint-amber"
                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                    >
                        <div className="absolute right-4 top-4 h-16 w-16 rounded-full bg-white/18 blur-2xl" />
                        <div className="relative flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div
                                    className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white/84"
                                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                >
                                    <Coins className="h-5 w-5 text-[color:var(--sg-accent-amber)]" />
                                </div>
                                <div>
                                    <div className="sg-eyebrow">{copy.marketTitle}</div>
                                    <div className="mt-3 text-xl font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                        {marketHeadline}
                                    </div>
                                </div>
                            </div>
                            <div
                                className="rounded-full bg-white/84 px-3 py-1.5 text-[11px] font-semibold text-[color:var(--sg-accent-amber)]"
                                style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            >
                                {copy.marketLocation}
                            </div>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                            {copy.marketLead}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <SignalPill label={copy.marketTitle} value={marketBody} />
                            <SignalPill
                                label={copy.marketDelta}
                                value={produceLoading || !leadMarketItem ? '—' : `${leadMarketItem.day_over_day_pct.toFixed(1)}%`}
                            />
                        </div>
                    </article>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                        <CompactSnapshotTile
                            icon={Zap}
                            title={copy.energyTitle}
                            headline={`${modelMetrics.energy.consumption.toFixed(1)} kW`}
                            body={`${copy.energyLoad} · ${modelMetrics.energy.mode ?? copy.energyModeAuto} · ${modelMetrics.energy.efficiency.toFixed(2)} COP`}
                            tone="green"
                        />
                        <CompactSnapshotTile
                            icon={Gauge}
                            title={copy.cropTitle}
                            headline={`${copy.cropHeadline} ${modelMetrics.growth.lai.toFixed(2)} · ${copy.cropAssimilation} ${currentData.photosynthesis.toFixed(1)}`}
                            body={`${copy.cropLead} · ${copy.cropBodyBiomass} ${modelMetrics.growth.biomass.toFixed(0)} g/m² · ${copy.cropBodyVpd} ${currentData.vpd.toFixed(2)} kPa`}
                            tone="violet"
                        />
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
}
