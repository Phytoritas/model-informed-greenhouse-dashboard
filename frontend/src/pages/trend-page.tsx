import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';
import { SectionHeader } from '../components/ui/section-header';
import type { AppLocale } from '../i18n/locale';

interface TrendPageProps {
  locale: AppLocale;
  weatherSurface: ReactNode;
  marketSurface: ReactNode;
  decisionSurface?: ReactNode;
}

export default function TrendPage({
  locale,
  weatherSurface,
  marketSurface,
  decisionSurface = null,
}: TrendPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: '인사이트',
        title: '외기·시세 인사이트',
        description: '대구 외기 추세와 도매 시세를 한 화면에서 비교해 오늘의 관수·환기·출하 판단을 준비합니다.',
        weatherEyebrow: '외기',
        weatherTitle: '외기 추세와 3일 예보',
        weatherDescription: '기온·강수·일사·풍속 추세와 단기 예보를 함께 봅니다.',
        marketEyebrow: '시세',
        marketTitle: '도매 시세 추세',
        marketDescription: '주요 품목의 도매 평균가와 2주 추세선을 확인합니다.',
        decisionEyebrow: '의사결정',
        decisionTitle: '의사결정 스냅샷',
        decisionDescription: '외기·시세·에너지·생육 신호를 묶어 지금의 상황을 요약합니다.',
      }
    : {
        eyebrow: 'Insights',
        title: 'Weather & market insights',
        description: 'Compare regional weather trends and wholesale prices on one screen to prepare today irrigation, ventilation, and shipping decisions.',
        weatherEyebrow: 'Weather',
        weatherTitle: 'Weather trend & 3-day outlook',
        weatherDescription: 'Temperature, rainfall, radiation, and wind trends alongside the short-term forecast.',
        marketEyebrow: 'Market',
        marketTitle: 'Wholesale price trend',
        marketDescription: 'Wholesale average prices and the two-week trend line for key produce.',
        decisionEyebrow: 'Decision',
        decisionTitle: 'Decision snapshot',
        decisionDescription: 'Weather, market, energy, and growth signals combined into a current-state summary.',
      };

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <section className="grid gap-4" aria-labelledby="trend-weather-title">
        <SectionHeader
          eyebrow={copy.weatherEyebrow}
          title={copy.weatherTitle}
          description={copy.weatherDescription}
          titleId="trend-weather-title"
        />
        {weatherSurface}
      </section>

      <section className="grid gap-4" aria-labelledby="trend-market-title">
        <SectionHeader
          eyebrow={copy.marketEyebrow}
          title={copy.marketTitle}
          description={copy.marketDescription}
          titleId="trend-market-title"
        />
        {marketSurface}
      </section>

      {decisionSurface ? (
        <section className="grid gap-4" aria-labelledby="trend-decision-title">
          <SectionHeader
            eyebrow={copy.decisionEyebrow}
            title={copy.decisionTitle}
            description={copy.decisionDescription}
            titleId="trend-decision-title"
          />
          {decisionSurface}
        </section>
      ) : null}
    </PageCanvas>
  );
}
