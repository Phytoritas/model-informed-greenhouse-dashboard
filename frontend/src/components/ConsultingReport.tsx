import { FileText } from 'lucide-react';
import type { AdvancedModelMetrics, SensorData, CropType } from '../types';
import { useLocale } from '../i18n/LocaleProvider';
import { getCropLabel } from '../utils/displayCopy';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ConsultingReportProps {
    analysis: string;
    metrics: AdvancedModelMetrics;
    currentData: SensorData;
    crop: CropType;
}

const ConsultingReport = ({ analysis, metrics, crop }: ConsultingReportProps) => {
    const { locale } = useLocale();
    const cropLabel = getCropLabel(crop, locale);
    const copy = locale === 'ko'
        ? {
            title: '컨설팅 리포트',
            executiveSummary: '핵심 요약',
            aiNotes: 'AI 컨설팅 메모',
            waiting: 'AI 컨설팅 결과를 기다리는 중...',
            favorable: '양호한 편',
            stable: '안정적',
            yieldOutlook: '수확 전망',
            energyUsage: '에너지 사용량',
            confidence: '신뢰도',
        }
        : {
            title: 'Consulting Report',
            executiveSummary: 'Executive Summary',
            aiNotes: 'AI Consulting Notes',
            waiting: 'Waiting for AI consulting output...',
            favorable: 'favorable',
            stable: 'stable',
            yieldOutlook: 'Yield Outlook',
            energyUsage: 'Energy Usage',
            confidence: 'confidence',
        };
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-800">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold">{copy.title}</h3>
            </div>
            <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">{copy.executiveSummary}</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                        {locale === 'ko'
                            ? `현재 ${cropLabel} 상태는 ${metrics.growth.growthRate > 0 ? copy.favorable : copy.stable}입니다. 바이오매스 누적량은 ${metrics.growth.biomass.toFixed(1)} g/m²이고, 에너지 효율은 COP ${metrics.energy.efficiency.toFixed(1)} 수준입니다.`
                            : `Current conditions for ${cropLabel} are ${metrics.growth.growthRate > 0 ? copy.favorable : copy.stable}. Biomass accumulation is ${metrics.growth.biomass.toFixed(1)} g/m². Energy efficiency is operating at a COP of ${metrics.energy.efficiency.toFixed(1)}.`}
                    </p>
                </div>

                <div className="p-4 bg-white rounded-lg border border-slate-200">
                    <h4 className="text-sm font-medium text-slate-700 mb-2">{copy.aiNotes}</h4>
                    <div className="text-sm text-slate-700 leading-relaxed">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                h2: ({ ...props }) => <h2 className="text-base font-semibold mt-3 mb-2 text-slate-900" {...props} />,
                                h3: ({ ...props }) => <h3 className="text-sm font-semibold mt-3 mb-1 text-slate-900" {...props} />,
                                p: ({ ...props }) => <p className="mb-2" {...props} />,
                                ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1" {...props} />,
                                ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1" {...props} />,
                                li: ({ ...props }) => <li className="mb-0" {...props} />,
                                strong: ({ ...props }) => <strong className="font-semibold text-slate-900" {...props} />,
                                code: ({ ...props }) => <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-900" {...props} />,
                            }}
                        >
                            {analysis || copy.waiting}
                        </ReactMarkdown>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <h4 className="text-sm font-medium text-green-800 mb-1">{copy.yieldOutlook}</h4>
                        <p className="text-xs text-green-700">
                            {locale === 'ko'
                                ? `${metrics.yield.predictedWeekly.toFixed(1)} kg/m² 수준이 예상되며 ${copy.confidence}는 ${metrics.yield.confidence}%입니다.`
                                : `Projected yield of ${metrics.yield.predictedWeekly.toFixed(1)} kg/m² with ${metrics.yield.confidence}% confidence.`}
                        </p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-100">
                        <h4 className="text-sm font-medium text-orange-800 mb-1">{copy.energyUsage}</h4>
                        <p className="text-xs text-orange-700">
                            {locale === 'ko'
                                ? `현재 전력은 ${metrics.energy.consumption.toFixed(2)} kW이며, 시간당 예상 비용은 ${metrics.energy.costPrediction.toFixed(2)}입니다.`
                                : `Current power: ${metrics.energy.consumption.toFixed(2)} kW. Est. cost (per hour): ${metrics.energy.costPrediction.toFixed(2)}.`}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsultingReport;
