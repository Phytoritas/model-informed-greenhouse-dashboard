import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Thermometer, Droplets, CloudFog, Sun, Sprout, MessageCircle, Activity, Leaf } from 'lucide-react';
import SensorCard from './components/SensorCard';
import ControlPanel from './components/ControlPanel';
import CropDetails from './components/CropDetails';
import { useGreenhouse } from './hooks/useGreenhouse';
import { useAiAssistant } from './hooks/useAiAssistant';
import { useProducePrices } from './hooks/useProducePrices';
import { useRtrProfiles } from './hooks/useRtrProfiles';
import { useWeatherOutlook } from './hooks/useWeatherOutlook';
import type { CropType } from './types';
import type { AppLocale } from './i18n/locale';
import { useLocale } from './i18n/LocaleProvider';
import {
  getCropLabel,
  getDashboardSensorCopy,
  getDevelopmentStageLabel,
  getIdealRanges,
  UNIT_LABELS,
} from './utils/displayCopy';

const AiAdvisor = lazy(() => import('./components/AiAdvisor'));
const Charts = lazy(() => import('./components/Charts'));
const ChatAssistant = lazy(() => import('./components/ChatAssistant'));
const ModelAnalytics = lazy(() => import('./components/ModelAnalytics'));
const ForecastPanel = lazy(() => import('./components/ForecastPanel'));
const ConsultingReport = lazy(() => import('./components/ConsultingReport'));
const WeatherOutlookPanel = lazy(() => import('./components/WeatherOutlookPanel'));
const ProducePricesPanel = lazy(() => import('./components/ProducePricesPanel'));
const RTROutlookPanel = lazy(() => import('./components/RTROutlookPanel'));

interface LoadingPanelProps {
  title: string;
  loadingMessage: string;
  minHeightClassName?: string;
  className?: string;
}

const LoadingPanel = ({
  title,
  loadingMessage,
  minHeightClassName = 'min-h-[240px]',
  className = '',
}: LoadingPanelProps) => (
  <div className={`rounded-xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse ${minHeightClassName} ${className}`.trim()}>
    <div className="h-5 w-40 rounded bg-slate-200" />
    <p className="mt-4 text-sm font-medium text-slate-500">{title}</p>
    <div className="mt-4 space-y-3">
      <div className="h-3 rounded bg-slate-100" />
      <div className="h-3 w-11/12 rounded bg-slate-100" />
      <div className="h-3 w-4/5 rounded bg-slate-100" />
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3">
      <div className="h-24 rounded-lg bg-slate-100" />
      <div className="h-24 rounded-lg bg-slate-100" />
    </div>
    <p className="mt-4 text-xs text-slate-400">{loadingMessage}</p>
  </div>
);

const AiAdvisorFallback = () => (
  <div className="h-full rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-sm animate-pulse">
    <div className="h-5 w-28 rounded bg-white/20" />
    <div className="mt-4 rounded-lg bg-white/10 p-4">
      <div className="space-y-3">
        <div className="h-3 rounded bg-white/20" />
        <div className="h-3 w-11/12 rounded bg-white/20" />
        <div className="h-3 w-3/4 rounded bg-white/20" />
      </div>
    </div>
  </div>
);

interface ChatAssistantFallbackProps {
  onClose: () => void;
  locale: AppLocale;
}

const CHAT_ASSISTANT_FALLBACK_COPY = {
  en: {
    title: 'Assistant',
    close: 'Close',
    loading: 'Loading AI assistant...',
  },
  ko: {
    title: '어시스턴트',
    close: '닫기',
    loading: 'AI 어시스턴트를 불러오는 중...',
  },
} as const;

