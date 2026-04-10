import type { CSSProperties } from 'react';
import { CloudSun, Coins, Gauge, Zap } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import type { AdvancedModelMetrics, ProducePricesPayload, SensorData, WeatherOutlook } from '../../types';
import { getWeatherLabel } from '../../utils/displayCopy';
import DashboardCard from '../common/DashboardCard';

interface DecisionSnapshotGridProps {
    currentData: SensorData;
    modelMetrics: AdvancedModelMetrics;
    weather: WeatherOutlook | null;
    weatherLoading: boolean;
    producePrices: ProducePricesPayload | null;
    produceLoading: boolean;
}

const clampTwoStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
};

function SnapshotTile({
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
    tone: string;
}) {
    return (
        <article className={`rounded-[22px] px-4 py-4 ${tone}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/84 text-[color:var(--sg-text-strong)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold text-[color:var(--sg-text-strong)]">{title}</div>
            </div>
            <div className="mt-3 text-lg font-semibold leading-tight tracking-[-0.04em] text-[color:var(--sg-text-strong)]" style={clampTwoStyle}>
                {headline}
            </div>
            <div className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]" style={clampTwoStyle}>
                {body}
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
            eyebrow: '보조 흐름',
            title: '날씨 · 시세 · 에너지 · 생육',
            weatherTitle: '외기',
            marketTitle: '시세',
            energyTitle: '에너지',
            cropTitle: '생육',
            weatherLoading: '예보 수집 중',
            marketLoading: '시세 대기',
            marketDelta: '전일 대비',
            leadWeather: '오늘 환기 판단 기준',
            leadMarket: '출하 판단 신호',
            leadEnergy: '현재 소비와 효율',
            leadCrop: '잎층과 광합성 흐름',
            won: '원',
        }
        : {
            eyebrow: 'Support signals',
            title: 'Weather · market · energy · crop',
            weatherTitle: 'Weather',
            marketTitle: 'Market',
            energyTitle: 'Energy',
            cropTitle: 'Crop',
            weatherLoading: 'Forecast loading',
            marketLoading: 'Market loading',
            marketDelta: 'day over day',
            leadWeather: 'Vent and control signal',
            leadMarket: 'Shipping signal',
            leadEnergy: 'Current draw and efficiency',
            leadCrop: 'Canopy and assimilation read',
            won: 'KRW',
        };

    const leadMarketItem = producePrices?.items?.[0] ?? null;
    const priceLocale = locale === 'ko' ? 'ko-KR' : 'en-US';
    const weatherHeadline = weatherLoading || !weather
        ? copy.weatherLoading
        : `${weather.current.temperature_c.toFixed(1)}°C · ${getWeatherLabel(weather.current.weather_code, weather.current.weather_label, locale)}`;
    const localizedWeatherBody = weather
        ? locale === 'ko'
            ? `오늘은 ${getWeatherLabel(weather.daily[0]?.weather_code, weather.daily[0]?.weather_label, locale)} 흐름이며 강수 가능성 ${(weather.daily[0]?.precipitation_probability_max_pct ?? 0).toFixed(0)}%, 최대 풍속 ${(weather.daily[0]?.wind_speed_max_kmh ?? 0).toFixed(1)} km/h입니다.`
            : weather.summary
        : copy.leadWeather;
    const marketHeadline = produceLoading || !leadMarketItem
        ? copy.marketLoading
        : `${leadMarketItem.display_name} ${leadMarketItem.current_price_krw.toLocaleString(priceLocale)}${copy.won}`;
    const marketDelta = produceLoading || !leadMarketItem
        ? copy.marketLoading
        : `${copy.marketDelta} ${leadMarketItem.day_over_day_pct.toFixed(1)}%`;

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={undefined}
            contentClassName="h-full"
            className="h-full overflow-hidden"
        >
            <div className="grid h-full gap-3 sm:grid-cols-2">
                <SnapshotTile
                    icon={CloudSun}
                    title={copy.weatherTitle}
                    headline={weatherHeadline}
                    body={localizedWeatherBody}
                    tone="sg-tint-amber"
                />
                <SnapshotTile
                    icon={Coins}
                    title={copy.marketTitle}
                    headline={marketHeadline}
                    body={marketDelta || copy.leadMarket}
                    tone="sg-tint-amber"
                />
                <SnapshotTile
                    icon={Zap}
                    title={copy.energyTitle}
                    headline={`${modelMetrics.energy.consumption.toFixed(1)} kW`}
                    body={`${copy.leadEnergy} · ${modelMetrics.energy.efficiency.toFixed(2)} COP`}
                    tone="sg-tint-green"
                />
                <SnapshotTile
                    icon={Gauge}
                    title={copy.cropTitle}
                    headline={`LAI ${modelMetrics.growth.lai.toFixed(2)} · ${currentData.photosynthesis.toFixed(1)}`}
                    body={`${copy.leadCrop} · ${currentData.vpd.toFixed(2)} kPa`}
                    tone="sg-tint-violet"
                />
            </div>
        </DashboardCard>
    );
}
