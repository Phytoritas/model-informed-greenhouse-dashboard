import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';
import type { AppLocale } from '../../i18n/locale';
import { formatLocaleDateTime } from '../../i18n/locale';
import { StatusChip } from '../ui/status-chip';

interface OverviewPageHeaderProps {
  locale: AppLocale;
  siteName: string;
  siteCoordinates?: { latitude: number; longitude: number } | null;
  /** Simulated clock of the frame on screen. Never presented as wall-clock time. */
  simulatedTimestamp?: number | null;
  cropSelector?: ReactNode;
}

function formatCoordinates(coordinates: { latitude: number; longitude: number }): string {
  return `${coordinates.latitude.toFixed(4)}°N, ${coordinates.longitude.toFixed(4)}°E`;
}

/**
 * Page context for the overview screen: which greenhouse, that the numbers come from
 * a demo simulation, and which simulated moment is on screen. Brand and global
 * navigation stay with the app shell so the page shows one header only.
 */
export default function OverviewPageHeader({
  locale,
  siteName,
  siteCoordinates = null,
  simulatedTimestamp = null,
  cropSelector,
}: OverviewPageHeaderProps) {
  const copy = locale === 'ko'
    ? { demo: '시뮬레이션', simulated: '시뮬레이션 시각', pending: '시뮬레이션 대기' }
    : { demo: 'Simulation', simulated: 'Simulated time', pending: 'Simulation idle' };
  const hasTime = typeof simulatedTimestamp === 'number' && Number.isFinite(simulatedTimestamp);
  const simulatedLabel = hasTime
    ? formatLocaleDateTime(locale, simulatedTimestamp as number, {
      month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
    })
    : null;

  return (
    <header className="overview-site-header">
      <div className="min-w-0">
        <div className="overview-site-eyebrow">
          <span className="overview-site-eyebrow-label">{locale === 'ko' ? '나의 온실' : 'My greenhouse'}</span>
          <StatusChip tone="muted">{copy.demo}</StatusChip>
        </div>
        <h1 className="overview-site-title">
          {siteName}
        </h1>
        {siteCoordinates ? (
          <span className="overview-site-coords">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {formatCoordinates(siteCoordinates)}
          </span>
        ) : null}
      </div>
      <div className="overview-site-controls">
        {cropSelector}
        <div className="overview-site-clock">
          <p className="overview-site-clock-label">
            {copy.simulated}
          </p>
          <p className="sg-data-number overview-site-clock-value">
            {simulatedLabel ? `${simulatedLabel} KST` : copy.pending}
          </p>
        </div>
      </div>
    </header>
  );
}
