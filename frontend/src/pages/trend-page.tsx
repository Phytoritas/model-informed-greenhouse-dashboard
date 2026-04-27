import type { ReactNode } from 'react';
import { ArrowUpRight, CloudSun, Gauge, LineChart as LineChartIcon, Sprout, type LucideIcon } from 'lucide-react';
import DashboardCard from '../components/common/DashboardCard';
import PageCanvas from '../components/layout/PageCanvas';

interface TrendPageProps {
  locale: 'ko' | 'en';
  weatherSurface: ReactNode;
  marketSurface: ReactNode;
  decisionSurface?: ReactNode;
  weatherUnavailable?: boolean;
  marketUnavailable?: boolean;
}

export default function TrendPage({
  locale,
  weatherSurface,
  marketSurface,
  decisionSurface = null,
  weatherUnavailable = false,
  marketUnavailable = false,
}: TrendPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Insights',
        title: '외기·시세·판단 신호',
        description: '대구 외기 추세, 오이·토마토 시세, 오늘 온실 판단 신호를 별도 그래프와 카드로 확인합니다.',
        weather: '외기 추세',
        market: '시세 추세',
        decision: '판단 신호',
        heroTitle: '날씨·시세를 오늘 운영 판단으로 연결',
        heroBody: '실측 외기, 예보, KAMIS 도매 시세, 생육 지표를 한 화면에서 비교하되 각 그래프는 별도 표면으로 넓게 확인합니다.',
        live: 'Backend connected',
        unavailable: '연동 확인 필요',
        openCharts: '그래프 확인',
        weatherDetail: '예보와 실측 흐름을 운전 리듬으로 번역합니다.',
        marketDetail: 'KAMIS 가격과 평년선을 품목별로 비교합니다.',
        decisionDetail: '날씨·시세·에너지·생육을 오늘 판단으로 묶습니다.',
      }
    : {
        eyebrow: 'Insights',
        title: 'Outside, market, and decision signals',
        description: 'Read Daegu outside trends, cucumber/tomato prices, and greenhouse decision signals as dedicated charts and cards.',
        weather: 'Outside trend',
        market: 'Market trend',
        decision: 'Decision signals',
        heroTitle: 'Connect weather and prices to today’s greenhouse decisions',
        heroBody: 'Compare observed outside weather, forecast, KAMIS wholesale price, and crop signals in wide backend-backed panels.',
        live: 'Backend connected',
        unavailable: 'Check connection',
        openCharts: 'Review charts',
        weatherDetail: 'Translate forecast and observed signals into operating rhythm.',
        marketDetail: 'Compare KAMIS prices against seasonal normals by item.',
        decisionDetail: 'Bundle weather, market, energy, and crop signals for today.',
      };
  const summaryItems = [
    { label: copy.weather, detail: copy.weatherDetail, Icon: CloudSun, tone: 'sage', status: weatherUnavailable ? copy.unavailable : copy.live },
    { label: copy.market, detail: copy.marketDetail, Icon: LineChartIcon, tone: 'tomato', status: marketUnavailable ? copy.unavailable : copy.live },
    { label: copy.decision, detail: copy.decisionDetail, Icon: Gauge, tone: 'olive', status: weatherUnavailable || marketUnavailable ? copy.unavailable : copy.live },
  ];

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <DashboardCard
        variant="hero"
        eyebrow={locale === 'ko' ? 'INSIGHTS WORKSPACE' : 'INSIGHTS WORKSPACE'}
        title={copy.heroTitle}
        description={copy.heroBody}
        actions={(
          <a
            href="#trend-surfaces"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary)] px-4 text-sm font-bold text-white shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
          >
            {copy.openCharts}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {summaryItems.map((item, index) => (
            <InsightSummaryCard
              key={item.label}
              index={index}
              label={item.label}
              detail={item.detail}
              Icon={item.Icon}
              tone={item.tone}
              status={item.status}
            />
          ))}
        </div>
      </DashboardCard>
      <section
        id="trend-surfaces"
        tabIndex={-1}
        aria-label={locale === 'ko' ? '인사이트 그래프 표면' : 'Insight chart surfaces'}
        className="mt-5 grid grid-cols-1 items-start gap-5 scroll-mt-24 focus:outline-none xl:grid-cols-12"
      >
        <div className="min-h-0 xl:col-span-12">{weatherSurface}</div>
        <div className="min-h-0 xl:col-span-12">{marketSurface}</div>
        {decisionSurface ? <div className="min-h-0 xl:col-span-12">{decisionSurface}</div> : null}
      </section>
    </PageCanvas>
  );
}

function InsightSummaryCard({
  index,
  label,
  detail,
  Icon,
  tone,
  status,
}: {
  index: number;
  label: string;
  detail: string;
  Icon: LucideIcon;
  tone: string;
  status: string;
}) {
  const toneClass = tone === 'tomato'
    ? 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]'
    : tone === 'olive'
      ? 'bg-[color:var(--sg-color-olive-soft)] text-[color:var(--sg-color-olive)]'
      : 'bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-success)]';

  return (
    <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="sg-eyebrow">{String(index + 1).padStart(2, '0')}</p>
          <h3 className="mt-2 text-base font-bold text-[color:var(--sg-text-strong)]">{label}</h3>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sg-radius-md)] ${toneClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--sg-text-muted)]">{detail}</p>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--sg-outline-soft)] pt-3">
        <span className="text-xs font-bold text-[color:var(--sg-color-olive)]">{status}</span>
        <Sprout className="h-4 w-4 text-[color:var(--sg-color-sage)]" aria-hidden="true" />
      </div>
    </article>
  );
}
