import { Suspense, lazy, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import ModelScenarioWorkbench from '../components/dashboard/ModelScenarioWorkbench';
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
}: ScenariosRoutePageProps) {
  const location = useLocation();
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Scenarios',
        title: '시나리오 실험실',
        description: '과정기반모델 What-if와 RTR 시나리오·편미분을 별도 탭에서 실제 백엔드 계산으로 실행합니다.',
        rtrLoading: 'RTR 시나리오 표면을 불러오는 중입니다...',
      }
    : {
        eyebrow: 'Scenarios',
        title: 'Scenario Lab',
        description: 'Run process-model what-if scenarios and RTR scenario/sensitivity surfaces against the real backend.',
        rtrLoading: 'Loading RTR scenario surface...',
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
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
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
    </div>
  );
}
