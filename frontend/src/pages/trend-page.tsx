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
        title: '날씨와 시세 인사이트',
        description: '대구 기상 예보, 오이·토마토 도매 시세, 오늘 의사결정 신호를 한 화면에서 비교합니다.',
      }
    : {
        eyebrow: 'Insights',
        title: 'Weather and market insights',
        description: 'Compare Daegu weather, produce market trends, and today’s decision signals in one route.',
      };

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="min-h-0 xl:col-span-12">{weatherSurface}</div>
        <div className="min-h-0 xl:col-span-12">{marketSurface}</div>
        {decisionSurface ? <div className="min-h-0 xl:col-span-12">{decisionSurface}</div> : null}
      </div>
    </PageCanvas>
  );
}
