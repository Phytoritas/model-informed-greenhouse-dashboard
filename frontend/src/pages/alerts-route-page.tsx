import { Suspense, lazy } from 'react';
import type { KpiTileData } from '../components/KpiStrip';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { SmartGrowKnowledgeSummary } from '../hooks/useSmartGrowKnowledge';
import type { AppLocale } from '../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  TelemetryStatus,
  WeatherOutlook,
} from '../types';
import AlertsPage from './alerts-page';

const AlertsCommandCenter = lazy(() => import('../components/alerts/AlertsCommandCenter'));

interface AlertsRoutePageProps {
  locale: AppLocale;
  items: AlertRailItem[];
  fallbackAlertBody: string;
  crop: CropType;
  summary?: SmartGrowKnowledgeSummary | null;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  history?: SensorData[];
  forecast?: ForecastData | null;
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
  telemetryStatus: TelemetryStatus;
  statusSummary: string;
  primaryTiles: KpiTileData[];
  secondaryTiles: KpiTileData[];
  activePanel?: 'alerts-protection' | 'alerts-stream' | 'alerts-history';
}

export default function AlertsRoutePage({
  locale,
  items,
  fallbackAlertBody,
  crop,
  summary = null,
  currentData,
  metrics,
  history = [],
  forecast = null,
  producePrices = null,
  weather = null,
  rtrProfile = null,
  telemetryStatus,
  statusSummary,
  primaryTiles,
  secondaryTiles,
  activePanel = 'alerts-protection',
}: AlertsRoutePageProps) {
  const fallbackItems = items.length
    ? items
    : [{
        id: 'ready',
        severity: 'resolved' as const,
        title: locale === 'ko' ? '지금 바로 조치할 긴급 알림 없음' : 'No active critical alert',
        body: fallbackAlertBody,
      }];

  return (
    <AlertsPage
      locale={locale}
      surface={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '긴급 알림 센터' : 'Alerts center'}
              loadingMessage={locale === 'ko' ? '긴급 알림 화면을 불러오는 중입니다...' : 'Loading alerts center...'}
              minHeightClassName="min-h-[520px]"
            />
          )}
        >
          <AlertsCommandCenter
            locale={locale}
            items={fallbackItems}
            crop={crop}
            summary={summary}
            currentData={currentData}
            metrics={metrics}
            history={history}
            forecast={forecast}
            producePrices={producePrices}
            weather={weather}
            rtrProfile={rtrProfile}
            telemetryStatus={telemetryStatus}
            statusSummary={statusSummary}
            primaryTiles={primaryTiles}
            secondaryTiles={secondaryTiles}
            activePanel={activePanel}
          />
        </Suspense>
      )}
    />
  );
}