const APP_COPY = {
  en: {
    brandTagline: 'Intelligent Greenhouse Decision Support',
    systemOnline: 'System Online',
    askAiAssistant: 'Ask AI Assistant',
    language: 'Language',
    advancedModelAnalytics: 'Advanced Model Analytics',
    yieldForecast: 'Yield Forecast',
    consultingReport: 'Consulting Report',
    realTimeEnvironmentalAnalysis: 'Real-time Environmental Analysis',
    cropStatus: 'Crop Status',
    growthCycle: 'Growth Cycle',
    since: 'since',
    simTime: 'Sim Time',
    liveProducePrices: 'Live Produce Prices',
    daeguLiveWeather: 'Daegu Live Weather',
    rtrStrategy: 'RTR Strategy',
    advancedModelAnalyticsLoading: 'Advanced Model Analytics module loading...',
    yieldForecastLoading: 'Yield Forecast module loading...',
    consultingReportLoading: 'Consulting Report module loading...',
    realTimeEnvironmentalAnalysisLoading: 'Real-time Environmental Analysis module loading...',
    liveProducePricesLoading: 'Live Produce Prices module loading...',
    daeguLiveWeatherLoading: 'Daegu Live Weather module loading...',
    rtrStrategyLoading: 'RTR Strategy module loading...',
  },
  ko: {
    brandTagline: '스마트 온실 의사결정 지원',
    systemOnline: '시스템 정상',
    askAiAssistant: 'AI 어시스턴트',
    language: '언어',
    advancedModelAnalytics: '고급 모델 분석',
    yieldForecast: '수확 전망',
    consultingReport: '컨설팅 리포트',
    realTimeEnvironmentalAnalysis: '실시간 환경 분석',
    cropStatus: '작물 상태',
    growthCycle: '생육 사이클',
    since: '시작일',
    simTime: '시뮬레이션 시각',
    liveProducePrices: '실시간 농산물 가격',
    daeguLiveWeather: '대구 실시간 날씨',
    rtrStrategy: 'RTR 전략',
    advancedModelAnalyticsLoading: '고급 모델 분석 모듈을 불러오는 중...',
    yieldForecastLoading: '수확 전망 모듈을 불러오는 중...',
    consultingReportLoading: '컨설팅 리포트 모듈을 불러오는 중...',
    realTimeEnvironmentalAnalysisLoading: '실시간 환경 분석 모듈을 불러오는 중...',
    liveProducePricesLoading: '실시간 농산물 가격 모듈을 불러오는 중...',
    daeguLiveWeatherLoading: '대구 실시간 날씨 모듈을 불러오는 중...',
    rtrStrategyLoading: 'RTR 전략 모듈을 불러오는 중...',
  },
} as const;

const ChatAssistantFallback = ({ onClose, locale }: ChatAssistantFallbackProps) => {
  const copy = CHAT_ASSISTANT_FALLBACK_COPY[locale];

  return (
  <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
    <div className="flex items-center justify-between bg-slate-900 p-4 text-white">
      <span className="font-medium">{copy.title}</span>
      <button onClick={onClose} className="text-slate-300 hover:text-white">{copy.close}</button>
    </div>
    <div className="flex flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
      {copy.loading}
    </div>
  </div>
  );
};

const AUTO_ANALYSIS_INTERVAL_MS = 30 * 60 * 1000;

