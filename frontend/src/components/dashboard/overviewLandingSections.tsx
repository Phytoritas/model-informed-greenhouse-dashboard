import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import greenhouseHero from '../../assets/overview-greenhouse-hero.jpg';
import {
  ArrowRight,
  BookOpen,
  CloudSun,
  Droplets,
  Fan,
  Leaf,
  Mail,
  MessageCircle,
  ShieldAlert,
  Sprout,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { KpiTileData } from '../KpiStrip';
import type {
  AdvancedModelMetrics,
  CropType,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../../types';
import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import { API_URL } from '../../config';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatMetricValue } from '../../utils/formatValue';
import { getCropLabel } from '../../utils/displayCopy';
import { selectProduceItemForCrop } from '../../utils/producePriceSelectors';
import { buildRTRLiveSnapshot, getRtrProfile } from '../../utils/rtr';
import { cn } from '../../utils/cn';
import { AlertCard } from '../ui/alert-card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { MetricCard } from '../ui/metric-card';
import { StatusChip } from '../ui/status-chip';

function formatNumber(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function compactTrendLabel(label: string | null | undefined): string | undefined {
  if (!label) {
    return undefined;
  }
  return label
    .replace(/^1h 변화\s*/, '')
    .replace(/^1h change\s*/i, '')
    .replace(/^최근 변화\s*/, '')
    .replace(/µmol m⁻² s⁻¹/g, 'PAR')
    .replace(/mol H₂O m⁻² s⁻¹/g, 'mol')
    .trim();
}

function compactMetricUnit(unit: string | undefined): string | undefined {
  if (!unit) {
    return undefined;
  }
  if (unit.includes('µmol')) {
    return 'PAR';
  }
  if (unit.includes('mol H₂O')) {
    return 'mol';
  }
  return unit;
}

function metricToneForTile(tile: KpiTileData): 'normal' | 'warning' | 'critical' | 'muted' {
  if (tile.availabilityState === 'missing') {
    return 'muted';
  }
  if (tile.availabilityState === 'offline') {
    return 'critical';
  }
  if (tile.availabilityState === 'delayed' || tile.availabilityState === 'stale') {
    return 'warning';
  }
  return tile.healthStatus === 'critical'
    ? 'critical'
    : tile.healthStatus === 'warning'
      ? 'warning'
      : 'normal';
}

const bridgeBodyClampStyle: CSSProperties = {
  display: '-webkit-box',
  overflow: 'hidden',
  WebkitBoxOrient: 'vertical',
  WebkitLineClamp: 2,
};

function LandingSectionHeading({
  eyebrow,
  title,
  description,
  titleId,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  titleId: string;
  actions?: ReactNode;
}) {
  return (
    <div className="overview-section-heading">
      <div className="min-w-0">
        <p className="sg-eyebrow">{eyebrow}</p>
        <h2 id={titleId}>{title}</h2>
        {description ? <p className="mt-0.5 max-w-2xl text-[0.7rem] leading-4 text-[color:var(--sg-text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

interface TopNavigationProps {
  onOpenAssistant: () => void;
}

export function TopNavigation({ onOpenAssistant }: TopNavigationProps) {
  const { locale } = useLocale();
  const location = useLocation();
  const nav = [
    ['HOME', '/overview'],
    ['DASHBOARD', '/overview#overview-dashboard'],
    ['INSIGHTS', '/trend'],
    ['SCENARIOS', '/scenarios'],
    ['KNOWLEDGE', '/assistant#assistant-search'],
    ['CONTACT', '/settings'],
  ];
  const assistantLabel = locale === 'ko' ? '질문하기' : 'Ask Assistant';
  const dashboardLabel = locale === 'ko' ? '대시보드 열기' : 'Open Dashboard';
  const isActiveNav = (to: string) => {
    const [pathname, hash = ''] = to.split('#');
    if (pathname !== location.pathname && !(pathname === '/overview' && location.pathname === '/')) {
      return false;
    }
    if (!hash) {
      return !location.hash || location.hash === '#overview-core';
    }
    if (pathname !== '/overview' && location.pathname === pathname) {
      return true;
    }
    return location.hash === `#${hash}`;
  };

  return (
    <header>
      <nav aria-label={locale === 'ko' ? 'PhytoSync 랜딩 내비게이션' : 'PhytoSync landing navigation'} className="overview-nav">
        <Link to="/overview" className="inline-flex items-center gap-2 text-base font-bold text-[color:var(--sg-text-strong)]">
          <Leaf className="h-5 w-5 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
          PhytoSync
        </Link>
        <div className="overview-nav-links">
          {nav.map(([label, to]) => {
            const active = isActiveNav(to);
            return (
            <Link
              key={label}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'overview-nav-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]',
                active && 'overview-nav-link-active',
              )}
            >
              {label}
            </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label={assistantLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </button>
          <Link
            to="/overview#overview-dashboard"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary)] px-3.5 text-xs font-bold text-white shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2"
          >
            {dashboardLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function HeroDecisionBrief({ heroCard }: { heroCard: ReactNode }) {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        badge: '실시간 온실 의사결정',
        title: '스마트온실 인공지능 의사결정 플랫폼',
        support: '기후, 작물, 시세, 지식 신호를 한 화면에서 묶어 오늘의 의사결정을 더 빠르게 정리합니다.',
        primary: '대시보드 보기',
        secondary: '시나리오 검토',
      }
    : {
        badge: 'Live Greenhouse Intelligence',
        title: 'AI decision platform for smart greenhouses.',
        support: 'Unify climate, crop, market, and knowledge insight in one practical greenhouse command center.',
        primary: 'View Dashboard',
        secondary: 'Explore Scenarios',
      };

  return (
    <section id="overview-core" tabIndex={-1} className="overview-hero scroll-mt-24" aria-labelledby="landing-hero-title">
      <div className="overview-hero-copy">
        <StatusChip tone="growth" className="w-fit">{copy.badge}</StatusChip>
        <h1 id="landing-hero-title" className="mt-1.5 max-w-[12ch] text-[clamp(1.42rem,2vw,1.88rem)] font-bold leading-[1.04] text-[color:var(--sg-text-strong)]">
          {copy.title}
        </h1>
        <p className="mt-1.5 max-w-xl text-[0.76rem] leading-5 text-[color:var(--sg-text-muted)]">
          {copy.support}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          <Link className="inline-flex h-8 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary)] px-3.5 text-xs font-bold text-white shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2" to="/overview#overview-dashboard">
            {copy.primary}
          </Link>
          <Link className="inline-flex h-8 items-center justify-center rounded-[var(--sg-radius-sm)] border border-[color:var(--sg-color-primary)] bg-white px-3.5 text-xs font-bold text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2" to="/scenarios">
            {copy.secondary}
          </Link>
        </div>
      </div>
      <div className="overview-hero-visual">
        <img
          src={greenhouseHero}
          alt=""
          className="overview-greenhouse-backdrop"
          aria-hidden="true"
        />
        <div className="relative z-[2] flex h-full items-center justify-end">
          {heroCard}
        </div>
      </div>
    </section>
  );
}

export function LiveMetricStrip({ tiles, yieldOutlookKg }: { tiles: KpiTileData[]; yieldOutlookKg?: number | null }) {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Live Overview',
        title: '실시간 의사결정 지표',
        description: '센서 상태 기준',
        yield: '수확 전망',
        yieldDetail: '이번 주 예측',
        yieldUnit: 'kg/주',
      }
    : {
        eyebrow: 'Live Overview',
        title: 'Live decision metrics',
        description: 'Sensor freshness',
        yield: 'Yield Outlook',
        yieldDetail: 'weekly forecast',
        yieldUnit: 'kg/wk',
      };
  const compactTiles = tiles.slice(0, 6);
  const yieldValue = typeof yieldOutlookKg === 'number' && Number.isFinite(yieldOutlookKg)
    ? formatNumber(yieldOutlookKg, 1)
    : '-';
  const freshnessLabel = compactTiles.find((tile) => tile.lastReceived)?.lastReceived
    ?? compactTiles.find((tile) => tile.availabilityLabel)?.availabilityLabel
    ?? copy.description;

  return (
    <section id="live-overview" tabIndex={-1} className="scroll-mt-24 space-y-1.5" aria-label={copy.title}>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 id="live-metric-strip-title" className="sg-eyebrow">{copy.eyebrow}</h2>
        <span className="text-xs font-semibold text-[color:var(--sg-text-muted)]">{freshnessLabel}</span>
      </div>
      <div className="overview-metric-row">
        {compactTiles.map((tile) => {
          const isNumeric = typeof tile.value === 'number';
          const value = isNumeric ? formatMetricValue(Number(tile.value), tile.fractionDigits) : '-';
          const tone = metricToneForTile(tile);
          return (
            <MetricCard
              key={tile.key}
              label={tile.label}
              value={value}
              unit={isNumeric && tile.availabilityState !== 'missing' ? compactMetricUnit(tile.unit) : undefined}
              detail={tile.availabilityLabel}
              trend={tile.trend}
              trendLabel={compactTrendLabel(tile.trendDetail) || tile.availabilityLabel}
              icon={tile.icon}
              tone={tone}
            />
          );
        })}
        <MetricCard
          label={copy.yield}
          value={yieldValue}
          unit={yieldValue === '-' ? undefined : copy.yieldUnit}
          detail={copy.yieldDetail}
          trend="stable"
          trendLabel={copy.yieldDetail}
          icon={TrendingUp}
          tone={yieldValue === '-' ? 'muted' : 'normal'}
        />
      </div>
    </section>
  );
}

interface TodayActionBoardProps {
  crop: CropType;
  currentData: SensorData;
  modelMetrics: AdvancedModelMetrics;
  actionsNow: string[];
  actionsToday: string[];
  monitor: string[];
  onOpenRtr: () => void;
  onOpenAdvisor: () => void;
}

export function TodayActionBoard({
  crop,
  currentData,
  modelMetrics,
  actionsNow,
  actionsToday,
  monitor,
  onOpenRtr,
  onOpenAdvisor,
}: TodayActionBoardProps) {
  const { locale } = useLocale();
  const diseaseTone = currentData.humidity >= 85 || currentData.vpd < 0.65
    ? 'critical'
    : currentData.humidity >= 80 || currentData.vpd < 0.75
      ? 'warning'
      : 'normal';
  const vpdTone = currentData.vpd < 0.75 || currentData.vpd > 1.25 ? 'warning' : 'normal';
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Today Action Board',
        title: '오늘 바로 볼 조치',
        description: '환기, 관수, 병해 위험, RTR 시나리오를 행동 단위로 정리합니다.',
        ventilation: '환기 조정',
        irrigation: '관수 타이밍',
        disease: '병해 위험',
        rtr: 'RTR 시나리오',
        impact: '영향 큼',
        moderate: '확인 필요',
        recommended: '정상 범위',
        compare: '비교',
        details: '자세히',
        highRisk: '위험 높음',
        vpdFallback: `VPD ${formatNumber(currentData.vpd, 2)} kPa입니다. 증산 요구에 맞춰 환기 상태를 확인하세요.`,
        irrigationFallback: `토양수분은 ${formatNumber(currentData.soilMoisture, 1)}%입니다. 정오 전 다음 관수 창을 확인하세요.`,
        diseaseFallback: `RH ${formatNumber(currentData.humidity, 0)}%와 VPD ${formatNumber(currentData.vpd, 2)} kPa 기준으로 병해 감시 수준을 봅니다.`,
        rtrFallback: `예상 수확량은 주 ${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg입니다. 설정값 변경 전 RTR 목표 온도를 비교하세요.`,
      }
    : {
        eyebrow: 'Today Action Board',
        title: 'Actions worth checking today',
        description: 'Ventilation, irrigation, disease risk, and RTR scenario signals are grouped into action cards.',
        ventilation: 'Ventilation Adjustment',
        irrigation: 'Irrigation Timing',
        disease: 'Disease Risk',
        rtr: 'RTR Scenario',
        impact: 'High impact',
        moderate: 'Moderate',
        recommended: 'Recommended',
        compare: 'Compare',
        details: 'See Details',
        highRisk: 'High risk',
        vpdFallback: `VPD ${formatNumber(currentData.vpd, 2)} kPa. Keep ventilation aligned with transpiration demand.`,
        irrigationFallback: `Soil moisture is ${formatNumber(currentData.soilMoisture, 1)}%. Confirm the next irrigation window before midday.`,
        diseaseFallback: `RH ${formatNumber(currentData.humidity, 0)}% and VPD ${formatNumber(currentData.vpd, 2)} kPa define the disease watch level.`,
        rtrFallback: `Yield outlook ${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg/week. Compare RTR target temperature before changing setpoints.`,
      };

  return (
    <section id="today-action-board" tabIndex={-1} className="scroll-mt-24 space-y-1.5" aria-labelledby="today-action-board-title">
      <LandingSectionHeading titleId="today-action-board-title" eyebrow={copy.eyebrow} title={copy.title} />
      <div className="overview-card-row-4">
        <AlertCard
          icon={Fan}
          title={copy.ventilation}
          chip={vpdTone === 'warning' ? copy.impact : copy.recommended}
          tone={vpdTone}
          body={actionsNow[0] ?? copy.vpdFallback}
          meta={<FeedbackControls crop={crop} recommendationId="overview-ventilation-adjustment" />}
          actionLabel={copy.details}
          onAction={onOpenAdvisor}
        />
        <AlertCard
          icon={Droplets}
          title={copy.irrigation}
          chip={copy.moderate}
          tone="warning"
          body={actionsToday[0] ?? copy.irrigationFallback}
          meta={<FeedbackControls crop={crop} recommendationId="overview-irrigation-timing" />}
          actionLabel={copy.details}
          onAction={onOpenAdvisor}
        />
        <AlertCard
          icon={ShieldAlert}
          title={copy.disease}
          chip={diseaseTone === 'critical' ? copy.highRisk : diseaseTone === 'warning' ? copy.moderate : copy.recommended}
          tone={diseaseTone}
          body={monitor[0] ?? copy.diseaseFallback}
          meta={<FeedbackControls crop={crop} recommendationId="overview-disease-risk" />}
          actionLabel={copy.details}
          onAction={onOpenAdvisor}
        />
        <AlertCard
          icon={TrendingUp}
          title={copy.rtr}
          chip={copy.recommended}
          tone="normal"
          body={copy.rtrFallback}
          meta={<FeedbackControls crop={crop} recommendationId="overview-rtr-scenario" />}
          actionLabel={copy.compare}
          onAction={onOpenRtr}
        />
      </div>
    </section>
  );
}

function FeedbackControls({
  crop,
  recommendationId,
}: {
  crop: CropType;
  recommendationId: string;
}) {
  const { locale } = useLocale();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const copy = locale === 'ko'
    ? {
        useful: '도움됨',
        notUseful: '아쉬움',
        sent: '피드백 저장됨',
        error: '피드백 실패',
      }
    : {
        useful: 'Useful',
        notUseful: 'Not useful',
        sent: 'Feedback saved',
        error: 'Feedback failed',
      };

  const submit = async (feedback: 'up' | 'down') => {
    setStatus('sending');
    try {
      const response = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendation_id: recommendationId,
          feedback,
          crop: crop.toLowerCase(),
        }),
      });
      if (!response.ok) {
        throw new Error(response.statusText || 'feedback failed');
      }
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1" aria-live="polite">
      <button
        type="button"
        aria-label={copy.useful}
        title={copy.useful}
        onClick={() => { void submit('up'); }}
        disabled={status === 'sending'}
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-success)] disabled:opacity-60"
      >
        <ThumbsUp className="h-2.5 w-2.5" aria-hidden="true" />
        <span className="sr-only">{copy.useful}</span>
      </button>
      <button
        type="button"
        aria-label={copy.notUseful}
        title={copy.notUseful}
        onClick={() => { void submit('down'); }}
        disabled={status === 'sending'}
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] disabled:opacity-60"
      >
        <ThumbsDown className="h-2.5 w-2.5" aria-hidden="true" />
        <span className="sr-only">{copy.notUseful}</span>
      </button>
      {status === 'sent' ? <span className="text-[10px] font-semibold text-[color:var(--sg-color-success)]">{copy.sent}</span> : null}
      {status === 'error' ? <span className="text-[10px] font-semibold text-[color:var(--sg-color-primary)]">{copy.error}</span> : null}
    </div>
  );
}

