import { useMemo, useState, type FormEvent } from 'react';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../../types';
import {
  useAdaptiveAdvisor,
  type AdaptiveFeedbackIssue,
} from '../../hooks/useAdaptiveAdvisor';
import { buildAdaptiveHistoryPayload } from '../../utils/adaptiveHistory';
import { buildDashboardRecentSummary } from '../../utils/recentSummary';
import AdvisorQualityProfilePanel from './AdvisorQualityProfilePanel';

type Props = {
  locale: 'ko' | 'en';
  crop: CropType;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  forecast?: ForecastData | null;
  history?: SensorData[];
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
};

const EXAMPLES = {
  ko: [
    '오전 환경은 비슷한데 왜 광합성 속도가 어제보다 낮아졌지?',
    '다음 주 휴가라 출하가 없는데 온도와 수확 계획을 어떻게 조정할까?',
  ],
  en: [
    'Why is morning photosynthesis lower than yesterday under similar conditions?',
    'There is no shipment next week. How should temperature and harvest timing change?',
  ],
} as const;

const FEEDBACK_ISSUES: Array<{
  code: AdaptiveFeedbackIssue;
  ko: string;
  en: string;
}> = [
  { code: 'missing_cause', ko: '원인 설명 부족', en: 'Missing cause' },
  { code: 'vague_action', ko: '조치가 모호함', en: 'Vague action' },
  { code: 'wrong_number', ko: '수치가 맞지 않음', en: 'Wrong number' },
  { code: 'missing_context', ko: '상황 반영 부족', en: 'Missing context' },
  { code: 'too_verbose', ko: '너무 장황함', en: 'Too verbose' },
  { code: 'wrong_route', ko: '계산 경로가 부적절함', en: 'Wrong route' },
];

