import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface TrendPageProps {
  locale: 'ko' | 'en';
  weatherSurface: ReactNode;
  marketSurface: ReactNode;
  decisionSurface?: ReactNode;
}

export default function TrendPage({ locale, weatherSurface, marketSurface, decisionSurface = null }: TrendPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Insights',
        title: '외기·시세·판단 신호',
        description: '대구 외기 추세, 오이·토마토 시세, 오늘 온실 판단 신호를 별도 그래프와 카드로 확인합니다.',
        weather: '외기 추세',
        market: '시세 추세',
        decision: '판단 신호',
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
        weatherDetail: 'Translate forecast and observed signals into operating rhythm.',
        marketDetail: 'Compare KAMIS prices against seasonal normals by item.',
        decisionDetail: 'Bundle weather, market, energy, and crop signals for today.',
      };
  const summaryItems = [
    { label: copy.weather, detail: copy.weatherDetail },
    { label: copy.market, detail: copy.marketDetail },
    { label: copy.decision, detail: copy.decisionDetail },
  ];

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <section className="grid gap-3 md:grid-cols-3" aria-label={locale === 'ko' ? '인사이트 구성' : 'Insights modules'}>
        {summaryItems.map((item, index) => (
          <article key={item.label} className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="sg-eyebrow">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="mt-2 text-base font-bold text-[color:var(--sg-text-strong)]">{item.label}</h3>
              </div>
              <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--sg-color-sage)]" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--sg-text-muted)]">{item.detail}</p>
          </article>
        ))}
      </section>
      <div className="mt-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="min-h-0 xl:col-span-12">{weatherSurface}</div>
        <div className="min-h-0 xl:col-span-12">{marketSurface}</div>
        {decisionSurface ? <div className="min-h-0 xl:col-span-12">{decisionSurface}</div> : null}
      </div>
    </PageCanvas>
  );
}