interface ScenarioOptimizerPreviewProps {
  crop: CropType;
  currentData: SensorData;
  history: SensorData[];
  modelMetrics: AdvancedModelMetrics;
  rtrProfile?: RtrProfile | null;
  analyticsNode?: ReactNode;
  trendNode?: ReactNode;
}

export function ScenarioOptimizerPreview({
  crop,
  currentData,
  history,
  modelMetrics,
  rtrProfile = null,
  analyticsNode,
  trendNode,
}: ScenarioOptimizerPreviewProps) {
  const { locale } = useLocale();
  const snapshot = buildRTRLiveSnapshot(currentData, history.length ? history : [currentData], crop, rtrProfile);
  const effectiveProfile = getRtrProfile(crop, rtrProfile);
  const optimizerEnabled = effectiveProfile.optimizer?.enabled === true;
  const calibrationLabel = effectiveProfile.calibration.mode === 'fitted'
    ? (locale === 'ko' ? '보정됨' : 'Calibrated')
    : effectiveProfile.calibration.mode === 'insufficient-data'
      ? (locale === 'ko' ? '데이터 부족' : 'Needs data')
      : (locale === 'ko' ? '기본선' : 'Baseline');
  const balanceLabel = snapshot.balanceState === 'balanced'
    ? (locale === 'ko' ? '균형 범위' : 'Balanced')
    : snapshot.balanceState === 'warm-for-light'
      ? (locale === 'ko' ? '광량 대비 고온' : 'Warm for light')
      : (locale === 'ko' ? '광량 대비 저온' : 'Cool for light');
  const copy = locale === 'ko'
    ? {
        eyebrow: '시나리오 옵티마이저',
        title: '현재 상태와 RTR 기준 비교',
        description: '관측값과 RTR 프로파일 목표를 비교합니다. 실제 권장 제어 계산은 온실 환경 화면의 optimizer 결과를 사용합니다.',
        baseline: '현재 관측',
        optimized: 'RTR 기준',
        current: '센서 기반 현재 상태',
        recommended: optimizerEnabled ? '옵티마이저 실행 가능' : '프로파일 기반 목표',
        weeklyYield: '예상 주간 수확',
        targetReady: optimizerEnabled ? '옵티마이저 준비됨' : 'RTR 기준만 표시',
        meanTemp: '평균온도',
        rtrDelta: 'RTR 편차',
        radiation: '누적광량',
        calibration: '보정 상태',
        coverage: '범위',
        yieldUnit: 'kg/주',
      }
    : {
        eyebrow: 'Scenario Optimizer',
        title: 'Current state vs RTR guardrail',
        description: 'Compare observed conditions with RTR profile targets. Actual recommended control values come from the optimizer surface in Control.',
        baseline: 'Current observation',
        optimized: 'RTR guardrail',
        current: 'Sensor-based state',
        recommended: optimizerEnabled ? 'Optimizer available' : 'Profile target only',
        weeklyYield: 'Weekly yield outlook',
        targetReady: optimizerEnabled ? 'Optimizer ready' : 'RTR guardrail only',
        meanTemp: 'Mean temp',
        rtrDelta: 'RTR delta',
        radiation: 'Radiation sum',
        calibration: 'Calibration',
        coverage: 'coverage',
        yieldUnit: 'kg/wk',
      };

  const setpointRows = [
    { label: copy.meanTemp, baseline: `${formatNumber(snapshot.averageTempC, 1)}°C`, optimized: `${formatNumber(snapshot.targetTempC, 1)}°C` },
    { label: copy.rtrDelta, baseline: `${snapshot.deltaTempC >= 0 ? '+' : ''}${formatNumber(snapshot.deltaTempC, 1)}°C`, optimized: `±${formatNumber(effectiveProfile.toleranceC, 1)}°C` },
    { label: copy.radiation, baseline: `${formatNumber(snapshot.radiationSumMjM2D, 1)} MJ/m²`, optimized: `${formatNumber(effectiveProfile.slopeCPerMjM2, 2)}°C/MJ` },
    { label: copy.calibration, baseline: `${formatNumber(snapshot.coveragePct, 0)}% ${copy.coverage}`, optimized: `${calibrationLabel} · ${effectiveProfile.calibration.sampleDays} d` },
  ];
  const weeklyYieldLabel = `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} ${copy.yieldUnit}`;

  return (
    <section id="scenario-optimizer" tabIndex={-1} className="scroll-mt-24 space-y-0.5" aria-labelledby="scenario-optimizer-title">
      <LandingSectionHeading
        titleId="scenario-optimizer-title"
        eyebrow={copy.eyebrow}
        title={copy.title}
        actions={(
          <div className="flex items-center gap-2">
            <StatusChip tone={optimizerEnabled ? 'growth' : 'stable'}>{copy.targetReady}</StatusChip>
            <span className="hidden text-xs font-semibold text-[color:var(--sg-text-muted)] sm:inline">{balanceLabel}</span>
          </div>
        )}
      />
      <div className="grid gap-1 xl:grid-cols-12">
        <div className={cn('sg-panel p-1', trendNode ? 'xl:col-span-8' : 'xl:col-span-12')}>
          <div className="grid gap-1 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <ScenarioCard title={copy.baseline} subtitle={copy.current} rows={setpointRows.map((row) => [row.label, row.baseline])} badgeLabel={weeklyYieldLabel} badgeCaption={copy.weeklyYield} />
            <div className="hidden h-7 w-7 items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] md:flex">
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </div>
            <ScenarioCard title={copy.optimized} subtitle={copy.recommended} rows={setpointRows.map((row) => [row.label, row.optimized])} badgeLabel={balanceLabel} badgeCaption="RTR" emphasized />
          </div>
        </div>
        {trendNode ? <div className="xl:col-span-4">{trendNode}</div> : null}
        {analyticsNode ? <div className="overview-analytics-compact xl:col-span-12">{analyticsNode}</div> : null}
      </div>
    </section>
  );
}

