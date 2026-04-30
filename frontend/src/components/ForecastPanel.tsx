import { Calendar, Droplets, Leaf, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import type { CropType, ForecastData } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { UNIT_LABELS, getCropLabel, getForecastTitle } from '../utils/displayCopy';
import DashboardCard from './common/DashboardCard';
import ChartFrame from './charts/ChartFrame';

interface ForecastPanelProps {
    forecast: ForecastData | null;
    crop: CropType;
}

function ForecastMetricTile({
    icon: Icon,
    label,
    value,
    unit,
    body,
    tone,
}: {
    icon: typeof Leaf;
    label: string;
    value: string;
    unit: string;
    body: string;
    tone: 'green' | 'blue' | 'amber';
}) {
    const toneClass = {
        green: 'sg-tint-green text-[color:var(--sg-accent-forest)]',
        blue: 'sg-tint-green text-[color:var(--sg-color-olive)]',
        amber: 'sg-tint-amber text-[color:var(--sg-accent-amber)]',
    }[tone];

    return (
        <article
            className={`relative overflow-hidden rounded-[24px] px-4 py-4 ${toneClass}`}
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
        >
            <div className="absolute right-3 top-3 h-16 w-16 rounded-full bg-white/16 blur-2xl" />
            <div className="relative flex items-start gap-3">
                <div
                    className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-white/84"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="sg-eyebrow">{label}</div>
                    <div className="mt-2 flex items-end gap-2 text-[color:var(--sg-text-strong)]">
                        <span className="text-[clamp(1.35rem,1.15rem+0.7vw,2.1rem)] font-semibold tracking-[-0.06em]">
                            {value}
                        </span>
                        <span className="pb-1 text-xs font-medium text-[color:var(--sg-text-muted)]">
                            {unit}
                        </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]">
                        {body}
                    </p>
                </div>
            </div>
        </article>
    );
}

