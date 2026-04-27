import { Suspense, lazy, useEffect } from 'react';
import { Activity, Calculator, CircleGauge, type LucideIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import DashboardCard from '../components/common/DashboardCard';
import PageCanvas from '../components/layout/PageCanvas';
import type { PageCanvasTab } from '../components/layout/PageCanvas';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import ModelScenarioWorkbench from '../components/dashboard/ModelScenarioWorkbench';
import { StatusChip } from '../components/ui/status-chip';
import type { RTROptimizerStateLike, RTROptimizerUiStateLike } from '../components/RTROptimizerPanel';
import type {
  CropType,
  RtrOptimizationMode,
  RtrProfile,
  SensorData,
  TelemetryStatus,
  TemperatureSettings,
  WeatherOutlook,
} from '../types';

const RTROptimizerPanel = lazy(() => import('../components/RTROptimizerPanel'));

interface ScenariosRoutePageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  currentData: SensorData;
  history: SensorData[];
  telemetryStatus?: TelemetryStatus;
  temperatureSettings: TemperatureSettings;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  profile: RtrProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  optimizerEnabled?: boolean;
  defaultMode?: RtrOptimizationMode;
  onRefreshProfiles?: () => void | Promise<void>;
  optimizerState?: RTROptimizerStateLike;
  uiState?: RTROptimizerUiStateLike;
  tabs?: PageCanvasTab[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
}

export default function ScenariosRoutePage({
  locale,
  crop,
  currentData,
  history,
  telemetryStatus,
  temperatureSettings,
  weather,
  weatherLoading,
  weatherError,
  profile,
  profileLoading,
  profileError,
  optimizerEnabled,
  defaultMode,
  onRefreshProfiles,
  optimizerState,
  uiState,
  tabs = [],
  activeTabId,
  onSelectTab,
}: ScenariosRoutePageProps) {
  const location = useLocation();
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Scenarios',
        title: '온실 What-if 검토',
        description: '온도, CO2, 습도, 스크린 조정을 실제 모델 계산으로 비교하고 수량·에너지 변화를 확인합니다.',
        rtrLoading: 'RTR 시나리오 표면을 불러오는 중입니다...',
        heroTitle: '과정기반모델과 RTR 민감도를 같은 검토선에 배치',
        heroBody: '조정안 계산은 모델 런타임 API로, RTR 민감도는 최적화 API로 실행합니다. 개요 화면에는 요약만 두고 여기에서 전체 계산을 확인합니다.',
        model: '모델 조정안',
        modelBody: '온도·CO2·상대습도 변경을 What-if로 계산합니다.',
        rtr: 'RTR 민감도',
        rtrBody: '기준안과 최적안을 비교하고 편미분 기반 효과를 확인합니다.',
        telemetry: '현재 환경',
        optimizerOn: '최적화 활성',
        optimizerOff: '프로필 대기',
        profileReady: '프로필 연결',
        profilePending: '프로필 확인 중',
        profileError: '프로필 확인 필요',
      }
    : {
        eyebrow: 'Scenarios',
        title: 'Greenhouse what-if review',
        description: 'Compare temperature, CO2, humidity, and screen adjustments through model-backed yield and energy calculations.',
        rtrLoading: 'Loading RTR scenario surface...',
        heroTitle: 'Keep process-model and RTR sensitivity on the same review line',
        heroBody: 'Scenario adjustments call the model runtime API while RTR sensitivity uses the optimizer API. The full backend-backed surfaces stay here.',
        model: 'Model adjustment',
        modelBody: 'Calculate temperature, CO2, and RH what-if changes.',
        rtr: 'RTR sensitivity',
        rtrBody: 'Compare baseline and optimized strategy through marginal effects.',
        telemetry: 'Current climate',
        optimizerOn: 'Optimizer active',
        optimizerOff: 'Profile pending',
        profileReady: 'Profile connected',
        profilePending: 'Checking profile',
        profileError: 'Check profile',
      };

  useEffect(() => {
    const targetId = location.hash.replace(/^#/, '');
    if (!targetId) {
      return;
    }

    const scheduleFrame = window.requestAnimationFrame
      ?? ((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0));
    const cancelFrame = window.cancelAnimationFrame ?? window.clearTimeout;
    const frame = scheduleFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) {
        return;
      }
      target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    });

    return () => cancelFrame(frame);
  }, [location.hash]);

  return (
    <PageCanvas
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      tabs={tabs}
      activeTabId={activeTabId}
      onSelectTab={onSelectTab}
    >
      <DashboardCard
        variant="hero"
        eyebrow={locale === 'ko' ? 'SCENARIO WORKSPACE' : 'SCENARIO WORKSPACE'}
        title={copy.heroTitle}
        description={copy.heroBody}
        actions={(
          <div className="flex flex-wrap gap-2">
            <StatusChip tone={optimizerEnabled ? 'growth' : 'warning'}>
              {optimizerEnabled ? copy.optimizerOn : copy.optimizerOff}
            </StatusChip>
            <StatusChip tone={profileError ? 'warning' : profileLoading ? 'muted' : 'stable'}>
              {profileError ? copy.profileError : profileLoading ? copy.profilePending : copy.profileReady}
            </StatusChip>
          </div>
        )}
      >
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.82fr]">
          <ScenarioSurfaceCard
            href="#scenario-model"
            Icon={Calculator}
            label={copy.model}
            body={copy.modelBody}
            meta="/api/models/scenario"
            tone="sage"
          />
          <ScenarioSurfaceCard
            href="#scenario-rtr"
            Icon={CircleGauge}
            label={copy.rtr}
            body={copy.rtrBody}
            meta="/api/rtr/sensitivity"
            tone="tomato"
          />
          <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="sg-eyebrow">{copy.telemetry}</p>
              <Activity className="h-5 w-5 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-surface-warm)] px-2 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--sg-text-faint)]">Temp</dt>
                <dd className="mt-1 font-mono text-sm font-bold text-[color:var(--sg-text-strong)]">{currentData.temperature.toFixed(1)}°C</dd>
              </div>
              <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-surface-warm)] px-2 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--sg-text-faint)]">CO2</dt>
                <dd className="mt-1 font-mono text-sm font-bold text-[color:var(--sg-text-strong)]">{Math.round(currentData.co2)}ppm</dd>
              </div>
              <div className="rounded-[var(--sg-radius-md)] bg-[color:var(--sg-surface-warm)] px-2 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--sg-text-faint)]">RH</dt>
                <dd className="mt-1 font-mono text-sm font-bold text-[color:var(--sg-text-strong)]">{Math.round(currentData.humidity)}%</dd>
              </div>
            </dl>
          </article>
        </div>
      </DashboardCard>
      <section id="scenario-model" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <ModelScenarioWorkbench crop={crop} />
      </section>
      <section id="scenario-rtr" tabIndex={-1} className="scroll-mt-24 focus:outline-none">
        <Suspense
          fallback={(
            <LoadingSkeleton
              title="RTR Scenario"
              loadingMessage={copy.rtrLoading}
              minHeightClassName="min-h-[420px]"
            />
          )}
        >
          <RTROptimizerPanel
            key={`scenarios-${crop}`}
            crop={crop}
            currentData={currentData}
            history={history}
            telemetryStatus={telemetryStatus}
            temperatureSettings={temperatureSettings}
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            profile={profile}
            profileLoading={profileLoading}
            profileError={profileError}
            optimizerEnabled={optimizerEnabled}
            defaultMode={defaultMode}
            onRefreshProfiles={onRefreshProfiles}
            optimizerState={optimizerState}
            uiState={uiState}
          />
        </Suspense>
      </section>
    </PageCanvas>
  );
}

function ScenarioSurfaceCard({
  href,
  Icon,
  label,
  body,
  meta,
  tone,
}: {
  href: string;
  Icon: LucideIcon;
  label: string;
  body: string;
  meta: string;
  tone: 'sage' | 'tomato';
}) {
  const iconClass = tone === 'tomato'
    ? 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]'
    : 'bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-success)]';

  return (
    <a
      href={href}
      className="sg-panel block bg-[color:var(--sg-surface-raised)] px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-[var(--sg-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="sg-eyebrow">{meta}</p>
          <h3 className="mt-2 text-base font-bold text-[color:var(--sg-text-strong)]">{label}</h3>
        </div>
        <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sg-radius-md)] ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--sg-text-muted)]">{body}</p>
    </a>
  );
}