function ScenarioCard({
  title,
  subtitle,
  rows,
  badgeLabel,
  badgeCaption,
  emphasized = false,
}: {
  title: string;
  subtitle: string;
  rows: Array<[string, string]>;
  badgeLabel: string;
  badgeCaption?: string;
  emphasized?: boolean;
}) {
  return (
    <article className={cn('rounded-[var(--sg-radius-sm)] border p-[0.34rem]', emphasized ? 'border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)]' : 'border-[color:var(--sg-outline-soft)] bg-white')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[0.72rem] font-bold text-[color:var(--sg-text-strong)]">{title}</h3>
          <p className="mt-0.5 text-[0.62rem] text-[color:var(--sg-text-muted)]">{subtitle}</p>
        </div>
        <div className="text-right">
          {badgeCaption ? <div className="text-[10px] font-semibold uppercase text-[color:var(--sg-text-faint)]">{badgeCaption}</div> : null}
          <div className="text-[0.72rem] font-bold text-[color:var(--sg-color-success)]">{badgeLabel}</div>
        </div>
      </div>
      <dl className="mt-0.5 grid grid-cols-2 gap-x-2 gap-y-0.5 md:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{label}</dt>
            <dd className="mt-0.5 text-[0.66rem] font-bold text-[color:var(--sg-text-strong)]">{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

interface WeatherMarketKnowledgeBridgeProps {
  crop: CropType;
  weather: WeatherOutlook | null;
  weatherLoading: boolean;
  weatherError: string | null;
  producePrices: ProducePricesPayload | null;
  produceLoading: boolean;
  produceError: string | null;
  knowledgeSummary: SmartGrowKnowledgeSummary | null;
  knowledgeLoading: boolean;
  knowledgeError: string | null;
  history: SensorData[];
  onOpenAssistant: () => void;
}

export function WeatherMarketKnowledgeBridge({
  crop,
  weather,
  weatherLoading,
  weatherError,
  producePrices,
  produceLoading,
  produceError,
  knowledgeSummary,
  knowledgeLoading,
  knowledgeError,
  history,
  onOpenAssistant,
}: WeatherMarketKnowledgeBridgeProps) {
  const { locale } = useLocale();
  const cropLabel = getCropLabel(crop, locale);
  const selectedMarket = selectProduceItemForCrop(producePrices, crop, {
    marketPreference: ['wholesale'],
    enforcePreferredVariant: true,
  });
  const latestLight = history.at(-1)?.light;
  const copy = locale === 'ko'
    ? {
        eyebrow: '날씨 · 시세 · 지식 연결',
        title: '외부 조건과 내부 판단 연결',
        description: '날씨, 도매 시세, 지식 허브를 한 묶음으로 확인합니다.',
        weather: '날씨 전망',
        market: '시세 인사이트',
        knowledge: '지식 허브',
        open: '열기',
        loading: '불러오는 중',
        error: '연결 확인 필요',
        ready: '준비됨',
        today: '오늘',
        tomorrow: '내일',
        rain: '강수',
        wind: '풍속',
        priceTrend: '가격 변동',
        currentPrice: '현재가',
        demand: '수요',
        strong: '강함',
        steady: '보통',
        newGuide: '새 가이드',
        readySurfaces: '준비 표면',
        livePar: '실시간 PAR',
        weatherFallback: '대구 실시간 날씨 전망은 backend weather service를 통해 연결됩니다.',
        marketFallback: '도매 시세 신호는 produce price hook을 통해 연결됩니다.',
        knowledgeFallback: '지식 상태는 SmartGrow advisory catalog를 통해 연결됩니다.',
        priceTrendUp: '가격 상승',
        marketContext: '시세 맥락',
        advisorySurfaces: '자문 표면',
        irradianceContext: '일사 맥락',
      }
    : {
        eyebrow: 'Weather · Market · Knowledge Bridge',
        title: 'Connect outside context to inside decisions',
        description: 'Weather, market, and knowledge surfaces remain linked to the existing live data flow.',
        weather: 'Weather Forecast',
        market: 'Market Insight',
        knowledge: 'Knowledge Hub',
        open: 'Open',
        loading: 'Loading',
        error: 'Check connection',
        ready: 'ready',
        today: 'Today',
        tomorrow: 'Tomorrow',
        rain: 'rain',
        wind: 'wind',
        priceTrend: 'Price trend',
        currentPrice: 'Current price',
        demand: 'Demand',
        strong: 'Strong',
        steady: 'Steady',
        newGuide: 'New Guide',
        readySurfaces: 'Ready surfaces',
        livePar: 'Live PAR',
        weatherFallback: 'Live Daegu weather outlook is connected through the backend weather service.',
        marketFallback: 'Wholesale market signal is connected through the produce price hook.',
        knowledgeFallback: 'Knowledge status is connected through the SmartGrow advisory catalog.',
        priceTrendUp: 'Price trend up',
        marketContext: 'Market context',
        advisorySurfaces: 'Advisory surfaces',
        irradianceContext: 'Irradiance context',
      };

  const weatherValue = weatherError
    ? copy.error
    : weatherLoading || !weather
      ? copy.loading
      : weather.current.weather_label || `${formatNumber(weather.current.temperature_c, 1)}°C`;
  const marketValue = produceError
    ? copy.error
    : produceLoading || !selectedMarket?.item
      ? (produceLoading ? copy.loading : cropLabel)
      : selectedMarket.item.display_name;
  const readySurfaceCount = knowledgeSummary?.surfaces.filter((surface) => surface.status === 'ready').length ?? 0;
  const knowledgeValue = knowledgeError
    ? copy.error
    : knowledgeLoading || !knowledgeSummary
      ? copy.loading
      : copy.newGuide;
  const weatherSupport = weatherError
    ? weatherError
    : weather
      ? `${formatNumber(weather.current.temperature_c, 1)}°C · ${copy.wind} ${formatNumber(weather.current.wind_speed_kmh, 1)} km/h`
      : copy.weatherFallback;
  const marketSupport = produceError
    ? produceError
    : selectedMarket?.item
      ? `${selectedMarket.item.current_price_krw.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')} KRW / ${selectedMarket.item.unit}`
      : locale === 'ko'
        ? `${cropLabel} 도매 시세 신호를 produce price hook에서 기다립니다.`
        : `${cropLabel} wholesale market signal is waiting on the produce price hook.`;
  const knowledgeSupport = knowledgeError
    ? knowledgeError
    : knowledgeSummary?.advisorySurfaceNames.slice(0, 3).join(', ') || copy.knowledgeFallback;
  const marketChip = selectedMarket?.item?.direction === 'up' ? copy.priceTrendUp : copy.marketContext;
  const knowledgeChipTone = knowledgeError ? 'warning' : 'growth';
  const marketChipTone = produceError ? 'warning' : 'growth';
  const weatherTone = weatherError ? 'warning' : 'normal';
  const todayWeather = weather?.daily?.[0] ?? null;
  const tomorrowWeather = weather?.daily?.[1] ?? null;
  const weatherRows = [
    todayWeather ? [
      copy.today,
      `${formatNumber(todayWeather.temperature_min_c, 0)}-${formatNumber(todayWeather.temperature_max_c, 0)}°C · ${formatNumber(todayWeather.precipitation_probability_max_pct, 0)}% ${copy.rain}`,
    ] as [string, string] : null,
    tomorrowWeather ? [
      copy.tomorrow,
      `${formatNumber(tomorrowWeather.temperature_min_c, 0)}-${formatNumber(tomorrowWeather.temperature_max_c, 0)}°C · ${formatNumber(tomorrowWeather.precipitation_probability_max_pct, 0)}% ${copy.rain}`,
    ] as [string, string] : null,
    typeof latestLight === 'number' && Number.isFinite(latestLight) ? [
      copy.livePar,
      `${formatNumber(latestLight, 0)} µmol m⁻² s⁻¹`,
    ] as [string, string] : null,
  ].filter((row): row is [string, string] => row !== null).slice(0, 2);
  const marketRows = selectedMarket?.item
    ? [
        [copy.currentPrice, `${selectedMarket.item.current_price_krw.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')} KRW`] as [string, string],
        [copy.priceTrend, `${selectedMarket.item.day_over_day_pct >= 0 ? '+' : ''}${formatNumber(selectedMarket.item.day_over_day_pct, 1)}%`] as [string, string],
        [copy.demand, selectedMarket.item.direction === 'up' ? copy.strong : copy.steady] as [string, string],
      ].slice(0, 2)
    : [];
  const knowledgeRows = knowledgeSummary
    ? [
        [copy.readySurfaces, `${readySurfaceCount}/${knowledgeSummary.surfaces.length}`] as [string, string],
        [copy.advisorySurfaces, knowledgeSummary.advisorySurfaceNames.slice(0, 2).join(', ') || copy.ready] as [string, string],
      ]
    : [];

  return (
    <section id="overview-bridge" tabIndex={-1} className="scroll-mt-24 space-y-1" aria-labelledby="weather-market-knowledge-title">
      <LandingSectionHeading titleId="weather-market-knowledge-title" eyebrow={copy.eyebrow} title={copy.title} />
      <div className="overview-card-row-3">
        <BridgeCard
          icon={CloudSun}
          title={copy.weather}
          value={weatherValue}
          body={weatherSupport}
          chip={copy.irradianceContext}
          chipTone={weatherTone}
          detailRows={weatherRows}
        />
        <BridgeCard
          icon={Sprout}
          title={copy.market}
          value={marketValue}
          body={marketSupport}
          chip={marketChip}
          chipTone={marketChipTone}
          detailRows={marketRows}
        />
        <BridgeCard
          icon={BookOpen}
          title={copy.knowledge}
          value={knowledgeValue}
          body={knowledgeSupport}
          chip={copy.advisorySurfaces}
          chipTone={knowledgeChipTone}
          detailRows={knowledgeRows}
          action={<Button variant="secondary" size="sm" onClick={onOpenAssistant}>{copy.open}</Button>}
        />
      </div>
    </section>
  );
}

function BridgeCard({
  title,
  value,
  body,
  chip,
  icon: Icon,
  action,
  chipTone = 'growth',
  detailRows = [],
  className,
}: {
  title: string;
  value: string;
  body: string;
  chip: string;
  icon: LucideIcon;
  action?: ReactNode;
  chipTone?: 'normal' | 'growth' | 'stable' | 'warning' | 'critical' | 'muted';
  detailRows?: Array<[string, string]>;
  className?: string;
}) {
  return (
    <article className={cn('sg-panel flex h-full min-h-[84px] flex-col gap-1 p-2', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.7rem] font-bold text-[color:var(--sg-text-strong)]">{title}</div>
          <div className="sg-data-number mt-0.5 text-[0.88rem] font-bold leading-none text-[color:var(--sg-text-strong)]">{value}</div>
        </div>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)]">
          <Icon className="h-3 w-3" aria-hidden="true" />
        </span>
      </div>
      <p className="text-[0.64rem] leading-[0.9rem] text-[color:var(--sg-text-muted)]" style={bridgeBodyClampStyle}>{body}</p>
      {detailRows.length ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-[color:var(--sg-outline-soft)] pt-1">
          {detailRows.map(([label, rowValue]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{label}</dt>
              <dd className="mt-0.5 text-[0.66rem] font-bold text-[color:var(--sg-text-strong)]">{rowValue}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
        <StatusChip tone={chipTone}>{chip}</StatusChip>
        {action}
      </div>
    </article>
  );
}

export function FinalCTA() {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        title: '한 플랫폼에서 더 나은 판단과 안정적인 수확을 만드세요.',
        support: '매일 온실 의사결정을 정리하는 PhytoSync 워크플로우를 시작하세요.',
        email: '업무 이메일',
        placeholder: '업무 이메일 입력',
        submit: '무료로 시작',
      }
    : {
        title: 'One platform. Better decisions. Stronger harvests.',
        support: 'Join growers who rely on PhytoSync every day.',
        email: 'Email',
        placeholder: 'Enter your work email',
        submit: 'Get Started Free',
      };

  return (
    <section id="contact" className="sg-panel grid gap-3 bg-[color:var(--sg-surface-warm)] p-3 md:grid-cols-[minmax(0,1fr)_minmax(300px,0.76fr)] md:items-center">
      <div className="flex items-center gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sg-radius-md)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
          <Wind className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-bold text-[color:var(--sg-text-strong)]">{copy.title}</h2>
          <p className="mt-0.5 text-xs text-[color:var(--sg-text-muted)]">{copy.support}</p>
        </div>
      </div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="overview-email">{copy.email}</label>
        <Input id="overview-email" type="email" aria-label={copy.email} placeholder={copy.placeholder} />
        <Button type="submit" variant="primary" className="shrink-0">{copy.submit}</Button>
      </form>
    </section>
  );
}

export function LandingFooter({ onOpenAssistant }: { onOpenAssistant: () => void }) {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        rights: '© 2026 PhytoSync. 모든 권리 보유.',
        support: '지원',
        status: '상태',
        contact: '문의',
      }
    : {
        rights: '© 2026 PhytoSync. All rights reserved.',
        support: 'Support',
        status: 'Status',
        contact: 'Contact',
      };

  return (
    <footer className="flex flex-col gap-2 border-t border-[color:var(--sg-outline-soft)] py-2 text-xs text-[color:var(--sg-text-muted)] md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2 font-semibold text-[color:var(--sg-text-strong)]">
        <Leaf className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
        PhytoSync
      </div>
      <div>{copy.rights}</div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onOpenAssistant} className="hover:text-[color:var(--sg-text-strong)]">{copy.support}</button>
        <a href="#overview-watch" className="hover:text-[color:var(--sg-text-strong)]">{copy.status}</a>
        <a href="mailto:contact@phytosync.local" className="inline-flex items-center gap-1 hover:text-[color:var(--sg-text-strong)]">
          <Mail className="h-3.5 w-3.5" aria-hidden="true" />
          {copy.contact}
        </a>
      </div>
    </footer>
  );
}
