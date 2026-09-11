import { useCallback, useId, useMemo, useState } from 'react';
import type { CropType, SensorData, TelemetryStatus } from '../../types';
import { useLocale } from '../../i18n/LocaleProvider';
import { formatLocaleDateTime } from '../../i18n/locale';
import { Button } from '../ui/button';
import { SectionHeader } from '../ui/section-header';
import { StatusChip } from '../ui/status-chip';
import {
  buildFieldDecisions,
  getSubstrateDemoScenarios,
  type FieldDecision,
  type FieldObservations,
  type ObservationKey,
  type SubstrateDemoId,
} from '../../utils/fieldDecisionSupport';
import '../../styles/field-decision-board.css';

/** Water keys the substrate demo supplies. Switching preset clears exactly these,
 *  so a fixture change is visible instead of being masked by an earlier answer. */
const DEMO_WATER_KEYS: ObservationKey[] = ['wilting', 'delivery', 'rootMoisture'];

const PRIORITY_TONE: Record<FieldDecision['priority'], 'critical' | 'warning' | 'stable' | 'muted'> = {
  first: 'critical',
  today: 'warning',
  observe: 'stable',
  data: 'muted',
};

export interface FieldDecisionBoardProps {
  crop: CropType;
  currentData: SensorData;
  /** Accepted for caller compatibility. Every card comes from the decision engine,
   *  so advisor text for one topic can never justify another. */
  modelMetrics?: unknown;
  actionsNow?: string[];
  actionsToday?: string[];
  monitor?: string[];
  onOpenRtr: () => void;
  onOpenAdvisor: () => void;
  rtrDeltaC?: number;
  rtrToleranceC?: number;
  /** Hours covered by the light and mean-temperature comparison window. */
  rtrWindowHours?: number;
  /** Whether that window's history is complete and valid, as judged by the route. */
  rtrWindowUsable?: boolean;
  telemetryStatus?: TelemetryStatus;
  /** Wall-clock time the reading reached the browser. */
  receivedAtTimestamp?: number | null;
  /** Simulated clock of the displayed frame, labelled as simulation time, never as now. */
  simulatedTimestamp?: number | null;
  /** Narrow column beside the greenhouse view: two cards open, the rest one click away. */
  compact?: boolean;
}

function boardCopy(locale: 'ko' | 'en') {
  const ko = locale === 'ko';
  return {
    eyebrow: ko ? '오늘의 관리' : 'Today',
    title: ko ? '지금 확인할 일' : 'What to check now',
    description: ko
      ? '상황별로 확인할 이유, 현장에서 확인할 항목, 그 다음 행동을 봅니다.'
      : 'For each situation: why it is showing, what to confirm in the crop, and what to do next.',
    priority: {
      first: ko ? '먼저 확인' : 'Check first',
      today: ko ? '오늘 확인' : 'Check today',
      observe: ko ? '관찰' : 'Observe',
      data: ko ? '데이터 확인' : 'Confirm data',
    } satisfies Record<FieldDecision['priority'], string>,
    reasonLabel: ko ? '왜' : 'Why',
    confirmLabel: ko ? '현장에서 확인할 것' : 'Confirm in the crop',
    actionLabel: ko ? '확인 후 행동' : 'Action after confirming',
    recheckLabel: ko ? '다시 볼 것' : 'Check afterwards',
    limitLabel: ko ? '적용 한계' : 'Applies only so far',
    basisLabel: ko ? '근거 자료' : 'Basis',
    observeSummary: ko ? '확인할 항목·현장 입력' : 'What to confirm and enter',
    evidenceSummary: ko ? '근거와 적용 범위' : 'Sources and scope',
    openAdvisor: ko ? '상담으로 보기' : 'Open advisor',
    openRtr: ko ? '광·온도 비교 열기' : 'Open light and temperature view',
    more: (n: number) => (ko ? '나머지 ' + n + '개 상황 보기' : 'Show ' + n + ' more'),
    less: ko ? '접기' : 'Show less',
    demoLabel: ko ? '배지 상태' : 'Substrate conditions',
    demoBadge: ko ? '예시' : 'Example',
    demoHint: ko ? '수치는 예시이며 실측이 아닙니다.' : 'Values are illustrative, not measurements.',
    demoEdited: ko ? '직접 입력한 조건 적용 중' : 'Manually entered conditions applied',
    answeredAt: (value: string) => (ko ? '현장 입력 ' + value : 'Entered ' + value),
    clearAnswers: ko ? '입력 지우기' : 'Clear entries',
    simulatedAt: (value: string) => (ko ? '시뮬레이션 시각 ' + value : 'Simulated time ' + value),
    receivedAt: (value: string) => (ko ? '화면 갱신 ' + value : 'Screen updated ' + value),
    replayNote: ko
      ? '표시 자료는 시뮬레이션 자료입니다. 실시간 센서 측정이 아니며 장비를 제어하지 않습니다.'
      : 'The displayed data are simulation output. They are not live sensor measurements and control no equipment.',
    sessionNote: ko
      ? '입력한 확인 사항은 이 화면에서만 유지됩니다.'
      : 'Entered observations are kept on this screen only.',
  };
}

