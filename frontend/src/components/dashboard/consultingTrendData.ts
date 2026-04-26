export interface ConsultingPoint {
  horizon: string;
  actionCount: number;
  priorityScore: number;
}

interface BuildConsultingPointsOptions {
  nowLabel: string;
  todayLabel: string;
  weekLabel: string;
  actionsNowCount: number;
  actionsTodayCount: number;
  actionsWeekCount: number;
}

export function buildConsultingPoints({
  nowLabel,
  todayLabel,
  weekLabel,
  actionsNowCount,
  actionsTodayCount,
  actionsWeekCount,
}: BuildConsultingPointsOptions): ConsultingPoint[] {
  return [
    { horizon: nowLabel, actionCount: actionsNowCount, weight: 3 },
    { horizon: todayLabel, actionCount: actionsTodayCount, weight: 2 },
    { horizon: weekLabel, actionCount: actionsWeekCount, weight: 1 },
  ].map((bucket) => ({
    horizon: bucket.horizon,
    actionCount: bucket.actionCount,
    priorityScore: bucket.actionCount * bucket.weight,
  }));
}
