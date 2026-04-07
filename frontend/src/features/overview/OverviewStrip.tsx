import KpiStrip from '../../components/KpiStrip';
import type { KpiTileData } from '../../components/KpiStrip';
import type { TelemetryStatus } from '../../types';

interface OverviewStripProps {
    statusSummary: string;
    telemetryStatus: TelemetryStatus;
    primaryTiles: KpiTileData[];
    secondaryTiles: KpiTileData[];
}

export default function OverviewStrip({
    statusSummary,
    telemetryStatus,
    primaryTiles,
    secondaryTiles,
}: OverviewStripProps) {
    return (
        <div className="mb-8">
            <KpiStrip
                statusSummary={statusSummary}
                telemetryStatus={telemetryStatus}
                primaryTiles={primaryTiles}
                secondaryTiles={secondaryTiles}
            />
        </div>
    );
}
