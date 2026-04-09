import { FileText, Leaf, Sparkles, Waves, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AdvancedModelMetrics, CropType, SensorData } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { getReadinessDescriptor } from '../lib/design/readiness';
import { getCropLabel } from '../utils/displayCopy';
import DashboardCard from './common/DashboardCard';

interface ConsultingReportProps {
    analysis: string;
    metrics: AdvancedModelMetrics;
    currentData: SensorData;
    crop: CropType;
}

function ReportMetricTile({
    label,
    value,
    detail,
    tone,
}: {
    label: string;
    value: string;
    detail: string;
    tone: 'neutral' | 'green' | 'amber' | 'blue';
}) {
    const toneClass = {
        neutral: 'bg-white/86',
        green: 'bg-[color:var(--sg-tint-green)]',
        amber: 'bg-[color:var(--sg-tint-amber)]',
        blue: 'bg-[color:var(--sg-tint-blue)]',
    }[tone];

    return (
        <div className={`rounded-[24px] px-4 py-4 ${toneClass}`} style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--sg-text-faint)]">
                {label}
            </div>
            <div className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                {value}
            </div>
            <div className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                {detail}
            </div>
        </div>
    );
}

function MemoSignal({
    icon: Icon,
    title,
    body,
}: {
    icon: typeof Leaf;
    title: string;
    body: string;
}) {
    return (
        <div className="rounded-[22px] bg-white/84 px-4 py-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                <Icon className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                <span>{title}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-[color:var(--sg-text-muted)]">{body}</p>
        </div>
    );
}

