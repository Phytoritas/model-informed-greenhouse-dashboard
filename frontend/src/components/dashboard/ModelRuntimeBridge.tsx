import { Database, FlaskConical, Loader2, RefreshCw, RotateCw, SlidersHorizontal } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CropType } from '../../types';
import {
  type ModelRuntimeRunState,
  useModelRuntimeWorkbench,
} from '../../hooks/useModelRuntimeWorkbench';
import { useLocale } from '../../i18n/LocaleProvider';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';
import { StatusChip } from '../ui/status-chip';

interface ModelRuntimeBridgeProps {
  crop: CropType;
  onOpenAssistant: () => void;
}

interface RuntimeActionCard {
  key: 'snapshot' | 'replay' | 'scenario' | 'sensitivity' | 'knowledgeReindex';
  title: string;
  endpoint: string;
  description: string;
  buttonLabel: string;
  icon: LucideIcon;
  onRun: () => void;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return '-';
  }

  return `${Math.round(value * 100)}%`;
}

function statusTone(state: ModelRuntimeRunState): 'growth' | 'stable' | 'warning' | 'muted' {
  if (state.status === 'success') {
    return 'growth';
  }
  if (state.status === 'error') {
    return 'warning';
  }
  if (state.status === 'loading') {
    return 'stable';
  }
  return 'muted';
}

function runStatusLabel(state: ModelRuntimeRunState, locale: 'ko' | 'en'): string {
  if (locale !== 'ko') {
    return state.status;
  }
  switch (state.status) {
    case 'success':
      return '완료';
    case 'error':
      return '확인 필요';
    case 'loading':
      return '계산 중';
    case 'idle':
    default:
      return '대기';
  }
}

function resultSummary(
  key: RuntimeActionCard['key'],
  state: ModelRuntimeRunState,
  locale: 'ko' | 'en',
): string {
  const copy = locale === 'ko'
    ? {
        idle: '아직 실행하지 않았습니다.',
        loading: '계산 결과를 확인하는 중입니다.',
        snapshot: '현재 상태 저장됨',
        scenario: '수량 변화 계산됨',
        replay: '작업 영향 다시 계산됨',
        sensitivity: '민감도 계산됨',
        reindex: '재배 자료 새로고침 완료',
        outputs: '개 결과',
        levers: '개 조정값',
        confidence: '신뢰도',
      }
    : {
        idle: 'Not run yet.',
        loading: 'Checking backend response.',
        snapshot: 'Snapshot persisted',
        scenario: 'Scenario computed',
        replay: 'Work-event replay completed',
        sensitivity: 'Sensitivity computed',
        reindex: 'Knowledge catalog reindexed',
        outputs: 'outputs',
        levers: 'levers',
        confidence: 'confidence',
      };

  if (state.status === 'loading') {
    return copy.loading;
  }
  if (state.status === 'error') {
    return state.error ?? copy.idle;
  }
  if (state.status !== 'success' || !state.result) {
    return copy.idle;
  }

  if (key === 'snapshot') {
    if (locale === 'ko') {
      return copy.snapshot;
    }
    const snapshotId = asText(state.result.snapshot_id) ?? '-';
    return `${copy.snapshot}: ${snapshotId}`;
  }

  if (key === 'scenario') {
    const scenarioId = asText(state.result.scenario_id) ?? '-';
    const confidence = formatPercent(asNumber(state.result.confidence));
    return `${copy.scenario}: ${scenarioId} · ${copy.confidence} ${confidence} · ${asArray(state.result.outputs).length} ${copy.outputs}`;
  }

  if (key === 'replay') {
    if (locale === 'ko') {
      return `${copy.replay} · ${asArray(state.result.events).length} ${copy.outputs}`;
    }
    return `${copy.replay} · ${asArray(state.result.events).length} ${copy.outputs}`;
  }

  if (key === 'sensitivity') {
    const confidence = formatPercent(asNumber(state.result.confidence));
    return `${copy.sensitivity}: ${asArray(state.result.sensitivities).length} ${copy.levers} · ${copy.confidence} ${confidence}`;
  }

  const surfaceCount = asArray(state.result.surfaces).length;
  return surfaceCount > 0
    ? `${copy.reindex}: ${surfaceCount}`
    : copy.reindex;
}

