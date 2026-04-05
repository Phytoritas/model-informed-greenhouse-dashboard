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
            title: 'Manual Controls',
            ventilation: 'Ventilation',
            irrigation: 'Irrigation',
            heating: 'Heating',
            shading: 'Shading',
            temperatureSettings: 'Temperature Settings',
            heatingThreshold: 'Heating Threshold',
            coolingThreshold: 'Cooling Threshold',
        };
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{copy.title}</h3>
            <div className="grid grid-cols-2 gap-4">
                <button
                    onClick={() => onToggle('ventilation')}
                    className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-colors ${status.ventilation ? 'bg-green-100 text-green-700' : 'bg-slate-50 text-slate-500'
                        }`}
                >
                    <Fan className="w-6 h-6" />
                    <span className="text-sm font-medium">{copy.ventilation}</span>
                </button>
                <button
                    onClick={() => onToggle('irrigation')}
                    className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-colors ${status.irrigation ? 'bg-blue-100 text-blue-700' : 'bg-slate-50 text-slate-500'
                        }`}
                >
                    <Droplets className="w-6 h-6" />
                    <span className="text-sm font-medium">{copy.irrigation}</span>
                </button>
                <button
                    onClick={() => onToggle('heating')}
                    className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-colors ${status.heating ? 'bg-orange-100 text-orange-700' : 'bg-slate-50 text-slate-500'
                        }`}
                >
                    <Thermometer className="w-6 h-6" />
                    <span className="text-sm font-medium">{copy.heating}</span>
                </button>
                <button
                    onClick={() => onToggle('shading')}
                    className={`p-4 rounded-lg flex flex-col items-center gap-2 transition-colors ${status.shading ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-50 text-slate-500'
                        }`}
                >
                    <Sun className="w-6 h-6" />
                    <span className="text-sm font-medium">{copy.shading}</span>
                </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-100">
                <h4 className="text-sm font-medium text-slate-700 mb-3">{copy.temperatureSettings}</h4>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">{copy.heatingThreshold}</label>
                        <input
                            type="range"
                            min="10" max="30"
                            value={status.settings.heating}
                            onChange={(e) => onSettingsChange({ ...status.settings, heating: parseInt(e.target.value) })}
                            className="w-full accent-orange-500"
                        />
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>10°C</span>
                            <span className="font-medium text-slate-700">{status.settings.heating}°C</span>
                            <span>30°C</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">{copy.coolingThreshold}</label>
                        <input
                            type="range"
                            min="15" max="35"
                            value={status.settings.cooling}
                            onChange={(e) => onSettingsChange({ ...status.settings, cooling: parseInt(e.target.value) })}
                            className="w-full accent-blue-500"
                        />
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>15°C</span>
                            <span className="font-medium text-slate-700">{status.settings.cooling}°C</span>
                            <span>35°C</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
