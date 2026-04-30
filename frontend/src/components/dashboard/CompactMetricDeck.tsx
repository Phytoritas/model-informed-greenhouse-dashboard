import type { CSSProperties } from 'react';
import type { KpiTileData } from '../KpiStrip';
import { formatMetricValue } from '../../utils/formatValue';
import DataStateBadge from '../status/DataStateBadge';

interface CompactMetricDeckProps {
  tiles: KpiTileData[];
}

function toneClass(colorClass: string): string {
  if (colorClass.includes('amber') || colorClass.includes('orange') || colorClass.includes('yellow')) {
    return 'sg-tint-amber';
  }
  if (colorClass.includes('violet') || colorClass.includes('purple')) {
    return 'sg-tint-neutral';
  }
  if (colorClass.includes('earth')) {
    return 'bg-[color:var(--sg-surface-soft)]';
  }
  if (colorClass.includes('green')) {
    return 'bg-[color:var(--sg-surface-soft)]';
  }
  return 'bg-[color:var(--sg-surface-soft)]';
}

export default function CompactMetricDeck({ tiles }: CompactMetricDeckProps) {
  const clampTwoStyle: CSSProperties = {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
  };

  return (
    <>
      {tiles.map((tile) => {
        const Icon = tile.icon;
        const isNumeric = typeof tile.value === 'number';
        const value = typeof tile.value === 'number'
          ? formatMetricValue(tile.value, tile.fractionDigits)
          : tile.value;
        const showUnit = isNumeric && tile.availabilityState !== 'missing';

        return (
          <article
            key={tile.key}
            className={`h-full rounded-[24px] px-4 py-4 ${toneClass(tile.color)}`}
            style={{ boxShadow: 'var(--sg-shadow-card)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-white/88"
                style={{ boxShadow: 'var(--sg-shadow-card)' }}
              >
                <Icon className={`h-4 w-4 ${tile.color.replace('bg-', 'text-')}`} />
              </div>
              <DataStateBadge state={tile.availabilityState} />
            </div>
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
              {tile.label}
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div
                className={`${isNumeric ? 'text-[30px] leading-none' : 'text-lg leading-6'} font-semibold tracking-[-0.06em] text-[color:var(--sg-text-strong)]`}
                style={isNumeric ? undefined : clampTwoStyle}
              >
                {value}
              </div>
              {showUnit ? (
                <div className="pb-1 text-sm text-[color:var(--sg-text-muted)]">{tile.unit}</div>
              ) : null}
            </div>
            <div className="mt-3 text-xs leading-5 text-[color:var(--sg-text-muted)]" style={clampTwoStyle}>
              {tile.trendDetail || tile.availabilityLabel}
            </div>
          </article>
        );
      })}
    </>
  );
}
