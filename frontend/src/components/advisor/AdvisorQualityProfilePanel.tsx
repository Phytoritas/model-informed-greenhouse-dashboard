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
  NO_MATCH: { ko: '확인된 정보 없음', en: 'No confirmed context' },
  STALE: { ko: '오래됨', en: 'Stale' },
  UNAVAILABLE: { ko: '사용 불가', en: 'Unavailable' },
  NOT_REQUESTED: { ko: '미호출', en: 'Not requested' },
} as const;

const RESPONSE_SOURCE_LABELS: Record<
  AdaptiveQualityProfile['response']['source'],
  { ko: string; en: string }
> = {
  llm: { ko: '검증된 LLM 서술', en: 'Reviewed LLM narrative' },
  deterministic_fallback: { ko: '검증된 결정론적 대체 답변', en: 'Reviewed deterministic fallback' },
  deterministic_only: { ko: '결정론적 답변', en: 'Deterministic answer' },
};

const GAP_LABELS: Record<string, { ko: string; en: string }> = {
  mechanism_explanation_shallow: {
    ko: '원인 메커니즘 설명이 얕습니다.',
    en: 'The causal mechanism is shallow.',
  },
  ranked_hypothesis_missing: {
    ko: '가능한 원인의 우선순위가 부족합니다.',
    en: 'Ranked causal hypotheses are missing.',
  },
  temporal_baseline_missing: {
    ko: '비교할 전일 동시간 기준선이 없습니다.',
    en: 'The same-time previous-day baseline is missing.',
  },
  action_plan_incomplete: {
    ko: '실행 조치·기대 효과·재검토 조건이 완전하지 않습니다.',
    en: 'Action, expected effect, or recheck condition is incomplete.',
  },
  operations_market_join_incomplete: {
    ko: '출하 일정과 시장 신호를 함께 검증하지 못했습니다.',
    en: 'Operations and market context were not jointly verified.',
  },
  unregistered_operator_assumption: {
    ko: '질문에 포함된 운영 가정이 등록 일정에서 확인되지 않았습니다.',
    en: 'An operator-stated assumption is not registered in operations data.',
  },
  exact_model_request_unresolved: {
    ko: '요청한 조정량과 정확히 일치하는 모델 계산이 없습니다.',
    en: 'No exact model calculation matches the requested control change.',
  },
  exact_model_request_out_of_range: {
    ko: '요청한 조정량이 모델 유효 범위를 벗어났습니다.',
    en: 'The requested change is outside the model validity range.',
  },
  model_inputs_inferred: {
    ko: '일부 모델 입력이 관측값이 아니라 추론값입니다.',
    en: 'Some model inputs are inferred rather than observed.',
  },
  response_element_missing: {
    ko: '최종 답변에 필수 요소가 빠져 검증된 대체 답변을 사용했습니다.',
    en: 'Required response elements were missing, so a reviewed fallback was used.',
  },
  unsupported_numeric_claim: {
    ko: '지원되지 않는 수치가 감지되어 검증된 대체 답변을 사용했습니다.',
    en: 'An unsupported number was detected, so a reviewed fallback was used.',
  },
};

function contextLabel(value: string, locale: 'ko' | 'en') {
  const label = CONTEXT_LABELS[value as keyof typeof CONTEXT_LABELS];
  return label?.[locale] ?? value;
}

function gapLabel(value: string, locale: 'ko' | 'en') {
  return GAP_LABELS[value]?.[locale] ?? value;
}

function toneClass(value: number) {
  if (value >= 0.8) {
    return 'text-[color:var(--sg-accent-success)]';
  }
  if (value >= 0.55) {
    return 'text-[color:var(--sg-accent-amber)]';
  }
  return 'text-[color:var(--sg-status-offline-text)]';
}

