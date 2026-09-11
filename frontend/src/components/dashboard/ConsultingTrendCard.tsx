import { useMemo } from 'react';
import {
  Bar,
  ComposedChart,
  Label,
  Line,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardCheck } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import ChartFrame, { ChartSeriesLegend } from '../charts/ChartFrame';
import {
  chartSeries,
  DASHBOARD_CHART_AXIS_LABEL,
  DASHBOARD_CHART_AXIS_PROPS,
  DASHBOARD_CHART_CURSOR,
  DASHBOARD_CHART_HEIGHT,
  DASHBOARD_CHART_TOOLTIP_ITEM_STYLE,
  DASHBOARD_CHART_TOOLTIP_LABEL_STYLE,
  DASHBOARD_CHART_TOOLTIP_STYLE,
  seriesBarProps,
  seriesLineProps,
} from '../charts/chartStyles';
import DashboardCard from '../common/DashboardCard';
import { StatusChip } from '../ui/status-chip';
import { buildConsultingPoints, type ConsultingPoint } from './consultingTrendData';

interface ConsultingTrendCardProps {
  actionsNow: string[];
  actionsToday: string[];
  actionsWeek: string[];
  confidence?: number | null;
  advisorRefreshing?: boolean;
  advisorUpdatedAt?: number | null;
}

function asPercent(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value <= 1 ? value * 100 : value;
}

/** Action count uses the first cycle color; priority score uses the fourth. */
const ACTION_SERIES_INDEX = 0;
const PRIORITY_SERIES_INDEX = 3;

function formatCount(count: number, locale: 'ko' | 'en'): string {
  if (locale === 'ko') {
    return `${count}건`;
  }
  return `${count} action${count === 1 ? '' : 's'}`;
}

