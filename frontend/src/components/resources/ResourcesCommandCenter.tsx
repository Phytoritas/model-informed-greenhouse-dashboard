import type {
    AdvancedModelMetrics,
    ProducePricesPayload,
    SensorData,
    WeatherOutlook,
} from '../../types';
import DashboardCard from '../common/DashboardCard';
import DecisionSnapshotGrid from '../dashboard/DecisionSnapshotGrid';
import ProducePricesPanel from '../ProducePricesPanel';
import WeatherOutlookPanel from '../WeatherOutlookPanel';

interface ResourcesCommandCenterProps {
    locale: 'ko' | 'en';
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
            marketDetail: '출하 판단에 연결되는 현재 가격입니다.',
            cropDetail: '증산, 광합성, 수확 압력을 같이 봅니다.',
            noMarket: '시장 데이터 대기 중',
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
            marketDetail: 'Use live price direction before harvest pacing decisions.',
            cropDetail: 'Read transpiration, assimilation, and harvest pressure together.',
            noMarket: 'Market data pending',
            unitCost: 'Estimated cost',
        };

    const marketItem = producePrices?.items?.[0] ?? null;
    const marketValue = marketItem
        ? `${marketItem.display_name} ${marketItem.current_price_krw.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}${locale === 'ko' ? '원' : ' KRW'}`
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
                <ProducePricesPanel
                    prices={producePrices}
                    loading={produceLoading}
                    error={produceError}
                />
            ) : null}

            {activePanel === 'resources-stock' ? (
                <DecisionSnapshotGrid
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
