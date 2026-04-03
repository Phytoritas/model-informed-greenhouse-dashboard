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
import { DASHBOARD_SENSOR_COPY, IDEAL_RANGES, UNIT_LABELS } from './utils/displayCopy';

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
  minHeightClassName?: string;
  className?: string;
}

const LoadingPanel = ({
  title,
  minHeightClassName = 'min-h-[240px]',
  className = '',
}: LoadingPanelProps) => (
  <div className={`rounded-xl border border-slate-100 bg-white p-6 shadow-sm animate-pulse ${minHeightClassName} ${className}`.trim()}>
    <div className="h-5 w-40 rounded bg-slate-200" />
    <div className="mt-4 space-y-3">
      <div className="h-3 rounded bg-slate-100" />
      <div className="h-3 w-11/12 rounded bg-slate-100" />
      <div className="h-3 w-4/5 rounded bg-slate-100" />
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3">
      <div className="h-24 rounded-lg bg-slate-100" />
      <div className="h-24 rounded-lg bg-slate-100" />
    </div>
    <p className="mt-4 text-xs text-slate-400">{title} module loading...</p>
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
}

const ChatAssistantFallback = ({ onClose }: ChatAssistantFallbackProps) => (
  <div className="fixed bottom-6 right-6 z-50 flex h-[500px] w-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
    <div className="flex items-center justify-between bg-slate-900 p-4 text-white">
      <span className="font-medium">Assistant</span>
      <button onClick={onClose} className="text-slate-300 hover:text-white">Close</button>
    </div>
    <div className="flex flex-1 items-center justify-center bg-slate-50 text-sm text-slate-500">
      Loading AI assistant...
    </div>
  </div>
);

const AUTO_ANALYSIS_INTERVAL_MS = 30 * 60 * 1000;

function App() {
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
              <p className="text-xs text-slate-400 hidden sm:block">Intelligent Greenhouse Decision Support</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
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
                  {crop}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              System Online
            </div>
            <button
              onClick={handleChatToggle}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-medium ${isChatOpen ? 'bg-green-100 text-green-700' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
            >
              <MessageCircle className="w-5 h-5" />
              <span>Ask AI Assistant</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Section: Stats & AI */}
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)] gap-6 mb-8">
          {/* Sensor Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SensorCard
              title={DASHBOARD_SENSOR_COPY.temperature.title}
              value={currentData.temperature}
              unit={DASHBOARD_SENSOR_COPY.temperature.unit}
              icon={Thermometer}
              color="bg-orange-500"
              trend={currentData.temperature > 28 ? 'up' : 'stable'}
              idealRange={IDEAL_RANGES[selectedCrop].temperature}
            />
            <SensorCard
              title={DASHBOARD_SENSOR_COPY.humidity.title}
              value={currentData.humidity}
              unit={DASHBOARD_SENSOR_COPY.humidity.unit}
              icon={Droplets}
              color="bg-blue-500"
              trend={currentData.humidity > 80 ? 'up' : 'stable'}
              idealRange={IDEAL_RANGES[selectedCrop].humidity}
            />
            <SensorCard
              title={DASHBOARD_SENSOR_COPY.carbonDioxide.title}
              value={currentData.co2}
              unit={DASHBOARD_SENSOR_COPY.carbonDioxide.unit}
              icon={CloudFog}
              color="bg-slate-600"
              trend="stable"
              idealRange="400-800 ppm"
            />
            <SensorCard
              title={DASHBOARD_SENSOR_COPY.light.title}
              value={currentData.light}
              unit={DASHBOARD_SENSOR_COPY.light.unit}
              subValue={`~ ${(currentData.light / activeRtrDivider).toFixed(1)} ${UNIT_LABELS.radiativeFlux}`}
              icon={Sun}
              color="bg-yellow-500"
              trend={currentData.light > 1000 ? 'up' : 'down'}
              idealRange={IDEAL_RANGES[selectedCrop].light}
            />
            <SensorCard
              title={DASHBOARD_SENSOR_COPY.vpd.title}
              value={currentData.vpd}
              unit={DASHBOARD_SENSOR_COPY.vpd.unit}
              icon={Activity}
              color="bg-purple-500"
              trend={currentData.vpd > 1.2 ? 'up' : 'stable'}
              idealRange={IDEAL_RANGES[selectedCrop].vpd}
            />
            <SensorCard
              title={DASHBOARD_SENSOR_COPY.stomatalConductance.title}
              value={currentData.stomatalConductance}
              unit={DASHBOARD_SENSOR_COPY.stomatalConductance.unit}
              icon={Leaf}
              color="bg-green-500"
              trend="stable"
              idealRange={`> 0.3 ${UNIT_LABELS.stomatalConductance}`}
            />
          </div>

          {/* AI Advisor */}
          <div className="flex flex-col gap-6">
            <Suspense fallback={<AiAdvisorFallback />}>
              <AiAdvisor
                analysis={aiAnalysis}
                isLoading={isAnalyzing}
                onRefresh={handleAnalyze}
              />
            </Suspense>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
              <Suspense fallback={<LoadingPanel title="Daegu Live Weather" minHeightClassName="min-h-[320px]" />}>
                <WeatherOutlookPanel
                  weather={weather}
                  loading={isWeatherLoading}
                  error={weatherError}
                />
              </Suspense>
              <Suspense fallback={<LoadingPanel title="Live Produce Prices" minHeightClassName="min-h-[320px]" />}>
                <ProducePricesPanel
                  prices={producePrices}
                  loading={isProducePricesLoading}
                  error={producePricesError}
                />
              </Suspense>
              <Suspense fallback={<LoadingPanel title="RTR Strategy" minHeightClassName="min-h-[320px]" />}>
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
            <h2 className="text-lg font-semibold text-slate-800">Advanced Model Analytics: {selectedCrop}</h2>
          </div>
          <Suspense fallback={<LoadingPanel title="Advanced Model Analytics" minHeightClassName="min-h-[320px]" />}>
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
          <Suspense fallback={<LoadingPanel title="Yield Forecast" minHeightClassName="min-h-[280px]" />}>
            <ForecastPanel forecast={deferredForecast} crop={selectedCrop} />
          </Suspense>
        </div>

        {/* Consulting Report Section */}
        <div className="mb-8">
          <Suspense fallback={<LoadingPanel title="Consulting Report" minHeightClassName="min-h-[320px]" />}>
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
            <Suspense fallback={<LoadingPanel title="Real-time Environmental Analysis" minHeightClassName="min-h-[540px]" />}>
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
                  Crop Status: {selectedCrop}
                </h4>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                  {modelMetrics.growth.developmentStage}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: '75%' }}></div>
              </div>
              <p className="text-xs text-slate-500 flex justify-between">
                <span>Growth Cycle</span>
                <span>
                  {growthDay ? `Day ${growthDay}` : '-'}
                  {startDateLabel ? ` (since ${startDateLabel})` : ''}
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Sim Time: {currentDateLabel}</p>
            </div>
          </div>
        </div>
      </main>

      {shouldRenderChat ? (
        <Suspense fallback={<ChatAssistantFallback onClose={() => setIsChatOpen(false)} />}>
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
