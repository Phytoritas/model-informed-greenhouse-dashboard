import { useState } from 'react';
import { Bell, Globe2, MessageCircle, Settings } from 'lucide-react';
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

/**
 * Slim one-row workspace utility bar rendered below the shared GlobalTopNav
 * header: the current page title, a compact search pill, and the control
 * cluster (telemetry, locale, crop, alerts, assistant, settings). The brand
 * mark lives in GlobalTopNav, so this row stays title-first.
 */
export default function TopBar({
  locale,
  selectedCrop,
  telemetryStatus,
  telemetryDetail,
  pageTitle,
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
        language: '언어',
        assistant: '질문 도우미',
        search: '온실, 시세, 생육 등 현황 확인하기',
        alerts: '긴급 알림',
        fallbackTitle: '스마트 온실 인공지능 의사결정 플랫폼',
        settings: '설정',
      }
    : {
        language: 'Language',
        assistant: 'Assistant',
        search: 'Search work, materials, or houses',
        alerts: 'Alerts',
        fallbackTitle: 'Today operations',
        settings: 'Settings',
      };

  const resolvedPageTitle = pageTitle ?? copy.fallbackTitle;

  const handleSearchSubmit = () => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      return;
    }
    onSearchSubmit(normalizedQuery);
    setSearchQuery('');
  };

  return (
    <header className="pt-3">
      <div className="mx-auto w-full max-w-[1640px] px-4 sm:px-6 xl:px-8">
        <div className="sg-panel flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <h1 className="truncate text-sm font-bold text-[color:var(--sg-text-strong)]">
              {resolvedPageTitle}
            </h1>
          </div>

          <div className="order-last w-full basis-full xl:order-none xl:ml-2 xl:w-auto xl:max-w-[400px] xl:flex-1 xl:basis-auto">
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
              className="h-9 rounded-full !border !border-[color:var(--sg-outline-soft)] !bg-[color:var(--sg-surface-muted)] px-4 text-sm text-[color:var(--sg-text-strong)] placeholder:text-[color:var(--sg-text-faint)]"
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
            <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--sg-outline-soft)] bg-white px-1.5 py-1 text-xs font-medium text-[color:var(--sg-text-muted)]">
              <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">{copy.language}</span>
              {(['ko', 'en'] as AppLocale[]).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => onLocaleChange(candidate)}
                  className={`rounded-full px-2.5 py-0.5 transition ${
                    locale === candidate
                      ? 'bg-[color:var(--sg-text-strong)] text-white'
                      : 'text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]'
                  }`}
                >
                  {candidate === 'ko' ? '한국어' : 'EN'}
                </button>
              ))}
            </div>
            <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--sg-outline-soft)] bg-white px-1.5 py-1">
              {(['Cucumber', 'Tomato'] as CropType[]).map((crop) => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => onCropChange(crop)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    selectedCrop === crop
                      ? 'bg-[color:var(--sg-color-primary)] text-white'
                      : 'text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]'
                  }`}
                >
                  {getCropLabel(crop, locale)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenAlerts}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-text-strong)] transition hover:bg-[color:var(--sg-color-primary-soft)]"
              aria-label={copy.alerts}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[color:var(--sg-accent-danger)]" />
            </button>
            <Button
              onClick={onAssistantToggle}
              variant={assistantOpen ? 'primary' : 'secondary'}
              size="sm"
              className="rounded-full"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              {copy.assistant}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.settings}
              onClick={onOpenSettings}
              className="h-9 w-9 rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-text-strong)] hover:bg-[color:var(--sg-color-primary-soft)]"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