const ForecastPanel = ({ forecast, crop }: ForecastPanelProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            eyebrow: '생육 전망',
            title: '7일 수확 · 증산 · 에너지 예측',
            subtitle: '오늘 이후 7일 동안의 수확 리듬과 물·에너지 부담을 한 카드에서 봅니다.',
            waiting: '예측 데이터를 불러오는 중입니다...',
            noHarvest: '가까운 수확 없음',
            noHarvestDescription: '현재 생육 단계 기준으로 다음 7일 안에는 수확이 잡히지 않았습니다.',
            leadTitle: '이번 주 운영 흐름',
            leadWithHarvest: '수확과 증산, 에너지 부담을 함께 보며 작업 리듬을 조정해야 합니다.',
            leadWithoutHarvest: '수확은 아직 멀지만 증산과 에너지 흐름은 계속 관리해야 합니다.',
            forecastDays: '예측 일수',
            yield: '7일 수확량',
            transpiration: '누적 증산량',
            energyUse: '누적 에너지',
            yieldBody: '다음 7일 동안 예상되는 총 수확량입니다.',
            transpirationBody: '물 사용 압력과 관수 템포를 함께 읽습니다.',
            energyBody: '난방·환기·냉방 부담을 합친 총량입니다.',
            chartTitle: '일별 수확과 증산 리듬',
            chartBody: '수확 시점과 물 사용 피크가 겹치는 구간을 먼저 확인합니다.',
            harvestYield: '일별 수확량',
            cropTranspiration: '일별 증산량',
            noDataBody: '예측이 아직 준비되지 않았습니다.',
        }
        : {
            eyebrow: 'Growth outlook',
            title: '7-day harvest, transpiration, and energy forecast',
            subtitle: 'A compact view of harvest rhythm, water demand, and energy burden for the next week.',
            waiting: 'Waiting for forecast data...',
            noHarvest: 'No near-term harvest',
            noHarvestDescription: 'No harvest is expected within the next 7 days at the current growth stage.',
            leadTitle: 'This week’s operating rhythm',
            leadWithHarvest: 'Harvest, transpiration, and energy should be read together before setting work pace.',
            leadWithoutHarvest: 'Harvest is not imminent, but water and energy burden still need steady attention.',
            forecastDays: 'Forecast days',
            yield: '7-day yield',
            transpiration: 'Cumulative transpiration',
            energyUse: 'Cumulative energy',
            yieldBody: 'Projected total harvest across the next 7 days.',
            transpirationBody: 'Read irrigation pressure and water pace together.',
            energyBody: 'Combined heating, vent, and cooling burden.',
            chartTitle: 'Daily harvest and transpiration rhythm',
            chartBody: 'Check where harvest timing and water-use peaks overlap.',
            harvestYield: 'Daily harvest',
            cropTranspiration: 'Daily transpiration',
            noDataBody: 'Forecast data is not available yet.',
        };

    if (!forecast || !forecast.daily || forecast.daily.length === 0) {
        return (
            <DashboardCard
                eyebrow={copy.eyebrow}
                title={copy.title}
                description={copy.subtitle}
                className="sg-tint-neutral"
                variant="empty"
            >
                <div
                    className="rounded-[28px] bg-white/84 px-5 py-12 text-center"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <Calendar className="mx-auto h-10 w-10 text-[color:var(--sg-text-faint)]" />
                    <p className="mt-4 text-sm font-medium text-[color:var(--sg-text-strong)]">{copy.waiting}</p>
                    <p className="mt-2 text-xs text-[color:var(--sg-text-muted)]">{copy.noDataBody}</p>
                </div>
            </DashboardCard>
        );
    }

    const hasHarvest = (forecast.total_harvest_kg ?? 0) > 0.001;
    const leadNarrative = hasHarvest ? copy.leadWithHarvest : copy.leadWithoutHarvest;

    return (
        <DashboardCard
            eyebrow={copy.eyebrow}
            title={copy.title}
            description={copy.subtitle}
            className="sg-tint-green"
            actions={(
                <div
                    className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-forest)]"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    {cropLabel} · {forecast.daily.length} {copy.forecastDays}
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                <article
                    className="relative overflow-hidden rounded-[32px] px-5 py-5"
                    style={{
                        background: 'linear-gradient(135deg, rgba(212,239,199,0.92), rgba(255,255,255,0.88))',
                        boxShadow: 'var(--sg-shadow-soft)',
                    }}
                >
                    <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/24 blur-3xl" />
                    <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                        <div>
                            <div className="sg-eyebrow">{copy.leadTitle}</div>
                            <div className="mt-3 flex flex-wrap items-end gap-3 text-[color:var(--sg-text-strong)]">
                                <span className="text-[clamp(2rem,1.85rem+0.9vw,3.2rem)] font-semibold tracking-[-0.07em]">
                                    {hasHarvest ? `${forecast.total_harvest_kg.toFixed(1)} kg` : copy.noHarvest}
                                </span>
                                {!hasHarvest ? (
                                    <span className="rounded-full bg-white/84 px-3 py-1 text-xs font-semibold text-[color:var(--sg-accent-amber)]">
                                        {copy.noHarvest}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--sg-text-muted)]">
                                {hasHarvest ? leadNarrative : copy.noHarvestDescription}
                            </p>
                        </div>
                        <div
                            className="rounded-[24px] bg-white/84 px-4 py-4"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                        >
                            <div className="sg-eyebrow">{getForecastTitle(crop, locale)}</div>
                            <div className="mt-3 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                                {forecast.total_ETc_mm.toFixed(1)} {UNIT_LABELS.transpirationDepth} · {forecast.total_energy_kWh.toFixed(1)} {UNIT_LABELS.energyUse}
                            </div>
                            <p className="mt-2 text-xs leading-6 text-[color:var(--sg-text-muted)]">
                                {leadNarrative}
                            </p>
                        </div>
                    </div>
                </article>

                <div className="grid gap-4 md:grid-cols-3">
                    <ForecastMetricTile
                        icon={Leaf}
                        label={copy.yield}
                        value={forecast.total_harvest_kg.toFixed(1)}
                        unit={UNIT_LABELS.weeklyYield}
                        body={copy.yieldBody}
                        tone="green"
                    />
                    <ForecastMetricTile
                        icon={Droplets}
                        label={copy.transpiration}
                        value={forecast.total_ETc_mm.toFixed(1)}
                        unit={UNIT_LABELS.transpirationDepth}
                        body={copy.transpirationBody}
                        tone="blue"
                    />
                    <ForecastMetricTile
                        icon={Zap}
                        label={copy.energyUse}
                        value={forecast.total_energy_kWh.toFixed(1)}
                        unit={UNIT_LABELS.energyUse}
                        body={copy.energyBody}
                        tone="amber"
                    />
                </div>

                <section
                    className="rounded-[30px] bg-white/84 px-5 py-5"
                    style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="sg-eyebrow">{copy.chartTitle}</div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                                {copy.chartBody}
                            </p>
                        </div>
                        <div className="rounded-full bg-[color:var(--sg-tint-green)] px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-forest)]">
                            {forecast.daily.length} day view
                        </div>
                    </div>

                    <div className="mt-5">
                        <ChartFrame className="h-72 w-full" minHeight={288}>
                            {({ width, height }) => (
                                <BarChart
                                    width={Math.max(width, 1)}
                                    height={Math.max(height, 288)}
                                    data={forecast.daily}
                                    margin={{ top: 10, right: 10, left: -18, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.18)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(value: string) => value.split('-').slice(1).join('/')}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.98)',
                                            borderRadius: '18px',
                                            border: '1px solid rgba(255,255,255,0.7)',
                                            boxShadow: '0 18px 40px rgba(15, 23, 42, 0.12)',
                                        }}
                                        cursor={{ fill: 'rgba(237, 247, 231, 0.72)' }}
                                        formatter={(value: number, name: string) => [value.toFixed(1), name]}
                                    />
                                    <Bar
                                        dataKey="harvest_kg"
                                        name={copy.harvestYield}
                                        fill="#2f6a2d"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={40}
                                    />
                                    <Bar
                                        dataKey="ETc_mm"
                                        name={copy.cropTranspiration}
                                        fill="#596b4a"
                                        radius={[6, 6, 0, 0]}
                                        maxBarSize={40}
                                    />
                                </BarChart>
                            )}
                        </ChartFrame>
                    </div>
                </section>
            </div>
        </DashboardCard>
    );
};

export default ForecastPanel;
