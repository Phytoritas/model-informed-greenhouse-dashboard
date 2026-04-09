import { Suspense, lazy } from 'react';
import type { KpiTileData } from '../components/KpiStrip';
import type { AlertRailItem } from '../components/dashboard/AlertRail';
import LoadingSkeleton from '../features/common/LoadingSkeleton';
import type { AppLocale } from '../i18n/locale';
import type { TelemetryStatus } from '../types';
import AlertsPage from './alerts-page';

const AlertsCommandCenter = lazy(() => import('../components/alerts/AlertsCommandCenter'));

interface AlertsRoutePageProps {
  locale: AppLocale;
  items: AlertRailItem[];
  fallbackAlertBody: string;
  telemetryStatus: TelemetryStatus;
  statusSummary: string;
  primaryTiles: KpiTileData[];
  secondaryTiles: KpiTileData[];
  activePanel?: 'alerts-priority' | 'alerts-stream' | 'alerts-history';
}

export default function AlertsRoutePage({
  locale,
  items,
  fallbackAlertBody,
  telemetryStatus,
  statusSummary,
  primaryTiles,
  secondaryTiles,
  activePanel = 'alerts-priority',
}: AlertsRoutePageProps) {
  const fallbackItems = items.length
    ? items
    : [{
        id: 'ready',
        severity: 'resolved' as const,
        title: locale === 'ko' ? '지금 바로 조치할 경보 없음' : 'No active critical alert',
        body: fallbackAlertBody,
      }];

  return (
    <AlertsPage
      locale={locale}
      surface={(
        <Suspense
          fallback={(
            <LoadingSkeleton
              title={locale === 'ko' ? '경보 센터' : 'Alerts center'}
              loadingMessage={locale === 'ko' ? '경보 화면을 불러오는 중입니다...' : 'Loading alerts center...'}
              minHeightClassName="min-h-[520px]"
            />
          )}
        >
          <AlertsCommandCenter
            locale={locale}
            items={fallbackItems}
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
