import { useState } from 'react';
import { Bot, Loader2, MessageCircle, Sparkles } from 'lucide-react';
import DashboardCard from '../common/DashboardCard';
import { Button } from '../ui/button';
import { StatusChip } from '../ui/status-chip';
import { API_URL } from '../../config';
import type { AppLocale } from '../../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../../types';
import { buildAiDashboardContext } from '../../utils/aiDashboardContext';

type LegacyAiAction = 'consult' | 'chat';

type LegacyAiRequestState = {
  status: 'idle' | 'loading' | 'success' | 'degraded' | 'error';
  message: string | null;
  endpoint: string;
};

interface AiCompatibilityPanelProps {
  locale: AppLocale;
  crop: CropType;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  forecast?: ForecastData | null;
  history?: SensorData[];
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
}

function createState(endpoint: string): LegacyAiRequestState {
  return {
    status: 'idle',
    message: null,
    endpoint,
  };
}

function extractResponseText(payload: unknown): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    for (const key of ['text', 'answer', 'message', 'content', 'summary']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }

  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(payload ?? '');
  }
}

function toneForStatus(status: LegacyAiRequestState['status']): 'growth' | 'stable' | 'warning' | 'critical' | 'muted' {
  if (status === 'success') return 'growth';
  if (status === 'degraded') return 'warning';
  if (status === 'error') return 'critical';
  if (status === 'loading') return 'stable';
  return 'muted';
}

export default function AiCompatibilityPanel({
  locale,
  crop,
  currentData,
  metrics,
  forecast = null,
  history = [],
  producePrices = null,
  weather = null,
  rtrProfile = null,
}: AiCompatibilityPanelProps) {
  const [stateByAction, setStateByAction] = useState<Record<LegacyAiAction, LegacyAiRequestState>>({
    consult: createState('/api/ai/consult'),
    chat: createState('/api/ai/chat'),
  });
  const cropKey = crop.toLowerCase();
  const copy = locale === 'ko'
    ? {
        eyebrow: 'AI Assistant 호환 연결',
        title: 'AI 상담 · 채팅 endpoint',
        description: '기존 /api/ai 상담 surface를 Assistant 안에 보존합니다. 기본 채팅은 /api/advisor/chat을 계속 사용합니다.',
        consult: 'AI 상담 실행',
        chat: 'AI 채팅 확인',
        prompt: '현재 온실 상태와 오늘 가장 먼저 볼 의사결정을 간단히 요약해 주세요.',
        idle: '아직 실행하지 않음',
        loading: '요청 중',
        success: '연결됨',
        degraded: '대체 응답',
        error: '실패',
      }
    : {
        eyebrow: 'AI Assistant compatibility',
        title: 'AI consult and chat endpoints',
        description: 'Keeps the legacy /api/ai assistant surfaces visible while the main chat continues to use /api/advisor/chat.',
        consult: 'Run AI consult',
        chat: 'Check AI chat',
        prompt: 'Summarize the current greenhouse state and the first operating decision to review today.',
        idle: 'Not run yet',
        loading: 'Requesting',
        success: 'Connected',
        degraded: 'Fallback reply',
        error: 'Failed',
      };

  const execute = async (action: LegacyAiAction) => {
    const endpoint = action === 'consult' ? '/ai/consult' : '/ai/chat';
    setStateByAction((current) => ({
      ...current,
      [action]: {
        ...current[action],
        status: 'loading',
      },
    }));

    try {
      const dashboard = buildAiDashboardContext({
        currentData,
        metrics,
        crop,
        history,
        forecast,
        producePrices: producePrices?.trend?.series ? producePrices : null,
        weather,
        rtrProfile,
      });
      const body = action === 'consult'
        ? {
            crop: cropKey,
            dashboard,
            language: locale,
          }
        : {
            crop: cropKey,
            messages: [{ role: 'user', content: copy.prompt }],
            dashboard,
            language: locale,
          };
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await response.text();
      let payload: unknown = null;
      try {
        payload = raw ? JSON.parse(raw) : null;
      } catch {
        payload = raw;
      }

      if (!response.ok) {
        const message = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? ((payload as { detail?: string; message?: string }).detail ?? (payload as { message?: string }).message)
          : null;
        throw new Error(message ?? raw ?? `HTTP ${response.status}`);
      }

      const backendStatus = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? String((payload as { status?: unknown }).status ?? 'success')
        : 'success';
      setStateByAction((current) => ({
        ...current,
        [action]: {
          endpoint: `/api${endpoint}`,
          status: backendStatus === 'degraded' ? 'degraded' : 'success',
          message: extractResponseText(payload).slice(0, 360),
        },
      }));
    } catch (error) {
      setStateByAction((current) => ({
        ...current,
        [action]: {
          endpoint: `/api${endpoint}`,
          status: 'error',
          message: error instanceof Error ? error.message : 'Request failed.',
        },
      }));
    }
  };

  const actions: Array<{
    key: LegacyAiAction;
    label: string;
    icon: typeof Sparkles;
    variant: 'secondary' | 'ghost';
  }> = [
    { key: 'consult', label: copy.consult, icon: Sparkles, variant: 'secondary' },
    { key: 'chat', label: copy.chat, icon: MessageCircle, variant: 'ghost' },
  ];

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      className="sg-tint-neutral"
    >
      <div className="grid gap-3">
        {actions.map((action) => {
          const requestState = stateByAction[action.key];
          const Icon = action.icon;
          const loading = requestState.status === 'loading';
          const statusLabel = requestState.status === 'idle'
            ? copy.idle
            : requestState.status === 'loading'
              ? copy.loading
              : requestState.status === 'success'
                ? copy.success
                : requestState.status === 'degraded'
                  ? copy.degraded
                  : copy.error;

          return (
            <article
              key={action.key}
              className="rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-white/82 p-3"
              style={{ boxShadow: 'var(--sg-shadow-card)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--sg-color-blush)] text-[color:var(--sg-color-primary)]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[color:var(--sg-text-strong)]">{action.label}</div>
                    <div className="mt-1 text-[11px] font-semibold uppercase text-[color:var(--sg-text-faint)]">
                      {requestState.endpoint}
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant={action.variant}
                  disabled={loading}
                  onClick={() => { void execute(action.key); }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
                  {action.label}
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-2 text-xs leading-6 text-[color:var(--sg-text-muted)]" aria-live="polite">
                <StatusChip tone={toneForStatus(requestState.status)}>{statusLabel}</StatusChip>
                {requestState.message ? <p>{requestState.message}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </DashboardCard>
  );
}
