import { useEffect, useState } from 'react';
import { CircleDollarSign, CloudSun, LifeBuoy, PlugZap, Sprout } from 'lucide-react';
import DashboardCard from '../components/common/DashboardCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { StatusChip } from '../components/ui/status-chip';
import { API_URL } from '../config';
import type { AppLocale } from '../i18n/locale';
import type { CropType } from '../types';
import SettingsPage from './settings-page';

interface SettingsRoutePageProps {
  locale: AppLocale;
  crop: CropType;
  selectedCropLabel: string;
  assistantOpen: boolean;
  telemetrySummary: string;
  weatherConnected: boolean;
  marketConnected: boolean;
}

type SettingsPayload = {
  price_per_kg?: number;
  cost_per_kwh?: number;
  status?: string;
  message?: string;
  detail?: string;
  settings?: {
    price_per_kg?: number;
    cost_per_kwh?: number;
  };
};

export default function SettingsRoutePage({
  locale,
  crop,
  selectedCropLabel,
  assistantOpen,
  telemetrySummary,
  weatherConnected,
  marketConnected,
}: SettingsRoutePageProps) {
  const [pricePerKg, setPricePerKg] = useState('3000');
  const [costPerKwh, setCostPerKwh] = useState('120');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const cropKey = crop.toLowerCase();
  const saveCopy = locale === 'ko'
    ? {
        price: 'kg당 판매가',
        cost: 'kWh당 전력비',
        save: '설정 저장',
        saved: '저장됨',
        loading: '현재 설정 불러오는 중',
        loaded: '현재 설정 반영됨',
        error: '저장 실패',
        loadError: '설정 불러오기 실패',
        invalid: '숫자 값을 확인해 주세요.',
      }
    : {
        price: 'Price per kg',
        cost: 'Cost per kWh',
        save: 'Save settings',
        saved: 'Saved',
        loading: 'Loading current settings',
        loaded: 'Current settings loaded',
        error: 'Save failed',
        loadError: 'Failed to load settings',
        invalid: 'Check numeric values.',
      };

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    setStatusMessage(null);
    setSaveState('idle');

    async function loadSettings() {
      try {
        const response = await fetch(`${API_URL}/settings?crop=${encodeURIComponent(cropKey)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as SettingsPayload;
        if (!response.ok || payload.status === 'error') {
          throw new Error(payload.detail ?? payload.message ?? response.statusText ?? 'settings load failed');
        }

        const resolvedSettings = payload.settings ?? payload;
        if (typeof resolvedSettings.price_per_kg === 'number') {
          setPricePerKg(String(resolvedSettings.price_per_kg));
        }
        if (typeof resolvedSettings.cost_per_kwh === 'number') {
          setCostPerKwh(String(resolvedSettings.cost_per_kwh));
        }
        setLoadState('loaded');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setLoadState('error');
        setStatusMessage(error instanceof Error ? error.message : saveCopy.loadError);
      }
    }

    void loadSettings();
    return () => controller.abort();
  }, [cropKey, saveCopy.loadError]);

  const handleSaveSettings = async () => {
    setSaveState('saving');
    setStatusMessage(null);
    try {
      const price = Number(pricePerKg);
      const cost = Number(costPerKwh);
      if (!Number.isFinite(price) || !Number.isFinite(cost)) {
        throw new Error(saveCopy.invalid);
      }
      const response = await fetch(`${API_URL}/settings?crop=${encodeURIComponent(cropKey)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_per_kg: price,
          cost_per_kwh: cost,
        }),
      });
      const payload = (await response.json()) as SettingsPayload;
      if (!response.ok || payload.status === 'error') {
        throw new Error(payload.detail ?? payload.message ?? response.statusText ?? 'settings save failed');
      }
      setSaveState('saved');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : saveCopy.error);
      setSaveState('error');
    }
  };

  return (
    <SettingsPage
      locale={locale}
      shellCard={(
        <DashboardCard
          eyebrow={locale === 'ko' ? '운영 프로필' : 'Operating profile'}
          title={locale === 'ko' ? '현재 작업 기준' : 'Current workspace basis'}
          description={locale === 'ko' ? '언어, 작물, 질문 도우미 상태처럼 지원 요청과 운영 판단에 함께 쓰는 기준입니다.' : 'Review language, crop, and assistant state used for support and operating decisions.'}
          className="sg-tint-neutral"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="sg-eyebrow">{locale === 'ko' ? '언어' : 'Locale'}</p>
                <LifeBuoy className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
              </div>
              <div className="mt-3 text-lg font-bold text-[color:var(--sg-text-strong)]">{locale === 'ko' ? '한국어' : 'English'}</div>
            </article>
            <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="sg-eyebrow">{locale === 'ko' ? '작물' : 'Crop'}</p>
                <Sprout className="h-4 w-4 text-[color:var(--sg-color-success)]" aria-hidden="true" />
              </div>
              <div className="mt-3 text-lg font-bold text-[color:var(--sg-text-strong)]">{selectedCropLabel}</div>
            </article>
            <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="sg-eyebrow">{locale === 'ko' ? '질문 도우미' : 'Assistant'}</p>
                <StatusChip tone={assistantOpen ? 'growth' : 'muted'}>{assistantOpen ? (locale === 'ko' ? '열림' : 'Open') : (locale === 'ko' ? '닫힘' : 'Closed')}</StatusChip>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                {locale === 'ko' ? '현재 화면과 연결된 질문/자료 흐름입니다.' : 'Question and material flow connected to this workspace.'}
              </p>
            </article>
          </div>
          <div className="mt-4 rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {locale === 'ko'
              ? '문제가 생기면 이 화면의 연결 상태와 비용 기준을 먼저 확인한 뒤 지원 요청을 정리하면 됩니다.'
              : 'When support is needed, start from the connection state and cost assumptions on this screen.'}
          </div>
        </DashboardCard>
      )}
      laneCard={(
        <DashboardCard
          eyebrow={locale === 'ko' ? 'Contact' : 'Contact'}
          title={locale === 'ko' ? '연동 상태와 비용 기준' : 'Connectivity and cost assumptions'}
          description={locale === 'ko' ? '센서 상태와 날씨·시세 연동, 작물별 가격/전력 단가를 저장합니다.' : 'Review sensor freshness, weather/market links, and crop-specific price/cost values.'}
          className="sg-tint-rose"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="sg-eyebrow">{locale === 'ko' ? '센서' : 'Sensor'}</p>
                <PlugZap className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-bold text-[color:var(--sg-text-strong)]">{telemetrySummary}</p>
            </article>
            <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="sg-eyebrow">{locale === 'ko' ? '기상' : 'Weather'}</p>
                <CloudSun className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
              </div>
              <StatusChip tone={weatherConnected ? 'growth' : 'warning'}>{weatherConnected ? (locale === 'ko' ? '연결됨' : 'Connected') : (locale === 'ko' ? '대기 중' : 'Pending')}</StatusChip>
            </article>
            <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="sg-eyebrow">{locale === 'ko' ? '시장' : 'Market'}</p>
                <CircleDollarSign className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
              </div>
              <StatusChip tone={marketConnected ? 'growth' : 'warning'}>{marketConnected ? (locale === 'ko' ? '연결됨' : 'Connected') : (locale === 'ko' ? '대기 중' : 'Pending')}</StatusChip>
            </article>
          </div>
          <form
            className="mt-5 grid gap-3 rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveSettings();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                {saveCopy.price}
                <Input
                  type="number"
                  min="0"
                  value={pricePerKg}
                  onChange={(event) => setPricePerKg(event.target.value)}
                  aria-label={saveCopy.price}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                {saveCopy.cost}
                <Input
                  type="number"
                  min="0"
                  value={costPerKwh}
                  onChange={(event) => setCostPerKwh(event.target.value)}
                  aria-label={saveCopy.cost}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" disabled={saveState === 'saving'}>
                {saveCopy.save}
              </Button>
              {loadState === 'loading' ? <span className="text-xs font-semibold text-[color:var(--sg-text-muted)]">{saveCopy.loading}</span> : null}
              {loadState === 'loaded' && saveState === 'idle' ? <span className="text-xs font-semibold text-[color:var(--sg-color-success)]">{saveCopy.loaded}</span> : null}
              {loadState === 'error' ? <span className="text-xs font-semibold text-[color:var(--sg-color-primary)]">{saveCopy.loadError}{statusMessage ? `: ${statusMessage}` : ''}</span> : null}
              {saveState === 'saved' ? <span className="text-xs font-semibold text-[color:var(--sg-color-success)]">{saveCopy.saved}</span> : null}
              {saveState === 'error' ? <span className="text-xs font-semibold text-[color:var(--sg-color-primary)]">{saveCopy.error}{statusMessage ? `: ${statusMessage}` : ''}</span> : null}
            </div>
          </form>
        </DashboardCard>
      )}
    />
  );
}