function App() {
  const { locale, setLocale } = useLocale();
  const copy = APP_COPY[locale];
  const sensorCopy = getDashboardSensorCopy(locale);
  const idealRanges = getIdealRanges(locale);
  const {
    currentData,
    modelMetrics,
    history,
    metricHistory,
    forecast,
    controls,
    toggleControl,
    setControlValue,
    selectedCrop,
    setSelectedCrop,
    setTempSettings,
    growthDay,
    startDateLabel,
    currentDateLabel
  } = useGreenhouse();

  const {
    aiAnalysis,
    isAnalyzing,
    analyzeData
  } = useAiAssistant();
  const {
    weather,
    loading: isWeatherLoading,
    error: weatherError,
  } = useWeatherOutlook();
  const {
    prices: producePrices,
    loading: isProducePricesLoading,
    error: producePricesError,
  } = useProducePrices();
  const {
    profiles: rtrProfilesPayload,
    loading: isRtrProfileLoading,
    error: rtrProfileError,
  } = useRtrProfiles();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [shouldRenderChat, setShouldRenderChat] = useState(false);
  const lastAutoAnalysisAtRef = useRef<Record<CropType, number>>({
    Tomato: 0,
    Cucumber: 0,
  });
  const deferredHistory = useDeferredValue(history);
  const deferredMetricHistory = useDeferredValue(metricHistory);
  const deferredForecast = useDeferredValue(forecast);
  const deferredModelMetrics = useDeferredValue(modelMetrics);
  const activeRtrDivider =
    rtrProfilesPayload?.profiles[selectedCrop]?.lightToRadiantDivisor ?? 4.57;

  const handleChatToggle = () => {
    if (!shouldRenderChat) {
      setShouldRenderChat(true);
    }
    setIsChatOpen((prev) => !prev);
  };

  // Trigger analysis
  const handleAnalyze = useCallback(() => {
    analyzeData(
      currentData,
      modelMetrics,
      selectedCrop,
      history,
      forecast,
      weather,
      rtrProfilesPayload?.profiles[selectedCrop] ?? null,
      (recommendations) => {
      // Auto-adjust controls simulation based on AI advice
      if (recommendations.some(r => r.toLowerCase().includes('vent'))) {
        setControlValue('ventilation', true);
      }
    });
  }, [
    analyzeData,
    currentData,
    forecast,
    history,
    modelMetrics,
    rtrProfilesPayload,
    selectedCrop,
    setControlValue,
    weather,
  ]);

  // Auto analysis when actual data has arrived for the selected crop.
  useEffect(() => {
    const latestTimestamp = history[history.length - 1]?.timestamp
      ?? (history.length === 0 && currentData.temperature !== 0 ? currentData.timestamp : 0);

    if (!latestTimestamp) {
      return;
    }

    const lastAutoTs = lastAutoAnalysisAtRef.current[selectedCrop];
    const shouldAnalyze = lastAutoTs === 0 || latestTimestamp - lastAutoTs >= AUTO_ANALYSIS_INTERVAL_MS;
    if (!shouldAnalyze) {
      return;
    }

    const timer = setTimeout(() => {
      lastAutoAnalysisAtRef.current[selectedCrop] = latestTimestamp;
      handleAnalyze();
    }, 1000);

    return () => clearTimeout(timer);
  }, [currentData.temperature, currentData.timestamp, handleAnalyze, history, selectedCrop]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-green-600 p-2 rounded-lg shadow-lg shadow-green-200">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">SmartGrow <span className="text-green-600">AI</span></h1>
              <p className="text-xs text-slate-400 hidden sm:block">{copy.brandTagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1 sm:flex">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{copy.language}</span>
              <div className="flex rounded-md bg-slate-100 p-1">
                {(['en', 'ko'] as AppLocale[]).map((targetLocale) => (
                  <button
                    key={targetLocale}
                    onClick={() => setLocale(targetLocale)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                      locale === targetLocale
                        ? 'bg-white text-green-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {targetLocale === 'en' ? 'EN' : '한국어'}
                  </button>
                ))}
              </div>
            </div>
            {/* Crop Selector */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['Cucumber', 'Tomato'] as CropType[]).map((crop) => (
                <button
                  key={crop}
                  onClick={() => setSelectedCrop(crop)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${selectedCrop === crop
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {getCropLabel(crop, locale)}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              {copy.systemOnline}
            </div>
            <button
              onClick={handleChatToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-medium ${isChatOpen ? 'bg-green-100 text-green-700' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
              <MessageCircle className="w-5 h-5" />
              <span>{copy.askAiAssistant}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1720px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Section: Stats & AI */}
        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.95fr)]">
            {/* Sensor Grid */}
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SensorCard
                title={sensorCopy.temperature.title}
                value={currentData.temperature}
                unit={sensorCopy.temperature.unit}
                icon={Thermometer}
                color="bg-orange-500"
                trend={currentData.temperature > 28 ? 'up' : 'stable'}
                idealRange={idealRanges[selectedCrop].temperature}
              />
              <SensorCard
                title={sensorCopy.humidity.title}
                value={currentData.humidity}
                unit={sensorCopy.humidity.unit}
                icon={Droplets}
                color="bg-blue-500"
                trend={currentData.humidity > 80 ? 'up' : 'stable'}
                idealRange={idealRanges[selectedCrop].humidity}
              />
              <SensorCard
                title={sensorCopy.carbonDioxide.title}
                value={currentData.co2}
                unit={sensorCopy.carbonDioxide.unit}
                icon={CloudFog}
                color="bg-slate-600"
                trend="stable"
                idealRange="400-800 ppm"
              />
              <SensorCard
                title={sensorCopy.light.title}
                value={currentData.light}
                unit={sensorCopy.light.unit}
                subValue={`~ ${(currentData.light / activeRtrDivider).toFixed(1)} ${UNIT_LABELS.radiativeFlux}`}
                icon={Sun}
                color="bg-yellow-500"
                trend={currentData.light > 1000 ? 'up' : 'down'}
                idealRange={idealRanges[selectedCrop].light}
              />
              <SensorCard
                title={sensorCopy.vpd.title}
                value={currentData.vpd}
                unit={sensorCopy.vpd.unit}
                icon={Activity}
                color="bg-purple-500"
                trend={currentData.vpd > 1.2 ? 'up' : 'stable'}
                idealRange={idealRanges[selectedCrop].vpd}
              />
              <SensorCard
                title={sensorCopy.stomatalConductance.title}
                value={currentData.stomatalConductance}
                unit={sensorCopy.stomatalConductance.unit}
                icon={Leaf}
                color="bg-green-500"
                trend="stable"
                idealRange={`> 0.3 ${UNIT_LABELS.stomatalConductance}`}
              />
            </div>

            {/* AI Advisor */}
            <div className="min-h-[360px] xl:min-h-[420px]">
              <Suspense fallback={<AiAdvisorFallback />}>
                <AiAdvisor
                  analysis={aiAnalysis}
                  isLoading={isAnalyzing}
                  onRefresh={handleAnalyze}
                />
              </Suspense>
            </div>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,1.55fr)_minmax(280px,1fr)]">
            <div className="h-full lg:col-span-2 xl:order-2 xl:col-span-1">
              <Suspense fallback={<LoadingPanel title={copy.liveProducePrices} loadingMessage={copy.liveProducePricesLoading} minHeightClassName="min-h-[420px]" className="h-full" />}>
                <ProducePricesPanel
                  prices={producePrices}
                  loading={isProducePricesLoading}
                  error={producePricesError}
                />
              </Suspense>
            </div>
            <div className="h-full xl:order-1">
              <Suspense fallback={<LoadingPanel title={copy.daeguLiveWeather} loadingMessage={copy.daeguLiveWeatherLoading} minHeightClassName="min-h-[420px]" className="h-full" />}>
                <WeatherOutlookPanel
                  weather={weather}
                  loading={isWeatherLoading}
                  error={weatherError}
                />
              </Suspense>
            </div>
            <div className="h-full xl:order-3">
              <Suspense fallback={<LoadingPanel title={copy.rtrStrategy} loadingMessage={copy.rtrStrategyLoading} minHeightClassName="min-h-[420px]" className="h-full" />}>
                <RTROutlookPanel
                  crop={selectedCrop}
                  currentData={currentData}
                  history={deferredHistory}
                  temperatureSettings={controls.settings}
                  weather={weather}
                  loading={isWeatherLoading}
                  error={weatherError}
                  profile={rtrProfilesPayload?.profiles[selectedCrop] ?? null}
                  profileLoading={isRtrProfileLoading}
                  profileError={rtrProfileError}
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Middle Section: Advanced SOTA Models */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-slate-500" />
            <h2 className="text-lg font-semibold text-slate-800">{copy.advancedModelAnalytics}: {getCropLabel(selectedCrop, locale)}</h2>
          </div>
          <Suspense fallback={<LoadingPanel title={copy.advancedModelAnalytics} loadingMessage={copy.advancedModelAnalyticsLoading} minHeightClassName="min-h-[320px]" />}>
            <ModelAnalytics
              crop={selectedCrop}
              metrics={deferredModelMetrics}
              metricHistory={deferredMetricHistory}
              forecast={deferredForecast}
            />
          </Suspense>
        </div>

        {/* Crop Operations & Details */}
        <div className="mb-8">
          <CropDetails
            crop={selectedCrop}
            currentData={currentData}
            metrics={modelMetrics}
          />
        </div>

        {/* Forecast Section (New) */}
        <div className="mb-8">
          <Suspense fallback={<LoadingPanel title={copy.yieldForecast} loadingMessage={copy.yieldForecastLoading} minHeightClassName="min-h-[280px]" />}>
            <ForecastPanel forecast={deferredForecast} crop={selectedCrop} />
          </Suspense>
        </div>

        {/* Consulting Report Section */}
        <div className="mb-8">
          <Suspense fallback={<LoadingPanel title={copy.consultingReport} loadingMessage={copy.consultingReportLoading} minHeightClassName="min-h-[320px]" />}>
            <ConsultingReport
              analysis={aiAnalysis}
              metrics={deferredModelMetrics}
              currentData={currentData}
              crop={selectedCrop}
            />
          </Suspense>
        </div>

        {/* Bottom Section: Charts & Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Suspense fallback={<LoadingPanel title={copy.realTimeEnvironmentalAnalysis} loadingMessage={copy.realTimeEnvironmentalAnalysisLoading} minHeightClassName="min-h-[540px]" />}>
              <Charts data={deferredHistory} />
            </Suspense>
          </div>
          <div className="lg:col-span-1">
            <ControlPanel
              status={controls}
              onToggle={toggleControl}
              onSettingsChange={setTempSettings}
            />

            {/* Status Summary Box */}
            <div className="mt-6 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <Leaf className="w-4 h-4 text-green-600" />
                  {copy.cropStatus}: {getCropLabel(selectedCrop, locale)}
                </h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  {getDevelopmentStageLabel(modelMetrics.growth.developmentStage, locale)}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '75%' }}></div>
              </div>
              <p className="text-xs text-slate-500 flex justify-between">
                <span>{copy.growthCycle}</span>
                <span>
                  {growthDay ? (locale === 'ko' ? `${growthDay}일차` : `Day ${growthDay}`) : '-'}
                  {startDateLabel ? ` (${copy.since} ${startDateLabel})` : ''}
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">{copy.simTime}: {currentDateLabel}</p>
            </div>
          </div>
        </div>
      </main>

      {shouldRenderChat ? (
        <Suspense fallback={<ChatAssistantFallback onClose={() => setIsChatOpen(false)} locale={locale} />}>
          <ChatAssistant
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            currentData={currentData}
            metrics={deferredModelMetrics}
            crop={selectedCrop}
            forecast={deferredForecast}
            history={deferredHistory}
            weather={weather}
            rtrProfile={rtrProfilesPayload?.profiles[selectedCrop] ?? null}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export default App;
