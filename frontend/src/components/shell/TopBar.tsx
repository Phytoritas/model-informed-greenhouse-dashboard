import { Bell, Globe2, MessageCircle, Search, Settings, Sprout, UserRound } from 'lucide-react';
import type { AppLocale } from '../../i18n/locale';
import type { CropType } from '../../types';
import TelemetryFreshnessChip from '../status/TelemetryFreshnessChip';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
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
  onOpenSettings,
  assistantOpen,
  getCropLabel,
}: TopBarProps) {
  const copy = locale === 'ko'
    ? {
        brand: 'PhytoSync',
        tagline: '오늘 판단과 주요 제어 흐름을 간단한 타일 화면으로 정리합니다.',
        language: '언어',
        assistant: '질문 도우미',
        search: '동, 작업, 자재를 찾기',
        alerts: '경보',
        pageTitle: '오늘 운영',
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

  const resolvedPageTitle = pageTitle ?? copy.pageTitle;
  const resolvedPageDescription = pageDescription ?? copy.tagline;

  return (
    <header className="pt-4">
      <div className="mx-auto w-full max-w-[1640px] px-4 sm:px-6 xl:px-8">
        <div className="sg-glass flex w-full flex-col gap-4 rounded-[28px] px-5 py-4 lg:min-h-[80px] lg:flex-row lg:items-center lg:gap-5">
          <div className="flex min-w-0 items-center gap-4 lg:w-[320px] lg:shrink-0">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,var(--sg-accent-violet),#7e2c2d)] text-white" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
              <Sprout className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="sg-eyebrow text-[color:var(--sg-accent-violet)]">{copy.brand}</div>
              <h1 className="mt-1 text-[clamp(1.3rem,1rem+1vw,2rem)] font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">
                {resolvedPageTitle}
              </h1>
              <p className="mt-1 max-w-[380px] truncate text-sm text-[color:var(--sg-text-muted)]">{resolvedPageDescription}</p>
            </div>
          </div>

          <div className="min-w-0 lg:flex-1">
            <div className="mx-auto max-w-[520px] lg:px-2">
              <Input aria-label={copy.search} placeholder={copy.search} className="h-10 rounded-full bg-white/78" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:w-[520px] lg:justify-end">
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
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={copy.settings}
                  className="h-11 w-11 rounded-full bg-white/75 text-[color:var(--sg-text-strong)] hover:bg-white"
                  style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                  <UserRound className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={onOpenSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  {copy.settings}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
