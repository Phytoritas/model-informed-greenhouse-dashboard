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
        ? 'bg-[color:var(--sg-status-live-bg)] text-[color:var(--sg-status-live-text)]'
        : status === 'stale'
            ? 'bg-[color:var(--sg-status-stale-bg)] text-[color:var(--sg-status-stale-text)]'
            : status === 'offline'
                ? 'bg-[color:var(--sg-status-offline-bg)] text-[color:var(--sg-status-offline-text)]'
                : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]';

    return (
        <div className={`sg-warm-panel h-full p-4 transition-shadow hover:-translate-y-[1px] ${className || ''}`}>
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
                                trend === 'down' ? 'bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]' :
                                    'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-status-muted-text)]'
                            }`}>
                            {trend === 'up' ? '↗' : trend === 'down' ? '↘' : '→'}
                        </span>
                    ) : null}
                </div>
            </div>
            <div>
                <p className="text-sm font-medium leading-snug text-[color:var(--sg-text-muted)]">{title}</p>
                {showLoadingState ? (
                    <div className="mt-3 animate-pulse space-y-2">
                        <div className="h-8 w-24 rounded bg-[color:var(--sg-status-muted-bg)]" />
                        <div className="h-3 w-20 rounded bg-[color:var(--sg-status-muted-bg)]" />
                    </div>
                ) : (
                    <>
                        <h4 className="mt-1 text-2xl font-bold text-[color:var(--sg-text-strong)]">{displayValue}</h4>
                        <p className="mt-1 text-xs leading-snug text-[color:var(--sg-text-faint)]">{unit}</p>
                    </>
                )}
                {detailLines.map((line) => (
                    <p key={line} className="mt-2 text-xs leading-snug text-[color:var(--sg-text-muted)]">
                        {line}
                    </p>
                ))}
                {idealRange && (
                    <p className="mt-2 flex items-start gap-1 text-xs leading-snug text-[color:var(--sg-text-faint)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--sg-accent-forest)]"></span>
                        {locale === 'ko' ? `목표 범위: ${idealRange}` : `Target band: ${idealRange}`}
                    </p>
                )}
                {sparklinePath ? (
                    <div className="mt-3 rounded-[18px] bg-[color:var(--sg-status-muted-bg)] px-2 py-2">
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