/**
 * The six situation cards under the "what to check now" heading.
 *
 * Entries live only in this screen session: they are React state, never written to
 * storage, and the keyed wrapper below drops them when the crop or the simulated
 * calendar date changes. Unanswered questions stay explicitly unknown, so a skipped
 * option is never read as an observation.
 */
export function FieldDecisionBoard(props: FieldDecisionBoardProps) {
  // Reset on a different crop or a different simulated day. The key holds the date
  // only, so an ordinary frame tick cannot wipe what the grower just entered. The day
  // comes from the local calendar the screen actually shows: a KST early-morning frame
  // would otherwise fall on the previous UTC date and reset entries mid-morning.
  const simulatedDay = typeof props.simulatedTimestamp === 'number' && Number.isFinite(props.simulatedTimestamp)
    ? localCalendarDay(props.simulatedTimestamp)
    : 'no-frame';

  return <FieldDecisionBoardSession key={props.crop + '-' + simulatedDay} {...props} />;
}

/** The displayed calendar day, in the same timezone as the rendered timestamps. */
function localCalendarDay(timestamp: number): string {
  const date = new Date(timestamp);
  return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
}

function FieldDecisionBoardSession({
  crop,
  currentData,
  onOpenRtr,
  onOpenAdvisor,
  rtrDeltaC,
  rtrToleranceC,
  rtrWindowHours,
  rtrWindowUsable,
  telemetryStatus = 'live',
  receivedAtTimestamp = null,
  simulatedTimestamp = null,
  compact = false,
}: FieldDecisionBoardProps) {
  const { locale } = useLocale();
  const copy = boardCopy(locale);
  const [showAll, setShowAll] = useState(false);
  const [observations, setObservations] = useState<FieldObservations>({});
  const [answeredAt, setAnsweredAt] = useState<number | null>(null);
  const [substrateDemo, setSubstrateDemo] = useState<SubstrateDemoId>('balanced');

  const demoScenarios = useMemo(() => getSubstrateDemoScenarios(locale), [locale]);
  const activeDemo = demoScenarios.find((row) => row.id === substrateDemo && row.id !== 'off') ?? null;
  const demoEdited = activeDemo !== null && DEMO_WATER_KEYS.some((key) => observations[key] !== undefined);

  const decisions = buildFieldDecisions({
    crop,
    currentData,
    telemetryStatus,
    rtrDeltaC,
    rtrToleranceC,
    rtrWindowHours,
    rtrWindowUsable,
    observations,
    substrateDemo,
    locale,
  });

  const answer = useCallback((key: ObservationKey, value: string) => {
    setObservations((current) => ({ ...current, [key]: value }));
    setAnsweredAt(Date.now());
  }, []);

  // A new preset drops the water answers that would otherwise mask it, and keeps
  // observations for the other situations, which the fixture says nothing about.
  const selectDemo = useCallback((next: SubstrateDemoId) => {
    const remaining = { ...observations };
    for (const key of DEMO_WATER_KEYS) {
      delete remaining[key];
    }
    setSubstrateDemo(next);
    setObservations(remaining);
    // With the last entry gone, the "entered at" time no longer describes anything on
    // screen, so it is dropped rather than left pointing at cleared answers.
    if (Object.keys(remaining).length === 0) {
      setAnsweredAt(null);
    }
  }, [observations]);

  const clearAnswers = useCallback(() => {
    setObservations({});
    setAnsweredAt(null);
  }, []);

  // An explicit "not checked yet" is itself an entry: it overrides the demo fixture,
  // so clearing must stay available after a grower sets every answer back to unknown.
  const hasAnswers = Object.keys(observations).length > 0;

  // Urgency leads. When nothing urgent fills both slots, the substrate demo card
  // joins the compact view so the selected fixture stays reviewable.
  const visible = useMemo(() => {
    if (!compact || showAll || decisions.length <= 2) {
      return decisions;
    }
    const top = decisions.slice(0, 2);
    if (!activeDemo || top.every((row) => row.priority === 'first') || top.some((row) => row.id === 'water')) {
      return top;
    }
    const water = decisions.find((row) => row.id === 'water');
    return water ? [top[0], water] : top;
  }, [compact, showAll, decisions, activeDemo]);

  const hiddenCount = decisions.length - visible.length;
  const counts = decisions.reduce<Record<FieldDecision['priority'], number>>(
    (acc, row) => ({ ...acc, [row.priority]: acc[row.priority] + 1 }),
    { first: 0, today: 0, observe: 0, data: 0 },
  );

  const timeLabels = [
    typeof simulatedTimestamp === 'number' && Number.isFinite(simulatedTimestamp)
      ? copy.simulatedAt(formatLocaleDateTime(locale, simulatedTimestamp, {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      }))
      : null,
    typeof receivedAtTimestamp === 'number' && Number.isFinite(receivedAtTimestamp)
      ? copy.receivedAt(formatLocaleDateTime(locale, receivedAtTimestamp, { hour: '2-digit', minute: '2-digit' }))
      : null,
    answeredAt !== null
      ? copy.answeredAt(formatLocaleDateTime(locale, answeredAt, { hour: '2-digit', minute: '2-digit' }))
      : null,
  ].filter((label): label is string => label !== null);

  return (
    <section
      id="today-action-board"
      tabIndex={-1}
      className={'field-decision-board' + (compact ? ' field-decision-board--compact' : '')}
      aria-labelledby="today-action-board-title"
    >
      <SectionHeader
        density="compact"
        titleId="today-action-board-title"
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        actions={(
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {counts.first > 0 ? <StatusChip tone="critical">{copy.priority.first + ' ' + counts.first}</StatusChip> : null}
            {counts.today > 0 ? <StatusChip tone="warning">{copy.priority.today + ' ' + counts.today}</StatusChip> : null}
            {counts.data > 0 ? <StatusChip tone="muted">{copy.priority.data + ' ' + counts.data}</StatusChip> : null}
          </div>
        )}
      />

      {timeLabels.length || hasAnswers ? (
        <div className="field-decision-answer-state">
          {timeLabels.length ? (
            <p className="field-decision-meta">
              {timeLabels.map((label) => <span key={label}>{label}</span>)}
            </p>
          ) : null}
          {hasAnswers ? (
            <Button variant="tonal" size="sm" className="min-h-10 px-3 text-xs" onClick={clearAnswers}>
              {copy.clearAnswers}
            </Button>
          ) : null}
        </div>
      ) : null}

      <SubstrateDemoPicker
        label={copy.demoLabel}
        badge={copy.demoBadge}
        hint={copy.demoHint}
        editedNote={demoEdited ? copy.demoEdited : null}
        scenarios={demoScenarios}
        selected={substrateDemo}
        onSelect={selectDemo}
      />

      <div className="field-decision-grid">
        {visible.map((decision) => (
          <DecisionCard
            key={decision.id}
            decision={decision}
            copy={copy}
            observations={observations}
            demoObservations={decision.id === 'water' ? activeDemo?.observations ?? null : null}
            demoBadge={decision.id === 'water' && activeDemo ? copy.demoBadge : null}
            onAnswer={answer}
            onOpen={decision.destination === 'rtr' ? onOpenRtr : onOpenAdvisor}
          />
        ))}
      </div>

      {compact && decisions.length > 2 ? (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          aria-expanded={showAll}
          className="inline-flex min-h-10 items-center gap-1 self-start text-sm font-semibold text-[color:var(--sg-color-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
        >
          {showAll ? copy.less : copy.more(hiddenCount)}
        </button>
      ) : null}

      <p className="field-decision-note">{copy.replayNote}</p>
      <p className="field-decision-note">{copy.sessionNote}</p>
    </section>
  );
}

