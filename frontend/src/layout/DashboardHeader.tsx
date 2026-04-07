import { MessageCircle, Sprout } from 'lucide-react';
import type { AppLocale } from '../i18n/locale';
import type { CropType } from '../types';

interface DashboardHeaderProps {
    brandTagline: string;
    languageLabel: string;
    systemOnlineLabel: string;
    assistantLabel: string;
    locale: AppLocale;
    selectedCrop: CropType;
    telemetryToneClass: string;
    telemetryLabel: string;
    isChatOpen: boolean;
    onLocaleChange: (locale: AppLocale) => void;
    onCropChange: (crop: CropType) => void;
    onAssistantToggle: () => void;
    getCropLabel: (crop: CropType, locale: AppLocale) => string;
}

export default function DashboardHeader({
    brandTagline,
    languageLabel,
    systemOnlineLabel,
    assistantLabel,
    locale,
    selectedCrop,
    telemetryToneClass,
    telemetryLabel,
    isChatOpen,
    onLocaleChange,
    onCropChange,
    onAssistantToggle,
    getCropLabel,
}: DashboardHeaderProps) {
    const brandName = locale === 'ko' ? '스마트그로우' : 'SmartGrow';

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-green-600 p-2 shadow-lg shadow-green-200">
                        <Sprout className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="tracking-tight text-xl font-bold text-slate-800">
                            {brandName} <span className="text-green-600">AI</span>
                        </h1>
                        <p className="hidden text-xs text-slate-500 sm:block">{brandTagline}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
                        <span className="hidden text-[11px] font-medium uppercase tracking-wide text-slate-400 sm:block">
                            {languageLabel}
                        </span>
                        <div className="flex rounded-md bg-slate-100 p-1">
                            {(['en', 'ko'] as AppLocale[]).map((targetLocale) => (
                                <button
                                    key={targetLocale}
                                    type="button"
                                    onClick={() => onLocaleChange(targetLocale)}
                                    aria-label={`${languageLabel}: ${targetLocale === 'en' ? 'English' : '한국어'}`}
                                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        locale === targetLocale
                                            ? 'bg-white text-green-700 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {targetLocale === 'en' ? 'EN' : '한국어'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex rounded-lg bg-slate-100 p-1">
                        {(['Cucumber', 'Tomato'] as CropType[]).map((crop) => (
                            <button
                                key={crop}
                                type="button"
                                onClick={() => onCropChange(crop)}
                                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                                    selectedCrop === crop
                                        ? 'bg-white text-green-700 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                {getCropLabel(crop, locale)}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
                        <span className={`h-2 w-2 rounded-full ${telemetryToneClass}`} />
                        {systemOnlineLabel} · {telemetryLabel}
                    </div>

                    <button
                        type="button"
                        onClick={onAssistantToggle}
                        aria-label={assistantLabel}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors ${
                            isChatOpen ? 'bg-green-100 text-green-700' : 'bg-slate-800 text-white hover:bg-slate-700'
                        }`}
                    >
                        <MessageCircle className="h-5 w-5" />
                        <span>{assistantLabel}</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
