import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import ModelScenarioWorkbench from '../components/dashboard/ModelScenarioWorkbench';
import type {
  CropType,
  RtrOptimizationMode,
  RtrProfile,
  SensorData,
  TelemetryStatus,
  TemperatureSettings,
  WeatherOutlook,
} from '../types';
import type { RTROptimizerStateLike, RTROptimizerUiStateLike } from '../components/RTROptimizerPanel';

interface ScenariosRoutePageProps {
  locale: 'ko' | 'en';
  crop: CropType;
  /**
   * RTR strategy now lives only on /rtr, so these stay accepted for the current
   * call site but no longer render a second optimizer surface here.
   */
  currentData?: SensorData;
  history?: SensorData[];
  telemetryStatus?: TelemetryStatus;
  temperatureSettings?: TemperatureSettings;
  weather?: WeatherOutlook | null;
  weatherLoading?: boolean;
  weatherError?: string | null;
  profile?: RtrProfile | null;
  profileLoading?: boolean;
  profileError?: string | null;
  optimizerEnabled?: boolean;
  defaultMode?: RtrOptimizationMode;
  onRefreshProfiles?: () => void | Promise<void>;
  optimizerState?: RTROptimizerStateLike;
  uiState?: RTROptimizerUiStateLike;
}

export default function ScenariosRoutePage({
  locale,
  crop,
}: ScenariosRoutePageProps) {
  const location = useLocation();
  const copy = locale === 'ko'
    ? {
        eyebrow: '시나리오',
        title: '시나리오 비교',
        description: '설정을 바꾸면 수량과 에너지가 어떻게 달라지는지 기준안과 비교해 계산합니다.',
        rtrTitle: 'RTR 전략 비교는 RTR 최적화 화면에서',
        rtrBody: 'RTR(주야간 평균온도 전략) 기준안·최적안 비교와 민감도는 RTR 최적화 화면 한곳에서 봅니다.',
        rtrLink: 'RTR 최적화 열기',
      }
    : {
        eyebrow: 'Scenarios',
        title: 'Scenario comparison',
        description: 'Compare a candidate setting against the baseline and see how yield and energy respond.',
        rtrTitle: 'RTR strategy comparison lives on the RTR screen',
        rtrBody: 'Baseline and optimized RTR comparison and its sensitivity views are kept together on the RTR optimization screen.',
        rtrLink: 'Open RTR optimization',
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
    <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-6">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <section id="scenario-model" tabIndex={-1} className="min-w-0 scroll-mt-24 focus:outline-none">
        <ModelScenarioWorkbench crop={crop} />
      </section>
      <section id="scenario-rtr" tabIndex={-1} className="min-w-0 scroll-mt-24 focus:outline-none">
        <div className="sg-panel bg-white p-4">
          <h2 className="text-base font-bold text-[color:var(--sg-text-strong)]">{copy.rtrTitle}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[color:var(--sg-text-muted)]">{copy.rtrBody}</p>
          <Link
            to="/rtr"
            className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary)] px-3.5 text-xs font-bold text-white transition hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2"
          >
            {copy.rtrLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