function SubstrateDemoPicker({
  label,
  badge,
  hint,
  editedNote,
  scenarios,
  selected,
  onSelect,
}: {
  label: string;
  badge: string;
  hint: string;
  editedNote: string | null;
  scenarios: ReturnType<typeof getSubstrateDemoScenarios>;
  selected: SubstrateDemoId;
  onSelect: (next: SubstrateDemoId) => void;
}) {
  const selectId = useId();
  const active = scenarios.find((row) => row.id === selected && row.id !== 'off') ?? null;
  // Once entries override the fixture, its delivery and wilting claims are no longer
  // what the card is judging, so only the demo label and caveat remain.
  const summary = editedNote
    ? editedNote + ' · ' + hint
    : active
      ? active.summary + ' · ' + hint
      : scenarios[scenarios.length - 1]?.summary ?? hint;

  return (
    <div className="field-decision-demo">
      <label className="field-decision-demo-label" htmlFor={selectId}>
        <StatusChip tone="muted">{badge}</StatusChip>
        {label}
      </label>
      <select
        id={selectId}
        value={selected}
        onChange={(event) => onSelect(event.target.value as SubstrateDemoId)}
        className="min-h-11 rounded-[var(--sg-radius-xs)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] px-3 py-2 text-sm text-[color:var(--sg-text-strong)]"
      >
        {scenarios.map((row) => (
          <option key={row.id} value={row.id}>{row.label}</option>
        ))}
      </select>
      <p className="field-decision-demo-summary">{summary}</p>
    </div>
  );
}