export default function ModelRuntimeBridge({ crop, onOpenAssistant }: ModelRuntimeBridgeProps) {
  const { locale } = useLocale();
  const {
    runs,
    latestSnapshotId,
    createSnapshot,
    replayWorkEvent,
    runScenario,
    runSensitivity,
    reindexKnowledge,
  } = useModelRuntimeWorkbench(crop);

  const copy = locale === 'ko'
    ? {
        eyebrow: '계산 도구',
        title: '모델 계산과 자료 새로고침',
        description: '현재 온실 데이터로 수량 변화, 작업 영향, 조정 민감도를 확인합니다.',
        snapshot: '현재 상태 저장',
        snapshotDescription: '지금 온실 상태를 계산 기준으로 저장합니다.',
        replay: '작업 영향 다시 보기',
        replayDescription: '최근 작업이 생육과 수확 흐름에 준 영향을 다시 계산합니다.',
        scenario: '수량 변화 계산',
        scenarioDescription: '하루, 사흘, 2주 단위의 수확 전망 변화를 계산합니다.',
        sensitivity: '조정 민감도',
        sensitivityDescription: '온도, CO2, 습도 조정이 수확 예측에 주는 영향을 확인합니다.',
        reindex: '재배 자료 새로고침',
        reindexDescription: '현재 작물에 맞춰 자료와 권고 목록을 다시 정리합니다.',
        runSnapshot: '상태 저장',
        runReplay: '다시 계산',
        runScenario: '시나리오 실행',
        runSensitivity: '민감도 실행',
        runReindex: '자료 새로고침',
        currentSnapshot: '계산 기준',
        noSnapshot: '현재 상태 사용',
        ask: '질문 도우미로 해석',
      }
    : {
        eyebrow: 'Backend Runtime Bridge',
        title: 'Expose backend model features in the UI',
        description: 'Snapshot, scenario, sensitivity, and knowledge reindex endpoints stay visible in the overview.',
        snapshot: 'Model snapshot',
        snapshotDescription: 'Persist the current live adapter state as a normalized snapshot.',
        replay: 'Work-event replay',
        replayDescription: 'Replay a canonical work event over the saved snapshot or live state.',
        scenario: 'Run scenario',
        scenarioDescription: 'Compute 24h, 72h, and 336h outputs from the saved snapshot or live state.',
        sensitivity: 'Sensitivity analysis',
        sensitivityDescription: 'Inspect local lever effects on predicted 14-day yield.',
        reindex: 'Knowledge reindex',
        reindexDescription: 'Rebuild the SmartGrow knowledge catalog for the current crop scope.',
        runSnapshot: 'Capture snapshot',
        runReplay: 'Run replay',
        runScenario: 'Run scenario',
        runSensitivity: 'Run sensitivity',
        runReindex: 'Reindex',
        currentSnapshot: 'Current snapshot',
        noSnapshot: 'live state',
        advisor: 'Advisor exact endpoints are connected through /advisor/tab/* delegates and chat',
        deterministic: 'Environment, work, protection, and nutrient recommenders are used by advisor tabs',
        stream: 'Simulation controls and forecast websocket stay in the existing live hooks',
        legacy: 'Legacy /ai/chat and /ai/consult are preserved in the Assistant compatibility panel',
        ask: 'Ask chat',
      };

  const cards: RuntimeActionCard[] = [
    {
      key: 'snapshot',
      title: copy.snapshot,
      endpoint: '/api/models/snapshot',
      description: copy.snapshotDescription,
      buttonLabel: copy.runSnapshot,
      icon: Database,
      onRun: () => { void createSnapshot(); },
    },
    {
      key: 'replay',
      title: copy.replay,
      endpoint: '/api/models/replay',
      description: copy.replayDescription,
      buttonLabel: copy.runReplay,
      icon: RotateCw,
      onRun: () => { void replayWorkEvent(); },
    },
    {
      key: 'scenario',
      title: copy.scenario,
      endpoint: '/api/models/scenario',
      description: copy.scenarioDescription,
      buttonLabel: copy.runScenario,
      icon: SlidersHorizontal,
      onRun: () => { void runScenario(); },
    },
    {
      key: 'sensitivity',
      title: copy.sensitivity,
      endpoint: '/api/models/sensitivity',
      description: copy.sensitivityDescription,
      buttonLabel: copy.runSensitivity,
      icon: FlaskConical,
      onRun: () => { void runSensitivity(); },
    },
    {
      key: 'knowledgeReindex',
      title: copy.reindex,
      endpoint: '/api/knowledge/reindex',
      description: copy.reindexDescription,
      buttonLabel: copy.runReindex,
      icon: RefreshCw,
      onRun: () => { void reindexKnowledge(); },
    },
  ];

  return (
    <section id="process-model-tools" tabIndex={-1} className="scroll-mt-24 space-y-4" aria-labelledby="process-model-tools-title">
      <div className="sg-panel p-3.5">
        <div className="mb-3 flex flex-col gap-2 border-b border-[color:var(--sg-outline-soft)] pb-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="sg-eyebrow">{copy.eyebrow}</p>
            <h2 id="process-model-tools-title" className="mt-1 text-base font-bold text-[color:var(--sg-text-strong)]">{copy.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{copy.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={latestSnapshotId ? 'growth' : 'stable'}>
              {copy.currentSnapshot}: {latestSnapshotId ?? copy.noSnapshot}
            </StatusChip>
            <Button variant="secondary" size="sm" onClick={onOpenAssistant}>
              {copy.ask}
            </Button>
          </div>
        </div>
        <div className="overview-card-row-4">
          {cards.map((card) => (
            <RuntimeCard
              key={card.key}
              card={card}
              state={runs[card.key]}
              summary={resultSummary(card.key, runs[card.key], locale)}
              statusLabel={runStatusLabel(runs[card.key], locale)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RuntimeCard({
  card,
  state,
  summary,
  statusLabel,
}: {
  card: RuntimeActionCard;
  state: ModelRuntimeRunState;
  summary: string;
  statusLabel: string;
}) {
  const Icon = card.icon;
  const isLoading = state.status === 'loading';

  return (
    <article className="flex h-full flex-col gap-2 rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-outline-soft)] bg-white p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold text-[color:var(--sg-text-strong)]">{card.title}</h3>
          <p className="mt-1 text-[11px] leading-4 text-[color:var(--sg-text-muted)]">{card.description}</p>
        </div>
        <span className={cn(
          'flex h-7 w-7 items-center justify-center rounded-[var(--sg-radius-xs)]',
          state.status === 'error'
            ? 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary-strong)]'
            : 'bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]',
        )}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
        </span>
      </div>
      <p className="sr-only">{card.description}</p>
      <div className="rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-surface-soft)] px-2.5 py-1.5 text-[11px] leading-4 text-[color:var(--sg-text-muted)]" aria-live="polite">
        {summary}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3">
        <StatusChip tone={statusTone(state)}>{statusLabel}</StatusChip>
        <Button size="sm" variant={state.status === 'error' ? 'danger' : 'secondary'} disabled={isLoading} onClick={card.onRun}>
          {card.buttonLabel}
        </Button>
      </div>
    </article>
  );
}
