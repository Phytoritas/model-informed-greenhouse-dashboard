import { useState } from 'react';
import { Bell, Globe2, Leaf, MessageCircle, Search, Settings } from 'lucide-react';
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
        tagline: 'Model-informed greenhouse decisions with live climate, scenario, and knowledge surfaces.',
        language: 'Language',
        assistant: 'Assistant',
        search: 'Search climate, scenarios, knowledge, or market signals',
        alerts: 'Alerts',
        pageTitle: 'Smart greenhouse AI decision platform',
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
    <header>
      <div className="sg-glass w-full rounded-[26px] px-4 py-4 sm:px-5">
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,0.9fr)_minmax(320px,0.72fr)_auto] 2xl:items-center">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-3">
              <div
                aria-label={copy.brand}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(145deg,rgba(255,253,249,0.98),rgba(232,241,227,0.86))] text-[color:var(--sg-color-olive)]"
                style={{ boxShadow: 'var(--sg-shadow-card)' }}
              >
                <Leaf className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-black tracking-[-0.02em] text-[color:var(--sg-text-strong)]">
                    {copy.brand}
                  </span>
                  <span className="rounded-full bg-[color:var(--sg-color-sage-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--sg-color-olive)]">
                    Command OS
                  </span>
                </div>
                <h1 className="mt-1 truncate text-[clamp(1.05rem,0.9rem+0.45vw,1.42rem)] font-bold tracking-[-0.02em] text-[color:var(--sg-text-strong)]">
                  {resolvedPageTitle}
                </h1>
              </div>
            </div>
            {resolvedPageDescription ? (
              <p className="mt-2 max-w-[760px] text-sm leading-6 text-[color:var(--sg-text-muted)]">{resolvedPageDescription}</p>
            ) : null}
          </div>

          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
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
              className="h-11 rounded-full !border !border-[color:var(--sg-outline-soft)] !bg-[color:var(--sg-surface-raised)] pl-10 text-[color:var(--sg-text-strong)] placeholder:text-[color:var(--sg-text-faint)] shadow-[var(--sg-shadow-card)]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
              <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--sg-outline-soft)] bg-white/75 px-2 py-1.5 text-xs font-medium text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
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
              <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--sg-outline-soft)] bg-white/75 px-2 py-1.5" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                <Search className="h-4 w-4 text-[color:var(--sg-text-faint)] lg:hidden" />
                {(['Cucumber', 'Tomato'] as CropType[]).map((crop) => (
                  <button
                    key={crop}
                    type="button"
                    onClick={() => onCropChange(crop)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      selectedCrop === crop
                        ? 'bg-[color:var(--sg-color-olive)] text-white'
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
                className={assistantOpen ? 'rounded-full bg-[color:var(--sg-color-primary)] text-white hover:bg-[color:var(--sg-color-primary-strong)]' : 'rounded-full'}
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
    </header>
  );
}