export default function AdaptiveAdvisorWorkbench({
  locale,
  crop,
  currentData,
  metrics,
  forecast = null,
  history = [],
  producePrices = null,
  weather = null,
  rtrProfile = null,
}: Props) {
  const [question, setQuestion] = useState<string>(EXAMPLES[locale][0]);
  const [feedbackIssues, setFeedbackIssues] = useState<AdaptiveFeedbackIssue[]>([]);
  const [feedbackState, setFeedbackState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { loading, result, error, execute, submitFeedback } = useAdaptiveAdvisor();

  const dashboard = useMemo(() => {
    const timestamp = typeof currentData.timestamp === 'number'
      ? new Date(currentData.timestamp).toISOString()
      : new Date().toISOString();
    return {
      currentData: { ...currentData, datetime: timestamp },
      // This history is only a request-local fallback. The adaptive backend first
      // queries its server-owned telemetry store for the previous-day baseline.
      history: buildAdaptiveHistoryPayload(currentData, history),
      metrics,
      forecast,
      recentSummary: buildDashboardRecentSummary(currentData, history),
      market: producePrices,
      weather,
      rtr: rtrProfile ? { profile: rtrProfile } : null,
    };
  }, [currentData, forecast, history, metrics, producePrices, rtrProfile, weather]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = question.trim();
    if (!normalized || loading) return;
    setFeedbackIssues([]);
    setFeedbackState('idle');
    await execute({
      crop: crop.toLowerCase() as 'tomato' | 'cucumber',
      question: normalized,
      dashboard,
      language: locale,
      include_narrative: true,
    }).catch(() => undefined);
  };

  const saveFeedback = async (helpful: boolean) => {
    if (!result || feedbackState === 'saving') return;
    setFeedbackState('saving');
    try {
      await submitFeedback({
        run_id: result.run_id,
        helpful,
        issue_codes: helpful ? [] : feedbackIssues,
      });
      setFeedbackState('saved');
    } catch {
      setFeedbackState('error');
    }
  };

  const toggleIssue = (issue: AdaptiveFeedbackIssue) => {
    setFeedbackIssues((previous) => (
      previous.includes(issue)
        ? previous.filter((value) => value !== issue)
        : [...previous, issue]
    ));
  };

  return (
    <section className="rounded-3xl border border-[color:var(--sg-border-soft)] bg-[color:var(--sg-surface-card)] p-5 shadow-[var(--sg-shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-accent-blue)]">
            Adaptive Advisor Graph v3
          </p>
          <h2 className="mt-1 text-xl font-bold text-[color:var(--sg-text-strong)]">
            {locale === 'ko'
              ? '서버 이력·반입 충격·실제 결과로 답변 경로를 개선합니다'
              : 'Server history, supply shocks, and outcome-informed routing'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {locale === 'ko'
              ? '브라우저가 보유한 짧은 이력보다 서버 시계열을 우선하고, 휴일 뒤 반입 집중과 가격 압력을 범위형 시나리오로 계산합니다. 답변 평가는 특정 실행 ID에 축적되어 오프라인 라우팅 회귀평가에 사용됩니다.'
              : 'Prioritizes server-owned telemetry, estimates post-holiday arrival concentration and bounded price pressure, and links feedback to an immutable run for offline routing regression.'}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5">
        <label className="sr-only" htmlFor="adaptive-advisor-question">
          {locale === 'ko' ? '적응형 상담 질문' : 'Adaptive advisor question'}
        </label>
        <textarea
          id="adaptive-advisor-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          className="w-full resize-y rounded-2xl border border-[color:var(--sg-border-soft)] bg-white px-4 py-3 text-sm leading-6 text-[color:var(--sg-text-strong)] outline-none transition focus:border-[color:var(--sg-accent-blue)] focus:ring-2 focus:ring-[color:var(--sg-accent-blue-soft)]"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {EXAMPLES[locale].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setQuestion(example)}
                className="rounded-full border border-[color:var(--sg-border-soft)] bg-white px-3 py-1.5 text-xs text-[color:var(--sg-text-muted)] hover:border-[color:var(--sg-accent-blue)]"
              >
                {example}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-xl bg-[color:var(--sg-accent-blue)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? (locale === 'ko' ? '적응형 계산·검증 중...' : 'Calculating and reviewing...')
              : (locale === 'ko' ? '적응형 분석 실행' : 'Run adaptive analysis')}
          </button>
        </div>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-[color:var(--sg-status-offline-bg)] p-3 text-sm text-[color:var(--sg-status-offline-text)]"
        >
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 space-y-4">
          <AdvisorQualityProfilePanel profile={result.quality_profile} locale={locale} />

          <div className="rounded-2xl border border-[color:var(--sg-border-soft)] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-[color:var(--sg-text-strong)]">
                {locale === 'ko' ? '검증된 적응형 답변' : 'Reviewed adaptive answer'}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[color:var(--sg-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                  {result.plan.intent}
                </span>
                <span className="rounded-full bg-[color:var(--sg-accent-blue-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--sg-accent-blue)]">
                  {locale === 'ko' ? '서버 시계열 우선' : 'Server history first'}
                </span>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[color:var(--sg-text-strong)]">
              {result.text}
            </p>
          </div>

          {(result.answer_packet.causal_drivers.length > 0
            || result.answer_packet.actions.length > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-[color:var(--sg-border-soft)] bg-white p-4">
                <h3 className="text-sm font-bold text-[color:var(--sg-text-strong)]">
                  {locale === 'ko' ? '원인 우선순위' : 'Ranked drivers'}
                </h3>
                <ol className="mt-3 space-y-2">
                  {result.answer_packet.causal_drivers.slice(0, 4).map((driver, index) => (
                    <li key={driver.code} className="text-sm text-[color:var(--sg-text-muted)]">
                      <span className="font-semibold text-[color:var(--sg-text-strong)]">
                        {index + 1}. {driver.label}
                      </span>
                      <span className="ml-2 text-xs">{Math.round(driver.support * 100)}%</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-2xl border border-[color:var(--sg-border-soft)] bg-white p-4">
                <h3 className="text-sm font-bold text-[color:var(--sg-text-strong)]">
                  {locale === 'ko' ? '실행 순서' : 'Action sequence'}
                </h3>
                <ol className="mt-3 space-y-2">
                  {result.answer_packet.actions.slice(0, 4).map((action) => (
                    <li key={`${action.rank}-${action.title}`} className="text-sm">
                      <p className="font-semibold text-[color:var(--sg-text-strong)]">
                        {action.rank}. [{action.time_window}] {action.title}
                      </p>
                      <p className="text-[color:var(--sg-text-muted)]">{action.operator}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[color:var(--sg-border-soft)] bg-white p-4">
            <h3 className="text-sm font-bold text-[color:var(--sg-text-strong)]">
              {locale === 'ko' ? '이 답변이 도움이 되었나요?' : 'Was this answer useful?'}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={feedbackState === 'saving' || feedbackState === 'saved'}
                onClick={() => saveFeedback(true)}
                className="rounded-xl border border-[color:var(--sg-border-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--sg-accent-success)] disabled:opacity-50"
              >
                {locale === 'ko' ? '도움 됨' : 'Helpful'}
              </button>
              <button
                type="button"
                disabled={feedbackState === 'saving' || feedbackState === 'saved'}
                onClick={() => saveFeedback(false)}
                className="rounded-xl border border-[color:var(--sg-border-soft)] px-3 py-2 text-sm font-semibold text-[color:var(--sg-accent-amber)] disabled:opacity-50"
              >
                {locale === 'ko' ? '개선 필요' : 'Needs improvement'}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FEEDBACK_ISSUES.map((issue) => (
                <button
                  key={issue.code}
                  type="button"
                  aria-pressed={feedbackIssues.includes(issue.code)}
                  onClick={() => toggleIssue(issue.code)}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    feedbackIssues.includes(issue.code)
                      ? 'border-[color:var(--sg-accent-amber)] bg-[color:var(--sg-accent-amber-soft)] text-[color:var(--sg-accent-amber)]'
                      : 'border-[color:var(--sg-border-soft)] text-[color:var(--sg-text-muted)]'
                  }`}
                >
                  {issue[locale]}
                </button>
              ))}
            </div>
            {feedbackState !== 'idle' && (
              <p className="mt-3 text-xs text-[color:var(--sg-text-muted)]">
                {feedbackState === 'saving'
                  ? (locale === 'ko' ? '평가 저장 중...' : 'Saving feedback...')
                  : feedbackState === 'saved'
                    ? (locale === 'ko' ? '평가가 실행 ID에 저장되었습니다.' : 'Feedback was linked to this run.')
                    : (locale === 'ko' ? '평가 저장에 실패했습니다.' : 'Feedback could not be saved.')}
              </p>
            )}
          </div>

          <details className="rounded-2xl border border-[color:var(--sg-border-soft)] bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[color:var(--sg-text-strong)]">
              {locale === 'ko' ? '이번 답변의 실행·검증 경로' : 'Execution and review path'}
            </summary>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {result.trace.map((item, index) => (
                <li
                  key={`${item.node}-${index}`}
                  className="rounded-xl bg-[color:var(--sg-surface-muted)] p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[color:var(--sg-text-strong)]">
                      {index + 1}. {item.node}
                    </span>
                    <span className="text-[color:var(--sg-text-muted)]">
                      {item.duration_ms.toFixed(1)} ms
                    </span>
                  </div>
                  <p className="mt-1 text-[color:var(--sg-text-muted)]">{item.summary}</p>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
    </section>
  );
}