const ConsultingReport = ({ analysis, metrics, currentData, crop }: ConsultingReportProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const readiness = getReadinessDescriptor(metrics.yield.confidence, locale);
    const copy = locale === 'ko'
        ? {
            title: '운영 리포트',
            description: 'AI 요약과 현재 모델 지표를 한 번에 읽는 운영 메모입니다.',
            executiveSummary: '오늘의 요약',
            aiNotes: '모델 해석 메모',
            operatorMemo: '운영 메모',
            waiting: 'AI 운영 메모를 기다리는 중입니다...',
            favorable: '양호',
            stable: '안정',
            yieldOutlook: '수량 전망',
            energyUsage: '에너지 사용',
            confidence: '반영 상태',
            biomass: '건물중',
            cop: '에너지 효율',
            photosynthesis: '광합성',
            vpd: 'VPD',
            liveHint: '현재 상태를 기반으로 자동으로 갱신됩니다.',
            currentDirection: '현재 세력',
            climateSignal: '기후 신호',
            energySignal: '에너지 신호',
            operatorLead: '지금 읽고 바로 판단할 메모만 먼저 배치했습니다.',
            weekly: '주간 전망',
            hourlyCost: '시간당 비용',
        }
        : {
            title: 'Operating Report',
            description: 'An operating memo that combines AI summary and live model metrics.',
            executiveSummary: 'Today summary',
            aiNotes: 'Model interpretation notes',
            operatorMemo: 'Operator memo',
            waiting: 'Waiting for AI operating notes...',
            favorable: 'favorable',
            stable: 'stable',
            yieldOutlook: 'Yield outlook',
            energyUsage: 'Energy use',
            confidence: 'Readiness',
            biomass: 'Biomass',
            cop: 'Energy efficiency',
            photosynthesis: 'Assimilation',
            vpd: 'VPD',
            liveHint: 'Automatically refreshed from the live runtime state.',
            currentDirection: 'Current crop posture',
            climateSignal: 'Climate signal',
            energySignal: 'Energy signal',
            operatorLead: 'Put the memo you should read first ahead of the full narrative.',
            weekly: 'Weekly outlook',
            hourlyCost: 'Hourly cost',
        };

    const growthOutlook = metrics.growth.growthRate > 0 ? copy.favorable : copy.stable;
    const executiveSummary = locale === 'ko'
        ? `현재 ${cropLabel} 상태는 ${growthOutlook}입니다. 건물중은 ${metrics.growth.biomass.toFixed(1)} g/m²이고, 에너지 효율은 COP ${metrics.energy.efficiency.toFixed(1)} 수준입니다.`
        : `Current ${cropLabel} conditions are ${growthOutlook}. Biomass accumulation is ${metrics.growth.biomass.toFixed(1)} g/m², while energy efficiency is operating around COP ${metrics.energy.efficiency.toFixed(1)}.`;

    const currentDirectionMemo = locale === 'ko'
        ? `${copy.biomass} ${metrics.growth.biomass.toFixed(1)} g/m², LAI ${metrics.growth.lai.toFixed(2)} 수준으로 세력은 ${growthOutlook} 쪽에 가깝습니다.`
        : `${copy.biomass} ${metrics.growth.biomass.toFixed(1)} g/m² with LAI ${metrics.growth.lai.toFixed(2)} keeps the crop closer to a ${growthOutlook} posture.`;
    const climateSignalMemo = locale === 'ko'
        ? `${copy.photosynthesis} ${currentData.photosynthesis.toFixed(1)}, VPD ${currentData.vpd.toFixed(2)} kPa 기준으로 현재 기후 신호를 읽고 있습니다.`
        : `${copy.photosynthesis} ${currentData.photosynthesis.toFixed(1)} with VPD ${currentData.vpd.toFixed(2)} kPa is the live climate signal in view.`;
    const energySignalMemo = locale === 'ko'
        ? `${copy.energyUsage} ${metrics.energy.consumption.toFixed(2)} kW, COP ${metrics.energy.efficiency.toFixed(1)} 기준으로 운전 부담을 보고 있습니다.`
        : `${copy.energyUsage} ${metrics.energy.consumption.toFixed(2)} kW with COP ${metrics.energy.efficiency.toFixed(1)} is the current operating burden.`;

    return (
        <DashboardCard
            eyebrow={copy.title}
            title={cropLabel}
            description={copy.description}
            className="sg-tint-violet"
            actions={(
                <div className="rounded-full bg-white/88 px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-violet)] shadow-[var(--sg-shadow-card)]">
                    {copy.liveHint}
                </div>
            )}
        >
            <div className="space-y-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                    <article
                        className="relative overflow-hidden rounded-[32px] bg-[linear-gradient(135deg,rgba(225,218,255,0.96),rgba(255,255,255,0.9))] px-6 py-6"
                        style={{ boxShadow: 'var(--sg-shadow-soft)' }}
                    >
                        <div className="absolute -right-10 -top-8 h-36 w-36 rounded-full bg-white/18 blur-3xl" />
                        <div className="relative flex flex-col gap-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-white/84"
                                        style={{ boxShadow: 'var(--sg-shadow-card)' }}
                                    >
                                        <FileText className="h-6 w-6 text-[color:var(--sg-accent-violet)]" />
                                    </div>
                                    <div>
                                        <div className="sg-eyebrow">{copy.executiveSummary}</div>
                                        <div className="mt-3 text-[clamp(1.7rem,2.2vw,2.55rem)] font-semibold tracking-[-0.07em] text-[color:var(--sg-text-strong)]">
                                            {growthOutlook}
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-full bg-white/84 px-4 py-2 text-xs font-semibold text-[color:var(--sg-accent-violet)] shadow-[var(--sg-shadow-card)]">
                                    {copy.operatorLead}
                                </div>
                            </div>

                            <p className="max-w-3xl text-sm leading-7 text-[color:var(--sg-text-muted)]">
                                {executiveSummary}
                            </p>

                            <div className="grid gap-3 md:grid-cols-3">
                                <ReportMetricTile
                                    label={copy.confidence}
                                    value={readiness.label}
                                    detail={copy.weekly}
                                    tone="neutral"
                                />
                                <ReportMetricTile
                                    label={copy.yieldOutlook}
                                    value={`${metrics.yield.predictedWeekly.toFixed(1)} kg/m²`}
                                    detail={copy.weekly}
                                    tone="green"
                                />
                                <ReportMetricTile
                                    label={copy.cop}
                                    value={`${metrics.energy.efficiency.toFixed(1)} COP`}
                                    detail={`${copy.energyUsage} ${metrics.energy.consumption.toFixed(2)} kW`}
                                    tone="amber"
                                />
                            </div>
                        </div>
                    </article>

                    <div className="grid gap-4">
                        <ReportMetricTile
                            label={copy.biomass}
                            value={`${metrics.growth.biomass.toFixed(1)} g/m²`}
                            detail={`LAI ${metrics.growth.lai.toFixed(2)}`}
                            tone="neutral"
                        />
                        <ReportMetricTile
                            label={copy.photosynthesis}
                            value={currentData.photosynthesis.toFixed(1)}
                            detail={`${copy.vpd} ${currentData.vpd.toFixed(2)} kPa`}
                            tone="blue"
                        />
                        <ReportMetricTile
                            label={copy.hourlyCost}
                            value={metrics.energy.costPrediction.toFixed(2)}
                            detail={`${copy.energyUsage} ${metrics.energy.consumption.toFixed(2)} kW`}
                            tone="amber"
                        />
                    </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <article className="rounded-[30px] bg-[color:var(--sg-tint-neutral)] px-5 py-5 shadow-[var(--sg-shadow-card)]">
                        <div className="flex items-center gap-2 text-[color:var(--sg-text-strong)]">
                            <Sparkles className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em]">
                                {copy.operatorMemo}
                            </h4>
                        </div>
                        <div className="mt-4 grid gap-3">
                            <MemoSignal icon={Leaf} title={copy.currentDirection} body={currentDirectionMemo} />
                            <MemoSignal icon={Waves} title={copy.climateSignal} body={climateSignalMemo} />
                            <MemoSignal icon={Zap} title={copy.energySignal} body={energySignalMemo} />
                        </div>
                    </article>

                    <div className="rounded-[30px] bg-white/88 px-5 py-5 shadow-[var(--sg-shadow-card)]">
                        <div className="mb-4 flex items-center gap-2 text-[color:var(--sg-text-strong)]">
                            <Sparkles className="h-4 w-4 text-[color:var(--sg-accent-violet)]" />
                            <h4 className="text-sm font-semibold uppercase tracking-[0.16em]">
                                {copy.aiNotes}
                            </h4>
                        </div>
                        <div className="prose prose-slate max-w-none text-sm leading-7 text-[color:var(--sg-text-muted)]">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    h2: ({ ...props }) => <h2 className="mt-4 mb-2 text-base font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                                    h3: ({ ...props }) => <h3 className="mt-3 mb-1 text-sm font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                                    p: ({ ...props }) => <p className="mb-3" {...props} />,
                                    ul: ({ ...props }) => <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />,
                                    ol: ({ ...props }) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />,
                                    li: ({ ...props }) => <li className="mb-0" {...props} />,
                                    strong: ({ ...props }) => <strong className="font-semibold text-[color:var(--sg-text-strong)]" {...props} />,
                                    code: ({ ...props }) => <code className="rounded-md bg-[color:var(--sg-tint-neutral)] px-1.5 py-0.5 text-[color:var(--sg-text-strong)]" {...props} />,
                                }}
                            >
                                {analysis || copy.waiting}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardCard>
    );
};

export default ConsultingReport;
