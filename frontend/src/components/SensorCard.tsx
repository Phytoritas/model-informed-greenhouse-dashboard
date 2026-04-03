import type { LucideIcon } from 'lucide-react';
import { formatMetricValue } from '../utils/formatValue';

interface SensorCardProps {
    title: string;
    value: number | string;
    unit: string;
    subValue?: string;
    icon: LucideIcon;
    color: string;
    trend?: 'up' | 'down' | 'stable';
    idealRange?: string;
    className?: string;
    fractionDigits?: number;
}

const SensorCard = ({ title, value, unit, subValue, icon: Icon, color, trend, idealRange, className, fractionDigits }: SensorCardProps) => {
    const displayValue = typeof value === 'number'
        ? formatMetricValue(value, fractionDigits)
        : value;

    return (
        <div className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow h-full ${className || ''}`}>
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
                    <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
                </div>
                {trend && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${trend === 'up' ? 'bg-red-100 text-red-600' :
                            trend === 'down' ? 'bg-blue-100 text-blue-600' :
                                'bg-slate-100 text-slate-600'
                        }`}>
                        {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '•'}
                    </span>
                )}
            </div>
            <div>
                <p className="text-sm text-slate-500 font-medium leading-snug">{title}</p>
                <h4 className="mt-1 text-2xl font-bold text-slate-800">{displayValue}</h4>
                <p className="mt-1 text-xs leading-snug text-slate-400">{unit}</p>
                {subValue && <p className="text-xs text-slate-500 mt-2 leading-snug">{subValue}</p>}
                {idealRange && (
                    <p className="text-xs text-slate-400 mt-2 flex items-start gap-1 leading-snug">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        Target band: {idealRange}
                    </p>
                )}
            </div>
        </div>
    );
};

export default SensorCard;
