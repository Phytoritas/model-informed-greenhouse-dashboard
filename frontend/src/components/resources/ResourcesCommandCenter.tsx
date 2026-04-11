import { Suspense, lazy } from 'react';
import type {
    AdvancedModelMetrics,
    CropType,
    ProducePricesPayload,
    SensorData,
    WeatherOutlook,
} from '../../types';
import { getProduceDisplayName } from '../../utils/displayCopy';
import { selectProduceItemForCrop } from '../../utils/producePriceSelectors';
import DashboardCard from '../common/DashboardCard';
import DecisionSnapshotGrid from '../dashboard/DecisionSnapshotGrid';
import WeatherOutlookPanel from '../WeatherOutlookPanel';
import LoadingSkeleton from '../../features/common/LoadingSkeleton';

const ProducePricesPanel = lazy(() => import('../ProducePricesPanel'));

interface ResourcesCommandCenterProps {
    locale: 'ko' | 'en';
    crop: CropType;
    cropLabel: string;
    currentData: SensorData;
    modelMetrics: AdvancedModelMetrics;
    weather: WeatherOutlook | null;
    weatherLoading: boolean;
    weatherError: string | null;
    producePrices: ProducePricesPayload | null;
    produceLoading: boolean;
    produceError: string | null;
    activePanel?: 'resources-energy' | 'resources-market' | 'resources-stock';
}

export default function ResourcesCommandCenter({
    locale,
    crop,
    cropLabel,
    currentData,
    modelMetrics,
    weather,
    weatherLoading,
    weatherError,
    producePrices,
    produceLoading,
    produceError,
    activePanel = 'resources-energy',
}: ResourcesCommandCenterProps) {
    const copy = locale === 'ko'
        ? {
            eyebrow: '양액·에너지 요약',
            title: `${cropLabel} 양액에너지 한눈에`,
            description: '양액, 외기, 에너지 비용, 시세 흐름을 한곳에서 봅니다.',
            energy: '에너지 비용',
            weather: '외기 흐름',
            market: '시세',
            cropLoad: '양액·생육 신호',
            energyDetail: '현재 사용량과 예상 비용을 같이 봅니다.',
            weatherDetail: '환기와 냉난방 판단에 바로 연결되는 외기 상태입니다.',
            marketDetail: '도매가격 기준으로 출하 판단 신호를 확인합니다.',
            cropDetail: '증산, 광합성, 수확 압력을 같이 봅니다.',
            noMarket: '도매 시세 대기 중',
            unitCost: '예상 비용',
        }
        : {
            eyebrow: 'Nutrient and energy',
            title: `${cropLabel} resource summary`,
            description: 'Keep nutrient, weather, energy cost, and market signals in one page.',
            energy: 'Energy cost',
            weather: 'Outside flow',
            market: 'Market',
            cropLoad: 'Crop signal',
            energyDetail: 'Keep usage and expected cost together.',
            weatherDetail: 'Outside conditions directly shape vent and HVAC cost.',
            marketDetail: 'Uses wholesale market prices for harvest pacing decisions.',
            cropDetail: 'Read transpiration, assimilation, and harvest pressure together.',
            noMarket: 'Wholesale market pending',
            unitCost: 'Estimated cost',
        };

    const selectedMarket = selectProduceItemForCrop(producePrices, crop, { marketPreference: ['wholesale'] });
    const marketItem = selectedMarket?.item ?? null;
    const marketValue = marketItem
        ? `${getProduceDisplayName(marketItem.display_name, locale)} ${marketItem.current_price_krw.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}${locale === 'ko' ? '원' : ' KRW'}`
        : copy.noMarket;
    const energyValue = `${modelMetrics.energy.consumption.toFixed(1)} kW · COP ${modelMetrics.energy.efficiency.toFixed(2)}`;
    const weatherValue = weather
        ? `${weather.current.temperature_c.toFixed(1)}°C · ${weather.current.relative_humidity_pct.toFixed(0)}%`
        : (weatherLoading ? (locale === 'ko' ? '기상 불러오는 중' : 'Loading weather') : (weatherError ?? '-'));
    const cropValue = `${currentData.transpiration.toFixed(2)} mmol/m²/s · ${currentData.photosynthesis.toFixed(1)} µmol/m²/s`;
    const supportCards = [
        {
            label: copy.energy,
            value: energyValue,
            detail: `${copy.energyDetail} · ${copy.unitCost} ${modelMetrics.energy.costPrediction.toFixed(2)}`,
            toneClass: 'sg-tint-violet',
        },
        {
            label: copy.weather,
            value: weatherValue,
            detail: copy.weatherDetail,
            toneClass: 'sg-tint-neutral',
        },
        {
            label: copy.market,
            value: marketValue,
            detail: copy.marketDetail,
            toneClass: 'sg-tint-amber',
        },
        {
            label: copy.cropLoad,
            value: cropValue,
            detail: `${copy.cropDetail} · ${locale === 'ko' ? '수확 가능 과실' : 'Harvestable fruits'} ${modelMetrics.yield.harvestableFruits}`,
            toneClass: 'sg-tint-neutral',
        },
    ];

    return (
        <div className="space-y-6">
            <DashboardCard
                eyebrow={copy.eyebrow}
                title={copy.title}
                description={copy.description}
                variant="hero"
            >
                <div className="grid gap-3 xl:grid-cols-4">
                    {supportCards.map((card) => (
                        <article
                            key={card.label}
                            className={`rounded-[24px] px-4 py-4 ${card.toneClass}`}
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                                {card.label}
                            </div>
                            <div className="mt-2 text-lg font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                                {card.value}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                {card.detail}
                            </p>
                        </article>
                    ))}
                </div>
            </DashboardCard>

            {activePanel === 'resources-energy' ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
                    <WeatherOutlookPanel
                        weather={weather}
                        loading={weatherLoading}
                        error={weatherError}
                    />
                    <DecisionSnapshotGrid
                        crop={crop}
                        currentData={currentData}
                        modelMetrics={modelMetrics}
                        weather={weather}
                        weatherLoading={weatherLoading}
                        producePrices={producePrices}
                        produceLoading={produceLoading}
                    />
                </div>
            ) : null}

            {activePanel === 'resources-market' ? (
                <Suspense
                    fallback={(
                        <LoadingSkeleton
                            title={locale === 'ko' ? '도매 시세' : 'Wholesale prices'}
                            loadingMessage={locale === 'ko' ? '시세 차트를 불러오는 중입니다...' : 'Loading price chart...'}
                            minHeightClassName="min-h-[520px]"
                        />
                    )}
                >
                    <ProducePricesPanel
                        prices={producePrices}
                        loading={produceLoading}
                        error={produceError}
                    />
                </Suspense>
            ) : null}

            {activePanel === 'resources-stock' ? (
                <DecisionSnapshotGrid
                    crop={crop}
                    currentData={currentData}
                    modelMetrics={modelMetrics}
                    weather={weather}
                    weatherLoading={weatherLoading}
                    producePrices={producePrices}
                    produceLoading={produceLoading}
                />
            ) : null}
        </div>
    );
}