export default function AdvisorQualityProfilePanel({ profile, locale }: Props) {
  const statusLabel = STATUS_LABELS[profile.answer_status][locale];
  const capabilityLabel = CAPABILITY_LABELS[profile.capability][locale];
  const validUntil = new Date(profile.horizon.valid_until);
  const validUntilLabel = Number.isNaN(validUntil.getTime())
    ? profile.horizon.valid_until
    : validUntil.toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US');
  const sourceLabel = RESPONSE_SOURCE_LABELS[profile.response.source][locale];

  const deliveryMetrics = [
    {
      label: locale === 'ko' ? '전달 답변 품질' : 'Delivered-answer quality',
      value: profile.score,
    },
    {
      label: locale === 'ko' ? '입력 준비도' : 'Input readiness',
      value: profile.readiness_score,
    },
    {
      label: locale === 'ko' ? '필수 내용 충족도' : 'Required-content coverage',
      value: profile.response.coverage,
    },
    {
      label: locale === 'ko' ? '모델 실측 입력 비율' : 'Observed model inputs',
      value: profile.model.observed_input_fraction ?? profile.data.observed_signal_score ?? 0,
    },
  ];

  const contentMetrics = [
    {
      label: locale === 'ko' ? '원인 진단 깊이' : 'Diagnostic depth',
      value: profile.content.diagnostic_depth,
    },
    {
      label: locale === 'ko' ? '실행 가능성' : 'Actionability',
      value: profile.content.actionability,
    },
    {
      label: locale === 'ko' ? '시간 비교 적합성' : 'Temporal alignment',
      value: profile.content.temporal_alignment,
    },
    {
      label: locale === 'ko' ? '운영·시장 통합' : 'Cross-domain synthesis',
      value: profile.content.cross_domain_synthesis,
    },
    {
      label: locale === 'ko' ? '수치 무결성' : 'Numerical integrity',
      value: profile.content.numerical_integrity,
    },
    {
      label: locale === 'ko' ? '불확실성 정직성' : 'Uncertainty honesty',
      value: profile.content.uncertainty_honesty,
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-muted)]">
            {locale === 'ko' ? '실제 전달 답변 품질' : 'Delivered answer quality'}
          </p>
          <h3 className="mt-1 text-lg font-bold text-[color:var(--sg-text-strong)]">
            {capabilityLabel}
          </h3>
          <p className="mt-1 text-xs text-[color:var(--sg-text-muted)]">
            {sourceLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {profile.response.fallback_used && (
            <span className="rounded-full bg-[color:var(--sg-accent-amber-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-accent-amber)]">
              {locale === 'ko' ? 'LLM 답변 자동 교체' : 'LLM answer replaced'}
            </span>
          )}
          <span className="rounded-full bg-[color:var(--sg-accent-blue-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-accent-blue)]">
            {statusLabel}
          </span>
          <span className="rounded-full bg-[color:var(--sg-accent-forest-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-accent-success)]">
            {percent(profile.score)}
          </span>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {deliveryMetrics.map((metric) => (
          <div key={metric.label} className="rounded-xl bg-[color:var(--sg-surface-muted)] p-3">
            <dt className="text-[11px] text-[color:var(--sg-text-muted)]">{metric.label}</dt>
            <dd className={`mt-1 text-base font-bold ${toneClass(metric.value)}`}>
              {percent(metric.value)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-xl border border-[color:var(--sg-border-soft)] p-3">
        <p className="text-xs font-semibold text-[color:var(--sg-text-muted)]">
          {locale === 'ko' ? '답변 구성 품질' : 'Answer-content dimensions'}
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contentMetrics.map((metric) => (
            <div key={metric.label}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <dt className="text-[color:var(--sg-text-muted)]">{metric.label}</dt>
                <dd className={`font-semibold ${toneClass(metric.value)}`}>
                  {percent(metric.value)}
                </dd>
              </div>
              <div
                aria-hidden="true"
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--sg-surface-muted)]"
              >
                <div
                  className="h-full rounded-full bg-current text-[color:var(--sg-accent-blue)]"
                  style={{ width: percent(metric.value) }}
                />
              </div>
            </div>
          ))}
        </dl>
      </div>

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
            {locale === 'ko' ? '유효성과 모델 경계' : 'Validity and model boundary'}
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
                {locale === 'ko' ? '추론 모델 입력' : 'Inferred model inputs'}
              </dt>
              <dd className="font-semibold text-[color:var(--sg-text-strong)]">
                {profile.model.inferred_input_count}
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

      {profile.content.gaps.length > 0 && (
        <div className="mt-3 rounded-xl bg-[color:var(--sg-accent-amber-soft)] p-3">
          <p className="text-xs font-semibold text-[color:var(--sg-accent-amber)]">
            {locale === 'ko' ? '현재 답변의 한계' : 'Current answer limitations'}
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-[color:var(--sg-text-strong)]">
            {profile.content.gaps.map((gap) => (
              <li key={gap}>• {gapLabel(gap, locale)}</li>
            ))}
          </ul>
        </div>
      )}

      {profile.response.unsupported_numeric_claims.length > 0 && (
        <p className="mt-3 text-xs text-[color:var(--sg-status-offline-text)]">
          {locale === 'ko' ? '차단된 미지원 수치: ' : 'Blocked unsupported numbers: '}
          {profile.response.unsupported_numeric_claims.join(', ')}
        </p>
      )}

      {profile.data.missing_fields.length > 0 && (
        <p className="mt-3 text-xs text-[color:var(--sg-accent-amber)]">
          {locale === 'ko' ? '누락 데이터: ' : 'Missing data: '}
          {profile.data.missing_fields.join(', ')}
        </p>
      )}
    </section>
  );
}
