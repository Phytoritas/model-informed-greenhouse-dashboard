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
            title: '수동 제어 확인',
            note: '장치 버튼은 화면 확인용 로컬 상태입니다. 온도, CO₂, 배액 설정은 /api/config/ops로 저장되어 백엔드 자동 제어 기준에 반영됩니다.',
            ventilation: '환기',
            irrigation: '관수',
            heating: '난방',
            shading: '차광',
            temperatureSettings: '온도 설정',
            heatingThreshold: '난방 시작 온도',
            coolingThreshold: '냉방 시작 온도',
            pBand: '제어 밴드',
            co2Target: 'CO₂ 목표',
            drainTarget: '배액 목표',
        }
        : {
            title: 'Manual control check',
            note: 'Device buttons are local visual checks. Temperature, CO₂, and drain settings are saved to /api/config/ops for backend automatic control.',
            ventilation: 'Vent',
            irrigation: 'Water',
            heating: 'Heat',
            shading: 'Screen',
            temperatureSettings: 'Temperature guide',
            heatingThreshold: 'Heat start',
            coolingThreshold: 'Cool start',
            pBand: 'Control band',
            co2Target: 'CO₂ target',
            drainTarget: 'Drain target',
        };
    const pBand = status.settings.pBand ?? 4;
    const co2Target = status.settings.co2Target ?? 800;
    const drainTarget = status.settings.drainTarget ?? 0.3;

    return (
        <div className="sg-warm-panel p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-[color:var(--sg-text-strong)]">{copy.title}</h3>
                <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.note}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <button
                    type="button"
                    onClick={() => onToggle('ventilation')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] ${status.ventilation ? 'bg-[color:var(--sg-accent-forest-soft)] text-[color:var(--sg-accent-forest)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
                        }`}
                >
                    <Fan className="h-6 w-6" />
                    <span className="text-sm font-medium">{copy.ventilation}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onToggle('irrigation')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] ${status.irrigation ? 'bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
                        }`}
                >
                    <Droplets className="h-6 w-6" />
                    <span className="text-sm font-medium">{copy.irrigation}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onToggle('heating')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] ${status.heating ? 'bg-[color:var(--sg-accent-violet-soft)] text-[color:var(--sg-accent-violet)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
                        }`}
                >
                    <Thermometer className="h-6 w-6" />
                    <span className="text-sm font-medium">{copy.heating}</span>
                </button>
                <button
                    type="button"
                    onClick={() => onToggle('shading')}
                    className={`flex flex-col items-center gap-2 rounded-[22px] p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] ${status.shading ? 'bg-[color:var(--sg-accent-amber-soft)] text-[color:var(--sg-accent-amber)]' : 'bg-[color:var(--sg-status-muted-bg)] text-[color:var(--sg-text-muted)]'
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
                    <div className="grid gap-3 sm:grid-cols-3">
                        <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                            {copy.pBand}
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={pBand}
                                onChange={(e) => onSettingsChange({ ...status.settings, pBand: Number(e.target.value) })}
                                className="h-10 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 text-sm font-semibold text-[color:var(--sg-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
                            />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                            {copy.co2Target}
                            <input
                                type="number"
                                min="300"
                                step="25"
                                value={co2Target}
                                onChange={(e) => onSettingsChange({ ...status.settings, co2Target: Number(e.target.value) })}
                                className="h-10 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 text-sm font-semibold text-[color:var(--sg-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
                            />
                        </label>
                        <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                            {copy.drainTarget}
                            <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.05"
                                value={drainTarget}
                                onChange={(e) => onSettingsChange({ ...status.settings, drainTarget: Number(e.target.value) })}
                                className="h-10 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white px-3 text-sm font-semibold text-[color:var(--sg-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
                            />
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControlPanel;
