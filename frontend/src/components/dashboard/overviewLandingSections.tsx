import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import greenhouseHero from '../../assets/overview-greenhouse-hero.jpg';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  CloudSun,
  Droplets,
  Fan,
  Leaf,
  Mail,
  ShieldAlert,
  Sprout,
  Thermometer,
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
import { metricToneForTile } from '../../utils/metricTone';
import { AlertCard } from '../ui/alert-card';
import { Button } from '../ui/button';
import GlobalTopNav from '../shell/GlobalTopNav';
import { Input } from '../ui/input';
import { MetricCard } from '../ui/metric-card';
import { SectionHeader } from '../ui/section-header';
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
    <SectionHeader
      density="compact"
      eyebrow={eyebrow}
      title={title}
      description={description}
      titleId={titleId}
      actions={actions}
    />
  );
}

interface TopNavigationProps {
  onOpenAssistant: () => void;
}

export function TopNavigation({ onOpenAssistant }: TopNavigationProps) {
  return <GlobalTopNav onOpenAssistant={onOpenAssistant} activeKey="home" />;
}

export function HeroDecisionBrief({ heroCard }: { heroCard: ReactNode }) {
  const { locale } = useLocale();
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Command',
        badge: '실시간 온실 의사결정',
        title: '스마트온실 인공지능 의사결정 플랫폼',
        support: '기후, 작물, 시세, 지식 신호를 한 화면에서 묶어 오늘의 의사결정을 더 빠르게 정리합니다.',
        primary: '대시보드 보기',
        secondary: '시나리오 검토',
      }
    : {
        eyebrow: 'Command',
        badge: 'Live Greenhouse Intelligence',
        title: 'AI decision platform for smart greenhouses.',
        support: 'Unify climate, crop, market, and knowledge insight in one practical greenhouse command center.',
        primary: 'View Dashboard',
        secondary: 'Explore Scenarios',
      };

  return (
    <section id="overview-core" tabIndex={-1} className="overview-hero scroll-mt-24" aria-labelledby="landing-hero-title">
      <div className="overview-hero-copy">
        <p className="sg-eyebrow">{copy.eyebrow}</p>
        <StatusChip tone="growth" className="w-fit">{copy.badge}</StatusChip>
        <h1 id="landing-hero-title" className="mt-1.5 max-w-[12ch] text-[clamp(1.42rem,2vw,1.88rem)] font-bold leading-[1.04] text-[color:var(--sg-text-strong)]">
          {copy.title}
        </h1>
        <p className="mt-1.5 max-w-xl text-[0.76rem] leading-5 text-[color:var(--sg-text-muted)]">
          {copy.support}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2.5">
          <Link className="inline-flex h-8 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary)] px-3.5 text-xs font-bold text-white shadow-[var(--sg-shadow-card)] hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2" to="/control">
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
      <LandingSectionHeading
        titleId="live-metric-strip-title"
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={<StatusChip tone="stable">{freshnessLabel}</StatusChip>}
      />
      <OverviewMetricDeck
        tiles={compactTiles}
        yieldOutlook={{
          label: copy.yield,
          value: yieldValue,
          unit: yieldValue === '-' ? undefined : copy.yieldUnit,
          detail: copy.yieldDetail,
        }}
      />
    </section>
  );
}

