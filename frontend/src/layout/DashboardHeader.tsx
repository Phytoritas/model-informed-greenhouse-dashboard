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
    const brandName = 'PhytoSync';
    const brandSuffix = locale === 'ko' ? '재배 도움' : 'Grower support';

    return (
        <header className="sticky top-0 z-40 border-b border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-bg-canvas)]/94 shadow-[var(--sg-shadow-card)] backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-[1680px] items-center justify-between px-5 sm:px-7 lg:px-10">
                <div className="flex items-center gap-2">
                    <div className="rounded-[18px] bg-[linear-gradient(135deg,var(--sg-accent-earth),#c2573f)] p-2.5 shadow-[0_18px_40px_rgba(161,74,53,0.24)]">
                        <Sprout className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="tracking-tight text-xl font-bold text-[color:var(--sg-text-strong)]">
                            {brandName} <span className="text-[color:var(--sg-accent-earth)]">{brandSuffix}</span>
                        </h1>
                        <p className="hidden text-xs text-[color:var(--sg-text-muted)] sm:block">{brandTagline}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 rounded-full border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-2 py-1 shadow-[var(--sg-shadow-card)]">
                        <span className="hidden text-[11px] font-medium uppercase tracking-wide text-[color:var(--sg-text-subtle)] sm:block">
                            {languageLabel}
                        </span>
                        <div className="flex rounded-full bg-[color:var(--sg-surface-warm)] p-1">
                            {(['en', 'ko'] as AppLocale[]).map((targetLocale) => (
                                <button
                                    key={targetLocale}
                                    type="button"
                                    onClick={() => onLocaleChange(targetLocale)}
                                    aria-label={`${languageLabel}: ${targetLocale === 'en' ? 'English' : '한국어'}`}
                                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                        locale === targetLocale
                                            ? 'bg-[color:var(--sg-surface-raised)] text-[color:var(--sg-accent-earth)] shadow-[var(--sg-shadow-card)]'
                                            : 'text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]'
                                    }`}
                                >
                                    {targetLocale === 'en' ? 'EN' : '한국어'}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex rounded-full bg-[color:var(--sg-surface-warm)] p-1 shadow-[var(--sg-shadow-card)]">
                        {(['Cucumber', 'Tomato'] as CropType[]).map((crop) => (
                            <button
                                key={crop}
                                type="button"
                                onClick={() => onCropChange(crop)}
                                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                                    selectedCrop === crop
                                        ? 'bg-[color:var(--sg-surface-raised)] text-[color:var(--sg-accent-earth)] shadow-[var(--sg-shadow-card)]'
                                        : 'text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]'
                                }`}
                            >
                                {getCropLabel(crop, locale)}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] px-3 py-1.5 text-sm text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
                        <span className={`h-2 w-2 rounded-full ${telemetryToneClass}`} />
                        {systemOnlineLabel} · {telemetryLabel}
                    </div>

                    <button
                        type="button"
                        onClick={onAssistantToggle}
                        aria-label={assistantLabel}
                        className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors ${
                            isChatOpen
                                ? 'bg-[color:var(--sg-accent-earth-soft)] text-[color:var(--sg-accent-earth)]'
                                : 'bg-[linear-gradient(135deg,var(--sg-accent-earth),#c45d47)] text-white shadow-[0_18px_36px_rgba(161,74,53,0.24)] hover:brightness-[1.04]'
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