export default function ConsultingTrendCard({
  actionsNow,
  actionsToday,
  actionsWeek,
  confidence = null,
  advisorRefreshing = false,
  advisorUpdatedAt = null,
}: ConsultingTrendCardProps) {
  const { locale } = useLocale();
  const confidencePercent = asPercent(confidence);
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Advisor consulting',
        title: '컨설팅 액션 부하 · 신뢰도',
        description: '즉시, 오늘, 이번 주 권고량과 advisor 신뢰도를 같이 봅니다.',
        now: '즉시',
        today: '오늘',
        week: '이번 주',
        actions: '권고량',
        confidence: '신뢰도',
        priority: '우선순위 점수',
        countUnit: '건',
        scoreUnit: '점',
        empty: '현재 대기 중인 컨설팅 액션이 없습니다.',
        refreshed: '갱신 중',
        current: '현재',
        lastUpdated: '마지막 업데이트',
      }
    : {
        eyebrow: 'Advisor consulting',
        title: 'Consulting action load · confidence',
        description: 'Compare immediate, today, and weekly advisor load with confidence.',
        now: 'Now',
        today: 'Today',
        week: 'Week',
        actions: 'Actions',
        confidence: 'Confidence',
        priority: 'Priority score',
        countUnit: 'actions',
        scoreUnit: 'score',
        empty: 'No pending consulting actions.',
        refreshed: 'Refreshing',
        current: 'Current',
        lastUpdated: 'Last update',
      };

  const chartData = useMemo<ConsultingPoint[]>(() => {
    return buildConsultingPoints({
      nowLabel: copy.now,
      todayLabel: copy.today,
      weekLabel: copy.week,
      actionsNowCount: actionsNow.length,
      actionsTodayCount: actionsToday.length,
      actionsWeekCount: actionsWeek.length,
    });
  }, [actionsNow.length, actionsToday.length, actionsWeek.length, copy.now, copy.today, copy.week]);

  const totalActions = actionsNow.length + actionsToday.length + actionsWeek.length;
  const latestAction = actionsNow[0] ?? actionsToday[0] ?? actionsWeek[0] ?? copy.empty;
  const tone = totalActions === 0 ? 'growth' : actionsNow.length > 0 ? 'warning' : 'stable';

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      className="sg-panel h-full min-w-0 bg-white !p-4"
      contentClassName="flex flex-col gap-3"
      actions={(
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)] shadow-[var(--sg-shadow-card)]">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip tone={tone}>
          {copy.actions}: {formatCount(totalActions, locale)}
        </StatusChip>
        {advisorRefreshing ? <StatusChip tone="stable">{copy.refreshed}</StatusChip> : null}
        {confidencePercent !== null ? (
          <StatusChip tone="growth">
            {copy.confidence}: {Math.round(confidencePercent)}%
          </StatusChip>
        ) : null}
      </div>

      <div
        role="img"
        aria-label={`${copy.actions}: ${formatCount(totalActions, locale)}. ${copy.priority}. ${confidencePercent !== null ? `${copy.confidence}: ${Math.round(confidencePercent)}%.` : ''}`}
      >
        <ChartSeriesLegend
          className="mb-2"
          entries={[
            { label: `${copy.actions} (${copy.countUnit})`, seriesIndex: ACTION_SERIES_INDEX },
            { label: `${copy.priority} (${copy.scoreUnit})`, seriesIndex: PRIORITY_SERIES_INDEX },
          ]}
        />
        <ChartFrame minHeight={DASHBOARD_CHART_HEIGHT.compact} style={{ height: DASHBOARD_CHART_HEIGHT.compact }}>
          {({ width, height }) => (
            <ComposedChart
              width={Math.max(width, 1)}
              height={Math.max(height, DASHBOARD_CHART_HEIGHT.compact)}
              data={chartData}
              margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
            >
              <XAxis {...DASHBOARD_CHART_AXIS_PROPS} dataKey="horizon" />
              <YAxis {...DASHBOARD_CHART_AXIS_PROPS} yAxisId="left" allowDecimals={false} width={58}>
                <Label
                  value={copy.countUnit}
                  angle={-90}
                  position="insideLeft"
                  style={{ ...DASHBOARD_CHART_AXIS_LABEL, textAnchor: 'middle' }}
                />
              </YAxis>
              <YAxis
                {...DASHBOARD_CHART_AXIS_PROPS}
                yAxisId="right"
                orientation="right"
                allowDecimals={false}
                width={58}
              >
                <Label
                  value={copy.scoreUnit}
                  angle={90}
                  position="insideRight"
                  style={{ ...DASHBOARD_CHART_AXIS_LABEL, textAnchor: 'middle' }}
                />
              </YAxis>
              <Tooltip
                cursor={DASHBOARD_CHART_CURSOR}
                formatter={(value: number, name: string) => {
                  if (name === 'priorityScore') {
                    return [value.toFixed(0), copy.priority];
                  }
                  return [formatCount(value, locale), copy.actions];
                }}
                contentStyle={DASHBOARD_CHART_TOOLTIP_STYLE}
                labelStyle={DASHBOARD_CHART_TOOLTIP_LABEL_STYLE}
                itemStyle={DASHBOARD_CHART_TOOLTIP_ITEM_STYLE}
              />
              <Bar {...seriesBarProps(ACTION_SERIES_INDEX)} yAxisId="left" dataKey="actionCount" name="actionCount" />
              <Line
                {...seriesLineProps(PRIORITY_SERIES_INDEX)}
                yAxisId="right"
                dataKey="priorityScore"
                name="priorityScore"
                activeDot={{
                  ...seriesLineProps(PRIORITY_SERIES_INDEX).activeDot,
                  fill: chartSeries(PRIORITY_SERIES_INDEX).fill,
                }}
              />
            </ComposedChart>
          )}
        </ChartFrame>
      </div>

      <div className="rounded-[14px] bg-[color:var(--sg-surface-soft)] px-3 py-2 text-xs leading-5 text-[color:var(--sg-text-muted)]" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
        <span className="font-semibold text-[color:var(--sg-text-strong)]">{copy.current}: </span>
        {latestAction}
        {advisorUpdatedAt ? (
          <span className="mt-1 block text-[11px] text-[color:var(--sg-text-faint)]">
            {copy.lastUpdated}: {new Date(advisorUpdatedAt).toLocaleTimeString(locale === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : null}
      </div>
    </DashboardCard>
  );
}