export function OverviewMetricDeck({
  tiles,
  yieldOutlook,
  className,
}: {
  tiles: KpiTileData[];
  yieldOutlook?: {
    label: string;
    value: string;
    unit?: string;
    detail: string;
  };
  className?: string;
}) {
  return (
    <div className={cn('overview-metric-row', className)} data-testid="overview-metric-deck">
      {tiles.map((tile) => {
        const isNumeric = typeof tile.value === 'number';
        const value = typeof tile.value === 'number'
          ? formatMetricValue(tile.value, tile.fractionDigits)
          : tile.value;
        const tone = metricToneForTile(tile);
        return (
          <MetricCard
            key={tile.key}
            label={tile.label}
            value={value}
            unit={isNumeric && tile.availabilityState !== 'missing' ? compactMetricUnit(tile.unit) : undefined}
            detail={tile.lastReceived ?? tile.availabilityLabel}
            trend={tile.trend}
            trendLabel={compactTrendLabel(tile.trendDetail) || tile.availabilityLabel}
            icon={tile.icon}
            tone={tone}
          />
        );
      })}
      {yieldOutlook ? (
        <MetricCard
          label={yieldOutlook.label}
          value={yieldOutlook.value}
          unit={yieldOutlook.unit}
          detail={yieldOutlook.detail}
          trend="stable"
          trendLabel={yieldOutlook.detail}
          icon={TrendingUp}
          tone={yieldOutlook.value === '-' ? 'muted' : 'stable'}
        />
      ) : null}
    </div>
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
  /** Current mean temp minus RTR target (°C). When provided, the RTR card shows a
   *  real verdict instead of the static fallback. */
  rtrDeltaC?: number;
  rtrToleranceC?: number;
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
  rtrDeltaC,
  rtrToleranceC,
}: TodayActionBoardProps) {
  const { locale } = useLocale();
  const diseaseTone = currentData.humidity >= 85 || currentData.vpd < 0.65
    ? 'critical'
    : currentData.humidity >= 80 || currentData.vpd < 0.75
      ? 'warning'
      : 'growth';
  const vpdTone = currentData.vpd < 0.75 || currentData.vpd > 1.25 ? 'warning' : 'growth';
  // RTR card verdict from the shared snapshot delta, when the parent supplies it.
  const rtrTol = rtrToleranceC ?? 1.0;
  const rtrKnown = typeof rtrDeltaC === 'number' && Number.isFinite(rtrDeltaC);
  const rtrWithin = rtrKnown ? Math.abs(rtrDeltaC as number) <= rtrTol : true;
  const rtrTone: 'growth' | 'warning' | 'stable' = rtrKnown && !rtrWithin ? 'warning' : rtrKnown ? 'growth' : 'stable';
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
        rtrWithinChip: '기준 범위',
        rtrOffChip: '조정 검토',
        vpdFallback: `VPD ${formatNumber(currentData.vpd, 2)} kPa입니다. 증산 요구에 맞춰 환기 상태를 확인하세요.`,
        irrigationFallback: `토양수분은 ${formatNumber(currentData.soilMoisture, 1)}%입니다. 정오 전 다음 관수 창을 확인하세요.`,
        diseaseFallback: `RH ${formatNumber(currentData.humidity, 0)}%와 VPD ${formatNumber(currentData.vpd, 2)} kPa 기준으로 병해 감시 수준을 봅니다.`,
        rtrFallback: `예상 수확량은 주 ${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg입니다. 설정값 변경 전 RTR 목표 온도를 비교하세요.`,
        rtrWithinBody: 'RTR 목표 범위 안입니다. 현재 온도 관리를 유지하세요.',
        rtrAboveBody: (d: string) => `RTR 목표보다 ${d}°C 높습니다. 환기·차광을 검토하세요.`,
        rtrBelowBody: (d: string) => `RTR 목표보다 ${d}°C 낮습니다. 난방·보온을 검토하세요.`,
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
        rtrWithinChip: 'Within band',
        rtrOffChip: 'Review setpoint',
        vpdFallback: `VPD ${formatNumber(currentData.vpd, 2)} kPa. Keep ventilation aligned with transpiration demand.`,
        irrigationFallback: `Soil moisture is ${formatNumber(currentData.soilMoisture, 1)}%. Confirm the next irrigation window before midday.`,
        diseaseFallback: `RH ${formatNumber(currentData.humidity, 0)}% and VPD ${formatNumber(currentData.vpd, 2)} kPa define the disease watch level.`,
        rtrFallback: `Yield outlook ${formatNumber(modelMetrics.yield.predictedWeekly, 1)} kg/week. Compare RTR target temperature before changing setpoints.`,
        rtrWithinBody: 'Within the RTR target band. Hold the current temperature strategy.',
        rtrAboveBody: (d: string) => `${d}°C above the RTR target. Consider venting or shading.`,
        rtrBelowBody: (d: string) => `${d}°C below the RTR target. Consider heating.`,
      };

  const rtrAbsDelta = rtrKnown ? formatNumber(Math.abs(rtrDeltaC as number), 1) : '0';
  const rtrBody = !rtrKnown
    ? copy.rtrFallback
    : rtrWithin
      ? copy.rtrWithinBody
      : (rtrDeltaC as number) > 0
        ? copy.rtrAboveBody(rtrAbsDelta)
        : copy.rtrBelowBody(rtrAbsDelta);
  const rtrChip = !rtrKnown ? copy.recommended : rtrWithin ? copy.rtrWithinChip : copy.rtrOffChip;

  return (
    <section id="today-action-board" tabIndex={-1} className="scroll-mt-24 space-y-1.5" aria-labelledby="today-action-board-title">
      <LandingSectionHeading titleId="today-action-board-title" eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
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
          chip={rtrChip}
          tone={rtrTone}
          body={rtrBody}
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
        currentTemp: '현재 평균온도',
        currentTempSub: '센서 기준',
        targetTemp: 'RTR 목표온도',
        targetTempSub: '광량 반영 기준값',
        withinLabel: '기준 범위 안',
        aboveLabel: '목표보다 높음',
        belowLabel: '목표보다 낮음',
        bandNow: '현재',
        bandTarget: '목표',
        toleranceNote: (tol: string) => `허용 ±${tol}°C`,
        verdictWithin: 'RTR 목표 범위 안입니다. 지금 온도 관리를 유지하세요.',
        verdictAbove: (d: string) => `목표보다 ${d}°C 높습니다. 환기·차광으로 낮추는 것을 검토하세요.`,
        verdictBelow: (d: string) => `목표보다 ${d}°C 낮습니다. 난방·보온으로 올리는 것을 검토하세요.`,
        context: '참고 지표',
        ctxRadiation: '누적광량',
        ctxSlope: '목표 기울기',
        ctxCalibration: '보정',
        ctxCoverage: '데이터 커버리지',
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
        currentTemp: 'Current mean temp',
        currentTempSub: 'From sensors',
        targetTemp: 'RTR target temp',
        targetTempSub: 'Light-adjusted target',
        withinLabel: 'Within band',
        aboveLabel: 'Above target',
        belowLabel: 'Below target',
        bandNow: 'Now',
        bandTarget: 'Target',
        toleranceNote: (tol: string) => `Band ±${tol}°C`,
        verdictWithin: 'Within the RTR target band. Hold the current temperature strategy.',
        verdictAbove: (d: string) => `${d}°C above target. Consider venting or shading to cool down.`,
        verdictBelow: (d: string) => `${d}°C below target. Consider heating to warm up.`,
        context: 'Reference',
        ctxRadiation: 'Radiation sum',
        ctxSlope: 'Target slope',
        ctxCalibration: 'Calibration',
        ctxCoverage: 'Data coverage',
      };

  const tol = Math.max(effectiveProfile.toleranceC, 0.1);
  const delta = snapshot.deltaTempC;
  const absDelta = formatNumber(Math.abs(delta), 1);
  const within = Math.abs(delta) <= tol;
  const direction: 'above' | 'below' | 'on' = delta > tol ? 'above' : delta < -tol ? 'below' : 'on';
  const verdictTone: 'growth' | 'warning' = within ? 'growth' : 'warning';
  const verdictLabel = within ? copy.withinLabel : delta > 0 ? copy.aboveLabel : copy.belowLabel;
  const verdictSentence = within
    ? copy.verdictWithin
    : delta > 0
      ? copy.verdictAbove(absDelta)
      : copy.verdictBelow(absDelta);

  // Position the current-temp marker on an axis centred on the target, wide enough
  // that both the tolerance band and the marker stay visible.
  const axisHalf = Math.max(tol * 2.5, Math.abs(delta) * 1.25, 1);
  const clampPct = (value: number) => Math.min(97, Math.max(3, value));
  const markerPct = clampPct(50 + (delta / (2 * axisHalf)) * 100);
  const bandLeftPct = clampPct(50 - (tol / (2 * axisHalf)) * 100);
  const bandWidthPct = Math.min(94, (tol / axisHalf) * 100);
  const weeklyYieldLabel = `${formatNumber(modelMetrics.yield.predictedWeekly, 1)} ${copy.yieldUnit}`;

  const contextItems: Array<[string, string]> = [
    [copy.ctxRadiation, `${formatNumber(snapshot.radiationSumMjM2D, 1)} MJ/m²`],
    [copy.ctxSlope, `${formatNumber(effectiveProfile.slopeCPerMjM2, 2)} °C/MJ`],
    [copy.ctxCalibration, `${calibrationLabel} · ${effectiveProfile.calibration.sampleDays}d`],
    [copy.ctxCoverage, `${formatNumber(snapshot.coveragePct, 0)}%`],
  ];

  return (
    <section id="scenario-optimizer" tabIndex={-1} className="scroll-mt-24 space-y-0.5" aria-labelledby="scenario-optimizer-title">
      <LandingSectionHeading
        titleId="scenario-optimizer-title"
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={(
          <div className="flex items-center gap-2">
            <StatusChip tone={optimizerEnabled ? 'growth' : 'stable'}>{copy.targetReady}</StatusChip>
            <span className="hidden text-xs font-semibold text-[color:var(--sg-text-muted)] sm:inline">{balanceLabel}</span>
          </div>
        )}
      />
      <div className="grid gap-1 xl:grid-cols-12">
        <div className={cn('sg-panel p-2', trendNode ? 'xl:col-span-8' : 'xl:col-span-12')}>
          {/* The one comparison that drives a decision: current temp vs RTR target. */}
          <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
            <TempStat icon={Thermometer} label={copy.currentTemp} sub={copy.currentTempSub} value={`${formatNumber(snapshot.averageTempC, 1)}°C`} />
            <div className="hidden items-center justify-center text-[color:var(--sg-text-faint)] sm:flex">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </div>
            <TempStat icon={Thermometer} label={copy.targetTemp} sub={copy.targetTempSub} value={`${formatNumber(snapshot.targetTempC, 1)}°C`} emphasized />
            <div className="flex flex-col items-start justify-center gap-1 sm:items-end">
              <StatusChip tone={verdictTone} className="gap-1">
                {direction === 'above' ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  : direction === 'below' ? <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                {verdictLabel}
              </StatusChip>
              <span className="sg-data-number text-sm font-bold text-[color:var(--sg-text-strong)]">
                {delta >= 0 ? '+' : '−'}{absDelta}°C
              </span>
            </div>
          </div>

          {/* Tolerance band: how far current sits from target relative to the ± band. */}
          <div className="mt-2">
            <div className="relative h-2 rounded-full bg-[color:var(--sg-surface-muted)]" role="presentation">
              <div
                className={cn('absolute inset-y-0 rounded-full', within ? 'bg-[color:var(--sg-color-sage-soft)]' : 'bg-[color:var(--sg-surface-raised)]')}
                style={{ left: `${bandLeftPct}%`, width: `${bandWidthPct}%` } as CSSProperties}
              />
              <div className="absolute inset-y-[-2px] w-px bg-[color:var(--sg-outline-soft)]" style={{ left: '50%' } as CSSProperties} aria-hidden="true" />
              <div
                className={cn('absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[var(--sg-shadow-card)]',
                  within ? 'bg-[color:var(--sg-color-sage)]' : 'bg-[color:var(--sg-color-clay,#c0714f)]')}
                style={{ left: `${markerPct}%` } as CSSProperties}
                aria-hidden="true"
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-[color:var(--sg-text-faint)]">
              <span>{copy.bandNow}</span>
              <span>{copy.toleranceNote(formatNumber(tol, 1))}</span>
              <span>{copy.bandTarget}</span>
            </div>
          </div>

          {/* Plain-language verdict — the takeaway a grower acts on. */}
          <p className={cn('mt-2 rounded-[var(--sg-radius-sm)] border px-2.5 py-1.5 text-[0.72rem] font-semibold leading-5',
            within
              ? 'border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-text-strong)]'
              : 'border-[color:var(--sg-color-clay,#c0714f)] bg-[color:var(--sg-surface-raised)] text-[color:var(--sg-text-strong)]')}>
            {verdictSentence}
          </p>

          {/* Reference metrics — context, explicitly NOT a current-vs-target comparison. */}
          <div className="mt-2 border-t border-[color:var(--sg-outline-soft)] pt-1.5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--sg-text-faint)]">{copy.context}</span>
              <span className="flex items-baseline gap-1 text-[10px] font-semibold text-[color:var(--sg-text-muted)]">
                {copy.weeklyYield}
                <span className="sg-data-number font-bold text-[color:var(--sg-text-strong)]">{weeklyYieldLabel}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-4" role="list">
              {contextItems.map(([label, value]) => (
                <div key={label} role="listitem">
                  <div className="text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{label}</div>
                  <div className="sg-data-number mt-0.5 text-[0.68rem] font-bold text-[color:var(--sg-text-strong)]">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {trendNode ? <div className="xl:col-span-4">{trendNode}</div> : null}
        {analyticsNode ? <div className="overview-analytics-compact xl:col-span-12">{analyticsNode}</div> : null}
      </div>
    </section>
  );
}

function TempStat({
  icon: Icon,
  label,
  sub,
  value,
  emphasized = false,
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <article className={cn('rounded-[var(--sg-radius-sm)] border p-2', emphasized
      ? 'border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)]'
      : 'border-[color:var(--sg-outline-soft)] bg-white')}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--sg-text-faint)]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="sg-data-number mt-1 text-xl font-bold text-[color:var(--sg-text-strong)]">{value}</div>
      <div className="mt-0.5 text-[0.62rem] text-[color:var(--sg-text-muted)]">{sub}</div>
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
  const weatherTone = weatherError ? 'warning' : 'stable';
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
      <LandingSectionHeading titleId="weather-market-knowledge-title" eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
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
  chipTone?: 'growth' | 'stable' | 'warning' | 'critical' | 'muted';
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
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-[color:var(--sg-outline-soft)] pt-1" role="list">
          {detailRows.map(([label, rowValue]) => (
            <div key={label} role="listitem">
              <div className="text-[10px] font-semibold text-[color:var(--sg-text-faint)]">{label}</div>
              <div className="sg-data-number mt-0.5 text-[0.66rem] font-bold text-[color:var(--sg-text-strong)]">{rowValue}</div>
            </div>
          ))}
        </div>
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
        eyebrow: '다음 단계',
        title: '한 플랫폼에서 더 나은 판단과 안정적인 수확을 만드세요.',
        support: '매일 온실 의사결정을 정리하는 PhytoSync 워크플로우를 시작하세요.',
        email: '업무 이메일',
        placeholder: '업무 이메일 입력',
        submit: '무료로 시작',
      }
    : {
        eyebrow: 'Next Step',
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
          <p className="sg-eyebrow">{copy.eyebrow}</p>
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
    <footer id="overview-footer" className="flex flex-col gap-2 border-t border-[color:var(--sg-outline-soft)] py-2 text-xs text-[color:var(--sg-text-muted)] md:flex-row md:items-center md:justify-between">
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
