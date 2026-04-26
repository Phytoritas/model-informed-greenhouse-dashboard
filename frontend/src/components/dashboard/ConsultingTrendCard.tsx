import { useMemo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClipboardCheck } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import ChartFrame from '../charts/ChartFrame';
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
        confidenceReference: '신뢰도 기준선',
        priority: '우선순위 점수',
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
        confidenceReference: 'Confidence reference',
        priority: 'Priority score',
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
      className="h-full !p-4"
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
        aria-label={`${copy.actions}: ${formatCount(totalActions, locale)}. ${confidencePercent !== null ? `${copy.confidenceReference}: ${Math.round(confidencePercent)}%. ` : ''}${copy.priority}.`}
      >
        <ChartFrame minHeight={170} style={{ height: 170 }}>
          {({ width, height }) => (
            <ComposedChart
              width={Math.max(width, 1)}
              height={Math.max(height, 170)}
              data={chartData}
              margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(123, 93, 78, 0.14)" />
              <XAxis dataKey="horizon" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} width={34} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={38} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'priorityScore') {
                    return [value.toFixed(0), copy.priority];
                  }
                  return [formatCount(value, locale), copy.actions];
                }}
                contentStyle={{
                  backgroundColor: 'rgba(255, 251, 246, 0.98)',
                  border: '1px solid rgba(123, 93, 78, 0.12)',
                  borderRadius: '12px',
                  boxShadow: '0 12px 28px rgba(90, 64, 63, 0.10)',
                  fontSize: '12px',
                }}
              />
              <Bar yAxisId="left" dataKey="actionCount" name="actionCount" fill="var(--sg-color-terracotta)" radius={[8, 8, 2, 2]} maxBarSize={32} />
              <Line yAxisId="left" type="monotone" dataKey="priorityScore" name="priorityScore" stroke="var(--sg-color-primary)" strokeWidth={2.2} dot={false} isAnimationActive={false} />
              {confidencePercent !== null ? (
                <ReferenceLine
                  yAxisId="right"
                  y={confidencePercent}
                  stroke="var(--sg-color-olive)"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: `${copy.confidenceReference} ${Math.round(confidencePercent)}%`,
                    position: 'insideTopRight',
                    fill: 'var(--sg-color-olive)',
                    fontSize: 10,
                    fontWeight: 650,
                  }}
                />
              ) : null}
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
