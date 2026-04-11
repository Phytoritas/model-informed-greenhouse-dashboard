import type { ReactNode } from 'react';
import PageCanvas from '../components/layout/PageCanvas';

interface TrendPageProps {
  weatherSurface: ReactNode;
  marketSurface: ReactNode;
}

export default function TrendPage({ weatherSurface, marketSurface }: TrendPageProps) {
  return (
    <PageCanvas title="Trend" description="" hideHeader>
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12">
        <div className="min-h-0 xl:col-span-6">{weatherSurface}</div>
        <div className="min-h-0 xl:col-span-6">{marketSurface}</div>
      </div>
    </PageCanvas>
  );
}
