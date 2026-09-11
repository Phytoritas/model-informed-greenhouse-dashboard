import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import ScientificText from '../common/ScientificText';
import {
    CHART_THEME,
    chartSeries,
    DASHBOARD_CHART_HEIGHT,
    DASHBOARD_CHART_LEGEND_CLASSNAME,
    type ChartMarkerShape,
} from './chartStyles';

interface ChartFrameProps {
    children: ReactNode | ((size: { width: number; height: number }) => ReactNode);
    className?: string;
    style?: CSSProperties;
    minHeight?: number;
}

export default function ChartFrame({
    children,
    className,
    style,
    minHeight = DASHBOARD_CHART_HEIGHT.compact,
}: ChartFrameProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const node = containerRef.current;
        if (!node) {
            return;
        }

        const updateReadiness = (width: number, height: number) => {
            setSize({ width, height });
            setIsReady(width > 0 && height > 0);
        };

        updateReadiness(node.clientWidth, node.clientHeight);

        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) {
                return;
            }
            updateReadiness(entry.contentRect.width, entry.contentRect.height);
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            // min-w-0 lets the frame shrink below the chart's intrinsic width when it
            // is a flex/grid item, so the measured width tracks the container on narrow
            // viewports instead of forcing horizontal page overflow.
            className={cn('w-full min-w-0', className)}
            style={{ minHeight, ...style }}
        >
            {isReady ? (
                typeof children === 'function' ? children(size) : children
            ) : (
                <div className="h-full w-full rounded-[18px] bg-[color:var(--sg-surface-muted)]/80" />
            )}
        </div>
    );
}

function MarkerGlyph({
    shape,
    fill,
    outline,
    cx,
    cy,
}: {
    shape: ChartMarkerShape;
    fill: string;
    outline: string;
    cx: number;
    cy: number;
}) {
    const size = CHART_THEME.lines.markerSize;
    const half = size / 2;
    const shared = {
        fill,
        stroke: outline,
        strokeWidth: CHART_THEME.lines.markerEdgeWidth,
    };

    if (shape === 'square') {
        return <rect x={cx - half} y={cy - half} width={size} height={size} {...shared} />;
    }
    if (shape === 'triangle') {
        return <polygon points={`${cx},${cy - half} ${cx + half},${cy + half} ${cx - half},${cy + half}`} {...shared} />;
    }
    if (shape === 'diamond') {
        return <polygon points={`${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`} {...shared} />;
    }
    return <circle cx={cx} cy={cy} r={half} {...shared} />;
}

export interface ChartLegendEntry {
    /** Quantity name only; the unit belongs on the axis label. */
    label: string;
    /** Position in the BioRender series cycle. */
    seriesIndex?: number;
    /** Explicit stroke, for series that are not part of the cycle. */
    color?: string;
    dash?: string;
    marker?: ChartMarkerShape;
}

/**
 * Legend rendered above the plot, outside the data region, per the BioRender
 * theme. Each swatch draws the series' real line style and marker so the
 * legend stays readable in grayscale.
 */
export function ChartSeriesLegend({
    entries,
    className,
    id,
}: {
    entries: ChartLegendEntry[];
    className?: string;
    id?: string;
}) {
    if (entries.length === 0) {
        return null;
    }

    const swatchWidth = CHART_THEME.legend.swatchWidth;
    const swatchHeight = CHART_THEME.legend.swatchHeight;
    const midY = swatchHeight / 2;

    return (
        <ul id={id} className={cn(DASHBOARD_CHART_LEGEND_CLASSNAME, 'sg-chart-legend list-none p-0', className)}>
            {entries.map((entry, index) => {
                const token = chartSeries(entry.seriesIndex ?? index);
                const stroke = entry.color ?? token.line;
                const dash = entry.dash ?? token.dash;
                const marker = entry.marker ?? token.marker;
                return (
                    <li key={entry.label} className="inline-flex items-center gap-1.5">
                        <svg
                            width={swatchWidth}
                            height={swatchHeight}
                            viewBox={`0 0 ${swatchWidth} ${swatchHeight}`}
                            aria-hidden="true"
                            focusable="false"
                        >
                            <line
                                x1={0}
                                y1={midY}
                                x2={swatchWidth}
                                y2={midY}
                                stroke={stroke}
                                strokeWidth={CHART_THEME.lines.width}
                                strokeDasharray={dash || undefined}
                            />
                            <MarkerGlyph
                                shape={marker}
                                fill={entry.color ?? token.fill}
                                outline={entry.color ?? token.outline}
                                cx={swatchWidth / 2}
                                cy={midY}
                            />
                        </svg>
                        <ScientificText text={entry.label} />
                    </li>
                );
            })}
        </ul>
    );
}
