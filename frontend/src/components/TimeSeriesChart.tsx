import { memo, useCallback, useMemo } from 'react';
import {
    Line,
    LineChart,
    ReferenceLine,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { ReactNode } from 'react';
import { useLocale } from '../i18n/LocaleProvider';
import { useStableChartData } from '../hooks/useStableChartData';
import ChartFrame, { ChartSeriesLegend, type ChartLegendEntry } from './charts/ChartFrame';
import ScientificText from './common/ScientificText';
import {
    buildTimeAxisPlan,
    chartSeries,
    DASHBOARD_CHART_ANNOTATION,
    DASHBOARD_CHART_AXIS_PROPS,
    DASHBOARD_CHART_AXIS_STROKE,
    DASHBOARD_CHART_CURSOR,
    DASHBOARD_CHART_HEIGHT,
    DASHBOARD_CHART_MARGIN,
    DASHBOARD_CHART_TOOLTIP_ITEM_STYLE,
    DASHBOARD_CHART_TOOLTIP_LABEL_STYLE,
    DASHBOARD_CHART_TOOLTIP_STYLE,
    formatTimeAxisLabel,
    formatTimeAxisTick,
    seriesLineProps,
} from './charts/chartStyles';

export interface TimeSeriesDataKey {
    key: string;
    /** Quantity name only. The unit lives on the axis label. */
    name: string;
    /** Position in the BioRender series cycle. */
    seriesIndex?: number;
    /** Explicit stroke for series outside the cycle. */
    color?: string;
}

interface TimeSeriesChartProps<T extends { timestamp?: number }> {
    title: string;
    data: T[];
    dataKeys: TimeSeriesDataKey[];
    icon?: ReactNode;
    height?: number;
    eyebrow?: string;
    /**
     * Unit shared by every series on this chart, printed horizontally under the
     * title. A chart carries exactly one unit, so series that do not share a
     * unit belong in separate charts. Rotated axis titles were dropped: a
     * vertical 'mol H₂O m⁻² s⁻¹' both ate plot width and broke its own baseline.
     */
    unitLabel?: string;
    description?: string;
    /**
     * Grid-dense presentation: drops the eyebrow and the single-series legend,
     * which repeat the section eyebrow and the card title when many charts sit
     * side by side, and tightens padding and the axis gutter. Multi-series
     * legends, units, tooltips, and the replay cursor are unaffected.
     */
    compact?: boolean;
    /**
     * Renders as a cell in a divider-joined board instead of a standalone card,
     * so a grid of charts reads as one surface rather than eight islands.
     */
    seamless?: boolean;
    /** Replay cursor position; the full history stays plotted. */
    selectedTimestamp?: number | null;
}

function TimeSeriesChartInner<T extends { timestamp?: number }>({
    title,
    data,
    dataKeys,
    icon,
    height = DASHBOARD_CHART_HEIGHT.compact,
    eyebrow,
    unitLabel,
    description,
    compact = false,
    seamless = false,
    selectedTimestamp = null,
}: TimeSeriesChartProps<T>) {
    const { locale } = useLocale();
    const chartData = useStableChartData(data, dataKeys);
    const chartEyebrow = eyebrow ?? 'Dashboard trend';

    const axisPlan = useMemo(
        () => buildTimeAxisPlan(chartData.map((point) => Number(point.timestamp))),
        [chartData],
    );
    const multiDay = axisPlan?.multiDay ?? false;

    const tickFormatter = useCallback(
        (timestamp: number) => formatTimeAxisTick(locale, Number(timestamp), multiDay),
        [locale, multiDay],
    );
    const labelFormatter = useCallback(
        (timestamp: number) => formatTimeAxisLabel(locale, Number(timestamp)),
        [locale],
    );
    const legendEntries = useMemo<ChartLegendEntry[]>(
        () => dataKeys.map((entry, index) => ({
            label: entry.name,
            seriesIndex: entry.seriesIndex ?? index,
            color: entry.color,
        })),
        [dataKeys],
    );

    const hasCursor = typeof selectedTimestamp === 'number' && Number.isFinite(selectedTimestamp);
    // A lone series is already named by the card title, so its legend row only
    // costs vertical space in a dense grid.
    const showLegend = !compact || legendEntries.length > 1;
    const chartMargin = compact
        ? { ...DASHBOARD_CHART_MARGIN, top: 4, right: 10, bottom: 0, left: 0 }
        : DASHBOARD_CHART_MARGIN;
    // The unit moved to the header, so the gutter only has to fit tick numbers.
    const yAxisWidth = compact ? 44 : 52;
    const shellClassName = seamless
        ? 'flex min-w-0 flex-col bg-[color:var(--sg-surface-strong)] p-3'
        : `sg-panel min-w-0 bg-white ${compact ? 'p-2.5' : 'p-3'}`;

    if (!data || data.length === 0) {
        return (
            <div
                className={`${seamless
                    ? 'bg-[color:var(--sg-surface-strong)] p-3'
                    : `sg-panel bg-white ${compact ? 'p-3' : 'p-4'}`
                } flex h-full min-w-0 flex-col items-center justify-center text-center text-sm text-[color:var(--sg-text-faint)]`}
                style={compact ? { minHeight: height } : undefined}
            >
                {compact ? null : <p className="sg-eyebrow mb-2">{chartEyebrow}</p>}
                <div className="mb-2 flex items-center gap-2 opacity-50">
                    {icon}
                    <span className="text-sm font-semibold">{title}</span>
                </div>
                <p>{locale === 'ko' ? '데이터를 기다리는 중...' : 'Waiting for data...'}</p>
            </div>
        );
    }

    return (
        <div className={shellClassName}>
            <div
                className={`mb-2 flex min-w-0 items-start justify-between gap-2 text-[color:var(--sg-text)] ${seamless ? 'min-h-[42px]' : ''}`}
            >
                <div className="min-w-0">
                    {compact ? null : <p className="sg-eyebrow">{chartEyebrow}</p>}
                    <h3
                        className={`truncate text-sm font-semibold leading-5 text-[color:var(--sg-text-strong)] ${
                            compact ? '' : 'mt-1'
                        }`}
                        title={title}
                    >
                        {title}
                    </h3>
                    {/* Unit reads horizontally here so the plot keeps its width and
                        the exponents keep a real baseline. */}
                    {unitLabel ? (
                        <ScientificText
                            text={unitLabel}
                            className="scientific-unit mt-0.5 block text-xs text-[color:var(--sg-text-muted)]"
                        />
                    ) : null}
                    {description ? (
                        <p className="mt-0.5 text-xs leading-5 text-[color:var(--sg-text-muted)]">{description}</p>
                    ) : null}
                </div>
                {icon ? (
                    <span
                        className={`flex shrink-0 items-center justify-center rounded-[var(--sg-radius-xs)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)] ${
                            compact ? 'h-7 w-7' : 'h-8 w-8'
                        }`}
                    >
                        {icon}
                    </span>
                ) : null}
            </div>
            {seamless ? (
                <div className="mb-2 min-h-6">
                    {showLegend ? <ChartSeriesLegend entries={legendEntries} className="m-0" /> : null}
                </div>
            ) : showLegend ? <ChartSeriesLegend entries={legendEntries} className="mb-2" /> : null}
            <ChartFrame style={{ height }} minHeight={height}>
                {({ width, height: containerHeight }) => (
                    <LineChart
                        width={Math.max(width, 1)}
                        height={Math.max(containerHeight, height)}
                        data={chartData}
                        margin={chartMargin}
                    >
                        <XAxis
                            {...DASHBOARD_CHART_AXIS_PROPS}
                            dataKey="timestamp"
                            type="number"
                            scale="time"
                            domain={axisPlan ? axisPlan.domain : ['dataMin', 'dataMax']}
                            ticks={axisPlan?.ticks}
                            tickFormatter={tickFormatter}
                            minTickGap={compact ? 28 : 16}
                        />
                        <YAxis {...DASHBOARD_CHART_AXIS_PROPS} width={yAxisWidth} />
                        {hasCursor ? (
                            <ReferenceLine
                                x={selectedTimestamp as number}
                                stroke={DASHBOARD_CHART_AXIS_STROKE}
                                strokeDasharray="4 4"
                                strokeWidth={1.2}
                                ifOverflow="extendDomain"
                                label={{
                                    value: formatTimeAxisLabel(locale, selectedTimestamp as number),
                                    position: 'insideTopRight',
                                    ...DASHBOARD_CHART_ANNOTATION,
                                }}
                            />
                        ) : null}
                        <Tooltip
                            contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
                            labelStyle={DASHBOARD_CHART_TOOLTIP_LABEL_STYLE}
                            itemStyle={DASHBOARD_CHART_TOOLTIP_ITEM_STYLE}
                            cursor={DASHBOARD_CHART_CURSOR}
                            labelFormatter={labelFormatter}
                            formatter={(value: number, name: string) => [
                                unitLabel ? `${value} ${unitLabel}` : value,
                                name,
                            ]}
                        />
                        {dataKeys.map(({ key, name, seriesIndex, color }, index) => {
                            const lineProps = seriesLineProps(seriesIndex ?? index);
                            const token = chartSeries(seriesIndex ?? index);
                            return (
                                <Line
                                    key={key}
                                    {...lineProps}
                                    dataKey={key}
                                    name={name}
                                    stroke={color ?? lineProps.stroke}
                                    activeDot={{ ...lineProps.activeDot, fill: color ?? token.fill }}
                                />
                            );
                        })}
                    </LineChart>
                )}
            </ChartFrame>
        </div>
    );
}

const TimeSeriesChart = memo(TimeSeriesChartInner) as typeof TimeSeriesChartInner;

export default TimeSeriesChart;