function DecisionCard({
  decision,
  copy,
  observations,
  demoObservations,
  demoBadge,
  onAnswer,
  onOpen,
}: {
  decision: FieldDecision;
  copy: ReturnType<typeof boardCopy>;
  observations: FieldObservations;
  demoObservations: FieldObservations | null;
  demoBadge: string | null;
  onAnswer: (key: ObservationKey, value: string) => void;
  onOpen: () => void;
}) {
  return (
    <article className={'field-decision-card field-decision-card--' + decision.priority}>
      <div className="field-decision-card-head">
        <h3 className="field-decision-card-title">{decision.title}</h3>
        <div className="field-decision-chip-group">
          {demoBadge ? <StatusChip tone="muted">{demoBadge}</StatusChip> : null}
          <StatusChip tone={PRIORITY_TONE[decision.priority]}>{copy.priority[decision.priority]}</StatusChip>
        </div>
      </div>

      <p className="field-decision-reason">{decision.reason}</p>

      <dl className="field-decision-rows">
        <div>
          <dt>{copy.actionLabel}</dt>
          <dd className="field-decision-action">{decision.action}</dd>
        </div>
        <div>
          <dt>{copy.recheckLabel}</dt>
          <dd>{decision.recheck}</dd>
        </div>
      </dl>

      <p className="field-decision-basis">{copy.basisLabel + ': ' + decision.basis}</p>

      <details className="field-decision-disclosure">
        <summary>{copy.observeSummary}</summary>
        {/* The confirmations lead: they are what the entries below are answering. */}
        <div className="field-decision-confirm">
          <p className="field-decision-confirm-label">{copy.confirmLabel}</p>
          <ul className="field-decision-confirm-list">
            {decision.confirm.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="field-decision-questions">
          {decision.questions.map((question) => (
            <QuestionField
              key={question.key}
              question={question}
              value={observations[question.key] ?? demoObservations?.[question.key] ?? 'unknown'}
              onAnswer={onAnswer}
            />
          ))}
        </div>
      </details>

      <details className="field-decision-disclosure">
        <summary>{copy.evidenceSummary}</summary>
        {/* The scope limit sits with the sources, so the card is not a stack of
            caveats while the boundary stays one click from the action. */}
        <div className="field-decision-limit">
          <p className="field-decision-confirm-label">{copy.limitLabel}</p>
          <p className="field-decision-limit-text">{decision.limit}</p>
        </div>
        {decision.evidence.length ? (
          <ul className="field-decision-evidence-list">
            {decision.evidence.map((source) => (
              <li key={source.id} className="field-decision-evidence-item">
                <span className="field-decision-evidence-title">{source.title}</span>
                <p className="field-decision-evidence-claim">{source.claim}</p>
                <span className="field-decision-evidence-locator">
                  {/* Only publicly reachable sources become links; consultation records
                      stay as a plain locator so nothing points at a private path. */}
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">{source.locator}</a>
                  ) : source.locator}
                </span>
                {source.limits.length ? (
                  <ul className="field-decision-evidence-limits">
                    {source.limits.map((limit) => <li key={limit}>{limit}</li>)}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </details>

      <div className="field-decision-card-footer">
        <Button variant="tonal" size="sm" className="min-h-10 px-3 text-xs" onClick={onOpen}>
          {decision.destination === 'rtr' ? copy.openRtr : copy.openAdvisor}
        </Button>
      </div>
    </article>
  );
}

function QuestionField({
  question,
  value,
  onAnswer,
}: {
  question: FieldDecision['questions'][number];
  value: string;
  onAnswer: (key: ObservationKey, value: string) => void;
}) {
  const selectId = useId();

  return (
    <div className="field-decision-question">
      <label htmlFor={selectId}>{question.label}</label>
      <select
        id={selectId}
        value={value}
        onChange={(event) => onAnswer(question.key, event.target.value)}
      >
        {question.options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

export default FieldDecisionBoard;
