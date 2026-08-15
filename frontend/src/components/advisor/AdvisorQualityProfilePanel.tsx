import type { AdaptiveQualityProfile } from '../../hooks/useAdaptiveAdvisor';

type Props = {
  profile: AdaptiveQualityProfile;
  locale: 'ko' | 'en';
};

const percent = (value: number) => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

const STATUS_LABELS: Record<AdaptiveQualityProfile['answer_status'], { ko: string; en: string }> = {
  OPERATIONAL: { ko: '운영 조치 가능', en: 'Operational' },
  CONDITIONAL: { ko: '조건부 답변', en: 'Conditional' },
  MONITORING_FIRST: { ko: '모니터링 우선', en: 'Monitoring first' },
  NEEDS_DATA: { ko: '추가 데이터 필요', en: 'Needs data' },
  REFUSED: { ko: '조치 수치 보류', en: 'Control value refused' },
};

const CAPABILITY_LABELS: Record<AdaptiveQualityProfile['capability'], { ko: string; en: string }> = {
  LIVE_STATUS: { ko: '실시간 상태', en: 'Live status' },
  DIAGNOSTIC: { ko: '상태 진단', en: 'Diagnostic' },
  MODEL_WHAT_IF: { ko: '모델 What-if', en: 'Model what-if' },
  OPERATIONAL_PLAN: { ko: '운영 계획', en: 'Operational plan' },
  CONSTRAINED_OPTIMIZATION: { ko: '제약조건 최적화', en: 'Constrained optimization' },
};

const CONTEXT_LABELS = {
  READY: { ko: '정상', en: 'Ready' },
  PARTIAL: { ko: '부분', en: 'Partial' },
  NO_MATCH: { ko: '검색 결과 없음', en: 'No match' },
  STALE: { ko: '오래됨', en: 'Stale' },
  UNAVAILABLE: { ko: '사용 불가', en: 'Unavailable' },
  NOT_REQUESTED: { ko: '미호출', en: 'Not requested' },
} as const;

function contextLabel(value: string, locale: 'ko' | 'en') {
  const label = CONTEXT_LABELS[value as keyof typeof CONTEXT_LABELS];
  return label?.[locale] ?? value;
}

export default function AdvisorQualityProfilePanel({ profile, locale }: Props) {
  const statusLabel = STATUS_LABELS[profile.answer_status][locale];
  const capabilityLabel = CAPABILITY_LABELS[profile.capability][locale];
  const validUntil = new Date(profile.horizon.valid_until);
  const validUntilLabel = Number.isNaN(validUntil.getTime())
    ? profile.horizon.valid_until
    : validUntil.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');

  const metrics = [
    {
      label: locale === 'ko' ? '센서 최신성' : 'Telemetry freshness',
      value: percent(profile.data.freshness),
    },
    {
      label: locale === 'ko' ? '현재 상태 충족도' : 'Current-state coverage',
      value: percent(profile.data.current_state_coverage),
    },
    {
      label: locale === 'ko' ? '최근 이력 충족도' : 'History coverage',
      value: percent(profile.data.history_coverage),
    },
    {
      label: locale === 'ko' ? '모델 적용 가능성' : 'Model applicability',
      value: percent(profile.model.applicability),
    },
  ];

  const contextRows = [
    [locale === 'ko' ? '전문가 지식' : 'Expert knowledge', profile.context.expert_knowledge],
    [locale === 'ko' ? '날씨' : 'Weather', profile.context.weather],
    [locale === 'ko' ? '운영 일정' : 'Operations', profile.context.operations],
    [locale === 'ko' ? '시장' : 'Market', profile.context.market],
  ] as const;

  return (
    <section
      aria-label={locale === 'ko' ? '답변 품질 프로필' : 'Answer quality profile'}
      className="rounded-2xl border border-[color:var(--sg-border-soft)] bg-white/90 p-4 shadow-[var(--sg-shadow-card)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-muted)]">
            {locale === 'ko' ? '적응형 답변 품질' : 'Adaptive answer quality'}
          </p>
          <h3 className="mt-1 text-lg font-bold text-[color:var(--sg-text-strong)]">
            {capabilityLabel}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[color:var(--sg-accent-blue-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-accent-blue)]">
            {statusLabel}
          </span>
          <span className="rounded-full bg-[color:var(--sg-accent-forest-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-accent-success)]">
            {percent(profile.score)}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl bg-[color:var(--sg-surface-muted)] p-3">
            <dt className="text-[11px] text-[color:var(--sg-text-muted)]">{metric.label}</dt>
            <dd className="mt-1 text-base font-bold text-[color:var(--sg-text-strong)]">{metric.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--sg-border-soft)] p-3">
          <p className="text-xs font-semibold text-[color:var(--sg-text-muted)]">
            {locale === 'ko' ? '호출 컨텍스트' : 'Context lanes'}
          </p>
          <dl className="mt-2 space-y-1.5">
            {contextRows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 text-sm">
                <dt className="text-[color:var(--sg-text-muted)]">{label}</dt>
                <dd className="font-semibold text-[color:var(--sg-text-strong)]">
                  {contextLabel(value, locale)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-[color:var(--sg-border-soft)] p-3">
          <p className="text-xs font-semibold text-[color:var(--sg-text-muted)]">
            {locale === 'ko' ? '유효성과 제약' : 'Validity and constraints'}
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[color:var(--sg-text-muted)]">
                {locale === 'ko' ? '제약조건' : 'Constraints'}
              </dt>
              <dd className="font-semibold text-[color:var(--sg-text-strong)]">
                {profile.model.constraint_status}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[color:var(--sg-text-muted)]">
                {locale === 'ko' ? '예측 범위' : 'Forecast horizon'}
              </dt>
              <dd className="font-semibold text-[color:var(--sg-text-strong)]">
                {profile.horizon.forecast_hours} h
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[color:var(--sg-text-muted)]">
                {locale === 'ko' ? '다시 계산 시각' : 'Recalculate by'}
              </dt>
              <dd className="text-right text-xs font-semibold text-[color:var(--sg-text-strong)]">
                {validUntilLabel}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {profile.data.missing_fields.length > 0 && (
        <p className="mt-3 text-xs text-[color:var(--sg-accent-amber)]">
          {locale === 'ko' ? '누락 데이터: ' : 'Missing data: '}
          {profile.data.missing_fields.join(', ')}
        </p>
      )}
    </section>
  );
}
