import { useState } from 'react';
import { Bell, Globe2, MessageCircle, Search, Settings } from 'lucide-react';
import type { AppLocale } from '../../i18n/locale';
import type { CropType } from '../../types';
import TelemetryFreshnessChip from '../status/TelemetryFreshnessChip';
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
  onOpenAlerts: () => void;
  onSearchSubmit: (query: string) => void;
  onOpenSettings: () => void;
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
  onOpenAlerts,
  onSearchSubmit,
  onOpenSettings,
  assistantOpen,
  getCropLabel,
}: TopBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const copy = locale === 'ko'
    ? {
        brand: 'PhytoSync',
        platformTitle: '스마트 온실 인공지능 의사결정 플랫폼',
        tagline: '',
        language: '언어',
        assistant: '질문 도우미',
        search: '온실, 시세, 생육 등 현황 확인하기',
        alerts: '긴급 알림',
        pageTitle: '스마트 온실 인공지능 의사결정 플랫폼',
        settings: '설정',
      }
    : {
        brand: 'PhytoSync',
        tagline: 'Keep today’s operations and control flow in a compact working shell.',
        language: 'Language',
        assistant: 'Assistant',
        search: 'Search work, materials, or houses',
        alerts: 'Alerts',
        pageTitle: 'Today operations',
        settings: 'Settings',
      };

  const resolvedPageTitle = locale === 'ko' ? copy.pageTitle : pageTitle ?? copy.pageTitle;
  const resolvedPageDescription = locale === 'ko'
    ? ''
    : pageDescription ?? copy.tagline;

  const handleSearchSubmit = () => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      return;
    }
    onSearchSubmit(normalizedQuery);
    setSearchQuery('');
  };

  return (
    <header className="pt-4">
      <div className="mx-auto w-full max-w-[1640px] px-4 sm:px-6 xl:px-8">
        <div className="sg-glass w-full rounded-[28px] px-5 py-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  aria-label={copy.brand}
                  className="inline-flex h-12 w-[62px] shrink-0 flex-col items-center justify-center rounded-[14px] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(145deg,rgba(255,255,255,0.98),rgba(248,231,223,0.94))] px-1.5"
                  style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                  <span className="w-full text-center text-[0.84rem] font-black leading-[0.95] tracking-[0.06em] text-[color:var(--sg-accent-violet)]">
                    Phyto
                  </span>
                  <span className="w-full text-center text-[0.84rem] font-black leading-[0.95] tracking-[0.06em] text-[color:var(--sg-text-strong)]">
                    Sync
                  </span>
                </div>
                <h1 className="truncate whitespace-nowrap text-[clamp(1.08rem,0.86rem+0.52vw,1.5rem)] font-bold tracking-[-0.02em] text-[color:var(--sg-text-strong)]">
                  {resolvedPageTitle}
                </h1>
              </div>
              {resolvedPageDescription ? (
                <p className="mt-2 max-w-[860px] truncate text-sm text-[color:var(--sg-text-muted)]">{resolvedPageDescription}</p>
              ) : null}
              <div className="mt-3 max-w-[860px]">
                <Input
                  aria-label={copy.search}
                  placeholder={copy.search}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSearchSubmit();
                    }
                  }}
                  className="h-11 rounded-[18px] !border !border-[color:var(--sg-outline-strong)] !bg-white text-[color:var(--sg-text-strong)] placeholder:text-[color:var(--sg-text-faint)] shadow-[var(--sg-shadow-card)]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
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
                <Search className="h-4 w-4 text-[color:var(--sg-text-faint)] lg:hidden" />
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
              <button
                type="button"
                onClick={onOpenAlerts}
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
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={copy.settings}
                onClick={onOpenSettings}
                className="h-11 w-11 rounded-full bg-white/75 text-[color:var(--sg-text-strong)] hover:bg-white"
                style={{ boxShadow: 'var(--sg-shadow-card)' }}
              >
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
