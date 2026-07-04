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
        eyebrow: 'AI 연결 상태',
        title: 'AI 상담 연결 점검',
        description: '이전 세대 AI 상담 연결이 살아 있는지 버튼 한 번으로 확인합니다. 평소 질문은 위 질문 도우미를 사용하세요.',
        consult: 'AI 상담 확인',
        chat: 'AI 채팅 확인',
        prompt: '현재 온실 상태와 오늘 가장 먼저 볼 의사결정을 간단히 요약해 주세요.',
        idle: '아직 확인 전',
        loading: '확인 중',
        success: '연결됨',
        degraded: '대체 응답',
        error: '실패',
      }
    : {
        eyebrow: 'AI connectivity',
        title: 'Legacy AI consult check',
        description: 'One-tap check that the legacy AI consult connection is still alive. Use the question helper above for everyday questions.',
        consult: 'Check AI consult',
        chat: 'Check AI chat',
        prompt: 'Summarize the current greenhouse state and the first operating decision to review today.',
        idle: 'Not checked yet',
        loading: 'Checking',
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
  }> = [
    { key: 'consult', label: copy.consult, icon: Sparkles },
    { key: 'chat', label: copy.chat, icon: MessageCircle },
  ];

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      className="sg-tint-neutral"
    >
      <div className="grid gap-2">
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
              className="rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-white/82 px-3 py-2.5"
              style={{ boxShadow: 'var(--sg-shadow-card)' }}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-[color:var(--sg-color-primary)]" aria-hidden="true" />
                  <span className="truncate text-sm font-bold text-[color:var(--sg-text-strong)]">{action.label}</span>
                  <StatusChip tone={toneForStatus(requestState.status)}>{statusLabel}</StatusChip>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  disabled={loading}
                  onClick={() => { void execute(action.key); }}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
                  {action.label}
                </Button>
              </div>
              {requestState.message ? (
                <p className="mt-2 text-xs leading-5 text-[color:var(--sg-text-muted)]" aria-live="polite">
                  {requestState.message}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </DashboardCard>
  );
}
