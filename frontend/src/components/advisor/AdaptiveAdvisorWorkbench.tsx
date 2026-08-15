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
import { useAdaptiveAdvisor } from '../../hooks/useAdaptiveAdvisor';
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
  const { loading, result, error, execute } = useAdaptiveAdvisor();

  const dashboard = useMemo(() => {
    const timestamp = typeof currentData.timestamp === 'number'
      ? new Date(currentData.timestamp).toISOString()
      : new Date().toISOString();
    return {
      currentData: { ...currentData, datetime: timestamp },
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
    await execute({
      crop: crop.toLowerCase() as 'tomato' | 'cucumber',
      question: normalized,
      dashboard,
      language: locale,
      include_narrative: true,
    }).catch(() => undefined);
  };

  return (
    <section className="rounded-3xl border border-[color:var(--sg-border-soft)] bg-[color:var(--sg-surface-card)] p-5 shadow-[var(--sg-shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-accent-blue)]">
            Adaptive Advisor Graph v2
          </p>
          <h2 className="mt-1 text-xl font-bold text-[color:var(--sg-text-strong)]">
            {locale === 'ko'
              ? '상황에 맞춰 계산하고, 답변 자체도 다시 검증합니다'
              : 'Adaptive calculations with post-answer verification'}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {locale === 'ko'
              ? '전일 동시간 비교, 생리 모델, 전문가 지식, 날씨, 출하 일정, 시장 중 필요한 경로만 실행합니다. 최종 문장의 숫자와 필수 내용도 다시 검사하며, 실패하면 검증된 결정론적 답변으로 자동 교체합니다.'
              : 'Runs only the required same-time comparison, physiology, model, knowledge, weather, operations, and market lanes. Final numbers and required answer elements are reviewed, with a deterministic fallback on failure.'}
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
                {result.quality_profile.response.fallback_used && (
                  <span className="rounded-full bg-[color:var(--sg-accent-amber-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--sg-accent-amber)]">
                    {locale === 'ko' ? '안전 대체 답변' : 'Safe fallback'}
                  </span>
                )}
                <span className="rounded-full bg-[color:var(--sg-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--sg-text-muted)]">
                  {result.plan.intent}
                </span>
              </div>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[color:var(--sg-text-strong)]">
              {result.text}
            </p>
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
