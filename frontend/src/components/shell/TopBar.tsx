import { useState } from 'react';
import { Bell, Search, Settings } from 'lucide-react';
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
 * Page context and utilities below the global task navigation. The shared
 * navigation and floating control provide the assistant entry points.
 */
export default function TopBar({
  locale,
  selectedCrop,
  telemetryStatus,
  telemetryDetail,
  pageTitle,
  pageDescription,
  onLocaleChange,
  onCropChange,
  onOpenAlerts,
  onSearchSubmit,
  onOpenSettings,
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
    <header className="workspace-toolbar">
      <div className="workspace-toolbar-heading">
          <div className="min-w-0">
            <h1 className="workspace-toolbar-title">
              {resolvedPageTitle}
            </h1>
            {pageDescription ? <p className="workspace-toolbar-description">{pageDescription}</p> : null}
          </div>
          <div className="workspace-toolbar-search">
            <Search className="h-4 w-4 shrink-0 text-[color:var(--sg-text-faint)]" aria-hidden="true" />
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
              className="h-11 min-w-0 !border-0 !bg-transparent !shadow-none px-0 text-sm text-[color:var(--sg-text-strong)] placeholder:text-[color:var(--sg-text-faint)]"
            />
          </div>
      </div>
          <div className="workspace-toolbar-controls">
            <TelemetryFreshnessChip status={telemetryStatus} detail={telemetryDetail} />
            <div className="workspace-toggle" role="group" aria-label={copy.language}>
              <span className="sr-only">{copy.language}</span>
              {(['ko', 'en'] as AppLocale[]).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => onLocaleChange(candidate)}
                  aria-pressed={locale === candidate}
                  className={`workspace-toggle-button ${
                    locale === candidate
                      ? 'workspace-toggle-button-active'
                      : ''
                  }`}
                >
                  {candidate === 'ko' ? '한국어' : 'EN'}
                </button>
              ))}
            </div>
            <div className="workspace-toggle" role="group" aria-label={locale === 'ko' ? '작물 선택' : 'Select crop'}>
              {(['Cucumber', 'Tomato'] as CropType[]).map((crop) => (
                <button
                  key={crop}
                  type="button"
                  onClick={() => onCropChange(crop)}
                  aria-pressed={selectedCrop === crop}
                  className={`workspace-toggle-button ${
                    selectedCrop === crop
                      ? 'workspace-toggle-button-active'
                      : ''
                  }`}
                >
                  {getCropLabel(crop, locale)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onOpenAlerts}
              className="workspace-icon-button"
              aria-label={copy.alerts}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={copy.settings}
              onClick={onOpenSettings}
              className="workspace-icon-button"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
    </header>
  );
}
