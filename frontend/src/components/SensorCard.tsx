import type { LucideIcon } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';
import { formatMetricValue } from '../utils/formatValue';

interface SensorCardProps {
    title: string;
    value: number | string;
    unit: string;
    subValue?: string;
    metaLines?: string[];
    icon: LucideIcon;
    color: string;
    trend?: 'up' | 'down' | 'stable';
    idealRange?: string;
    className?: string;
    fractionDigits?: number;
    status?: 'loading' | 'live' | 'stale' | 'offline';
    statusLabel?: string;
    sparklineValues?: number[];
}

const SPARKLINE_WIDTH = 96;
const SPARKLINE_HEIGHT = 28;

function buildSparklinePath(values: number[]): string {
    if (values.length <= 1) {
        return '';
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const stepX = SPARKLINE_WIDTH / Math.max(values.length - 1, 1);

    return values
        .map((value, index) => {
            const x = index * stepX;
            const y = SPARKLINE_HEIGHT - ((value - min) / range) * SPARKLINE_HEIGHT;
            return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(' ');
}

const SensorCard = ({
    title,
    value,
    unit,
    subValue,
    metaLines = [],
    icon: Icon,
    color,
    trend,
    idealRange,
    className,
    fractionDigits,
    status = 'live',
    statusLabel,
    sparklineValues = [],
}: SensorCardProps) => {
    const { locale } = useLocale();
    const displayValue = typeof value === 'number'
        ? formatMetricValue(value, fractionDigits)
        : value;
    const detailLines = [subValue, ...metaLines].filter(Boolean);
    const showLoadingState = status === 'loading' && typeof value !== 'number';
    const sparklinePath = buildSparklinePath(sparklineValues);
    const statusClassName = status === 'live'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'stale'
            ? 'bg-amber-100 text-amber-700'
            : status === 'offline'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-slate-100 text-slate-600';

    return (
        <div className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full ${className || ''}`}>
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
                </div>
                <div className="flex flex-col items-end gap-1">
                    {statusLabel ? (
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full uppercase tracking-[0.12em] ${statusClassName}`}>
                            {statusLabel}
                        </span>
                    ) : null}
                    {trend ? (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend === 'up' ? 'bg-red-100 text-red-600' :
                                trend === 'down' ? 'bg-blue-100 text-blue-600' :
                                    'bg-slate-100 text-slate-600'
                            }`}>
                            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
                        </span>
                    ) : null}
                </div>
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium leading-snug">{title}</p>
                {showLoadingState ? (
                    <div className="mt-3 animate-pulse space-y-2">
                        <div className="h-8 w-24 rounded bg-slate-100" />
                        <div className="h-3 w-20 rounded bg-slate-100" />
                    </div>
                ) : (
                    <>
                        <h4 className="mt-1 text-2xl font-bold text-slate-800">{displayValue}</h4>
                        <p className="mt-1 text-xs leading-snug text-slate-400">{unit}</p>
                    </>
                )}
                {detailLines.map((line) => (
                    <p key={line} className="text-xs text-slate-500 mt-2 leading-snug">
                        {line}
                    </p>
                ))}
                {idealRange && (
                    <p className="text-xs text-slate-400 mt-2 flex items-start gap-1 leading-snug">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        {locale === 'ko' ? `목표 범위: ${idealRange}` : `Target band: ${idealRange}`}
                    </p>
                )}
                {sparklinePath ? (
                    <div className="mt-3 rounded-lg bg-slate-50 px-2 py-2">
                        <svg
                            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
                            className="h-7 w-full overflow-visible"
                            preserveAspectRatio="none"
                            role="img"
                            aria-label={`${title} sparkline`}
                        >
                            <path
                                d={sparklinePath}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className={color.replace('bg-', 'text-')}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default SensorCard;
