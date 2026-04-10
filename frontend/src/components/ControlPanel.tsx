import type { ControlStatus, TemperatureSettings } from '../types';
import { Fan, Droplets, Thermometer, Sun } from 'lucide-react';
import { useLocale } from '../i18n/LocaleProvider';

interface ControlPanelProps {
    status: ControlStatus;
    onToggle: (key: keyof ControlStatus) => void;
    onSettingsChange: (settings: TemperatureSettings) => void;
}

const ControlPanel = ({ status, onToggle, onSettingsChange }: ControlPanelProps) => {
    const { locale } = useLocale();
    const copy = locale === 'ko'
        ? {
            title: '수동 제어',
            ventilation: '환기',
            irrigation: '관수',
            heating: '난방',
            shading: '차광',
            temperatureSettings: '온도 설정',
            heatingThreshold: '난방 시작 온도',
            coolingThreshold: '냉방 시작 온도',
        }
        : {
            title: 'Quick controls',
            ventilation: 'Vent',
            irrigation: 'Water',
            heating: 'Heat',
            shading: 'Screen',
            temperatureSettings: 'Temperature guide',
            heatingThreshold: 'Heat start',
            coolingThreshold: 'Cool start',
        };

    return (
        <div className="sg-warm-panel p-6">
            <h3 className="mb-4 text-lg font-semibold text-[color:var(--sg-text-strong)]">{copy.title}</h3>
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => onToggle('ventilation')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors ${status.ventilation ? 'bg-[color:var(--sg-accent-forest-soft)] text-[color:var(--sg-accent-forest)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
                        }`}
                >
                    <Fan className="h-6 w-6" />
                    <span className="text-sm font-medium">{copy.ventilation}</span>
                </button>
                <button
                    onClick={() => onToggle('irrigation')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors ${status.irrigation ? 'bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
                        }`}
                >
                    <Droplets className="h-6 w-6" />
                    <span className="text-sm font-medium">{copy.irrigation}</span>
                </button>
                <button
                    onClick={() => onToggle('heating')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors ${status.heating ? 'bg-[color:var(--sg-accent-violet-soft)] text-[color:var(--sg-accent-violet)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
                        }`}
                >
                    <Thermometer className="h-6 w-6" />
                    <span className="text-sm font-medium">{copy.heating}</span>
                </button>
                <button
                    onClick={() => onToggle('shading')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors ${status.shading ? 'bg-[color:var(--sg-accent-amber-soft)] text-[color:var(--sg-accent-amber)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
                        }`}
                >
                    <Sun className="h-6 w-6" />
                    <span className="text-sm font-medium">{copy.shading}</span>
                </button>
            </div>

            <div className="mt-6 border-t border-[color:var(--sg-outline-soft)] pt-6">
                <h4 className="mb-3 text-sm font-medium text-[color:var(--sg-text)]">{copy.temperatureSettings}</h4>
                <div className="space-y-4">
                    <div>
                        <label className="mb-1 block text-xs text-[color:var(--sg-text-muted)]">{copy.heatingThreshold}</label>
                        <input
                            type="range"
                            min="10"
                            max="30"
                            value={status.settings.heating}
                            onChange={(e) => onSettingsChange({ ...status.settings, heating: parseInt(e.target.value, 10) })}
                            className="w-full"
                            style={{ accentColor: 'var(--sg-accent-violet)' }}
                        />
                        <div className="flex justify-between text-xs text-[color:var(--sg-text-faint)]">
                            <span>10°C</span>
                            <span className="font-medium text-[color:var(--sg-text)]">{status.settings.heating}°C</span>
                            <span>30°C</span>
                        </div>
                    </div>
                    <div>
                        <label className="mb-1 block text-xs text-[color:var(--sg-text-muted)]">{copy.coolingThreshold}</label>
                        <input
                            type="range"
                            min="15"
                            max="35"
                            value={status.settings.cooling}
                            onChange={(e) => onSettingsChange({ ...status.settings, cooling: parseInt(e.target.value, 10) })}
                            className="w-full"
                            style={{ accentColor: 'var(--sg-accent-earth)' }}
                        />
                        <div className="flex justify-between text-xs text-[color:var(--sg-text-faint)]">
                            <span>15°C</span>
                            <span className="font-medium text-[color:var(--sg-text)]">{status.settings.cooling}°C</span>
                            <span>35°C</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
