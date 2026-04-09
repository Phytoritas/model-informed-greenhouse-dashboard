import { Bell, Globe2, MessageCircle, Search, Sprout } from 'lucide-react';
import type { AppLocale } from '../../i18n/locale';
import type { CropType } from '../../types';
import TelemetryFreshnessChip from '../status/TelemetryFreshnessChip';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface TopBarProps {
    locale: AppLocale;
    selectedCrop: CropType;
    telemetryStatus: 'loading' | 'live' | 'delayed' | 'stale' | 'offline' | 'blocked' | 'provisional';
    telemetryDetail?: string | null;
    pageTitle?: string;
    pageDescription?: string;
    onLocaleChange: (locale: AppLocale) => void;
    onCropChange: (crop: CropType) => void;
    onAssistantToggle: () => void;
    assistantOpen: boolean;
    getCropLabel: (crop: CropType, locale: AppLocale) => string;
}

export default function TopBar({
    locale,
    selectedCrop,
    telemetryStatus,
    telemetryDetail,
    pageTitle,
    pageDescription,
    onLocaleChange,
    onCropChange,
    onAssistantToggle,
    assistantOpen,
    getCropLabel,
}: TopBarProps) {
    const copy = locale === 'ko'
        ? {
            brand: 'PhytoSync',
            tagline: '오늘 운영 판단, 환경 제어, 생육 흐름을 한 화면에서 잇습니다.',
            language: '언어',
            assistant: '질문하기',
            search: '동, 작업, 자재를 바로 찾기',
            alerts: '주의 알림',
            pageTitle: '오늘 온실 운영',
        }
        : {
            brand: 'PhytoSync',
            tagline: 'Connect today’s operations, climate control, and crop momentum in one place.',
            language: 'Language',
            assistant: 'Ask',
            search: 'Search work, materials, or houses',
            alerts: 'Alerts',
            pageTitle: 'Greenhouse operations today',
        };

    const resolvedPageTitle = pageTitle ?? copy.pageTitle;
    const resolvedPageDescription = pageDescription ?? copy.tagline;

    return (
        <header className="px-4 pt-4 sm:px-6 lg:px-8">
            <div className="sg-glass mx-auto flex max-w-[1536px] flex-col gap-4 rounded-[34px] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,var(--sg-accent-violet),#7e2c2d)] text-white" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
                        <Sprout className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                        <div className="sg-eyebrow text-[color:var(--sg-accent-violet)]">{copy.brand}</div>
                        <h1 className="mt-1 font-[family-name:var(--sg-font-display)] text-[clamp(1.3rem,1rem+1vw,2rem)] font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
                            {resolvedPageTitle}
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm text-[color:var(--sg-text-muted)]">{resolvedPageDescription}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-3 lg:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                        <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
                        <div className="hidden w-[20rem] md:block">
                            <Input
                                aria-label={copy.search}
                                placeholder={copy.search}
                                className="h-11 rounded-full bg-white/78"
                            />
                        </div>
                        <Badge variant="muted" className="hidden items-center gap-2 md:inline-flex">
                            <Search className="h-4 w-4" />
                            {locale === 'ko' ? '빠른 찾기' : 'Find quickly'}
                        </Badge>
                        <button
                            type="button"
                            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/75 text-[color:var(--sg-text-strong)] transition hover:bg-white"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
                            aria-label={copy.alerts}
                        >
                            <Bell className="h-5 w-5" />
                            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[color:var(--sg-accent-danger)]" />
                        </button>
                        <Button
                            onClick={onAssistantToggle}
                            variant={assistantOpen ? 'tonal' : 'default'}
                            className={assistantOpen ? 'rounded-full bg-[color:var(--sg-accent-violet)] text-white hover:bg-[#98242f]' : 'rounded-full'}
                        >
                            <MessageCircle className="h-4 w-4" />
                            {copy.assistant}
                        </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2 py-1.5 text-xs font-medium text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <Globe2 className="h-4 w-4" />
                            <span className="hidden sm:inline">{copy.language}</span>
                            {(['ko', 'en'] as AppLocale[]).map((candidate) => (
                                <button
                                    key={candidate}
                                    type="button"
                                    onClick={() => onLocaleChange(candidate)}
                                    className={`rounded-full px-3 py-1 ${
                                        locale === candidate
                                            ? 'bg-[color:var(--sg-text-strong)] text-white'
                                            : 'text-[color:var(--sg-text-muted)]'
                                    }`}
                                >
                                    {candidate === 'ko' ? '한국어' : 'EN'}
                                </button>
                            ))}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-white/75 px-2 py-1.5" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)] sm:inline">
                                {selectedCrop === 'Cucumber' ? (locale === 'ko' ? '오이 모드' : 'Cucumber lane') : (locale === 'ko' ? '토마토 모드' : 'Tomato lane')}
                            </span>
                            {(['Cucumber', 'Tomato'] as CropType[]).map((crop) => (
                                <button
                                    key={crop}
                                    type="button"
                                    onClick={() => onCropChange(crop)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                        selectedCrop === crop
                                            ? 'bg-[color:var(--sg-accent-violet)] text-white'
                                            : 'text-[color:var(--sg-text-muted)]'
                                    }`}
                                    style={selectedCrop === crop ? { boxShadow: 'var(--sg-shadow-soft)' } : undefined}
                                >
                                    {getCropLabel(crop, locale)}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
