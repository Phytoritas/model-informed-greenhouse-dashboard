# Adaptive Advisor Graph v1

## Decision

The adaptive advisor is a **bounded run-specific computation graph**, not a free-form
ReAct loop. The model may help interpret a question and narrate an answer, but it does
not own sensor values, process-model calculations, constraints, or numerical admission.

The implementation is additive:

- the existing advisor, model runtime, knowledge DB, and `answer_admission` remain the
  numerical authority;
- `adaptive_main:app` wraps the existing FastAPI application and exposes the shadow
  `/api/advisor/adaptive/*` surface;
- the existing `main:app` entry point is intentionally left unchanged for rollback;
- the Assistant page contains an opt-in Adaptive Advisor workbench and a multidimensional
  answer-quality panel.

## Runtime topology

```text
question + frozen dashboard snapshot
                |
                v
        deterministic planner
                |
                v
   bounded run-specific context/calculation DAG
      |         |         |          |
   sensors   physiology  knowledge  operations/market
      \         |         |          /
                v
          constraint gate
                |
                v
          answer admission
                |
                v
        advisor quality gate
                |
                v
       admitted facts -> narrator
```

The immutable safety spine is:

```text
constraint_gate -> answer_admission -> quality_gate
```

A client-proposed plan is validated and rebuilt through that spine. It cannot add Python
functions, invent controls, remove gates, or exceed the model/tool budgets.

## Adaptive intents

| Intent | Typical question | Main lanes |
|---|---|---|
| `STATUS` | “현재 온도와 VPD는?” | live snapshot |
| `DIAGNOSE` | “환경은 비슷한데 왜 광합성이 낮지?” | recent history, physiology, expert wiki |
| `WHAT_IF` | “야간 온도를 1℃ 낮추면?” | physiology, bounded scenario, sensitivity |
| `PLAN` | “다음 주 작업과 출하 계획은?” | weather, work, operations calendar, scenario |
| `OPTIMIZE` | “휴일 후 가격 하락까지 반영해 최적화” | crop, weather, market, operations, scenario |

## Answer quality profile

The UI no longer reduces quality to one opaque confidence number. Every adaptive answer
returns `advisor-quality-profile.v1`:

- capability: live status, diagnostic, model what-if, operational plan, or constrained
  optimization;
- answer status: operational, conditional, monitoring-first, needs-data, or refused;
- telemetry freshness and current/history coverage;
- model applicability, exact requested-delta match, supported range, and constraint status;
- expert-knowledge, weather, operations, and market lane status;
- validity window and events that invalidate the answer.

The score is a display summary only. The categorical fields and individual dimensions are
the operational contract.

## Operations calendar

The operations calendar is explicit operator data, stored in a revisioned JSON document.
It covers:

- holidays and market closures;
- shipment blackout windows;
- shipment targets;
- labor, packing, and storage capacities.

Writes use compare-and-swap via `expected_revision`. The LLM cannot silently create or
change calendar facts.

Default path:

```text
artifacts/operations/operations_calendar.json
```

Override with:

```bash
SMARTGROW_OPERATIONS_CALENDAR_PATH=/var/lib/smartgrow/operations/calendar.json
```

## API

Start the shadow app:

```bash
poetry run python -m uvicorn \
  model_informed_greenhouse_dashboard.backend.app.adaptive_main:app \
  --host 127.0.0.1 --port 8000 --reload
```

Compile a plan without running tools:

```http
POST /api/advisor/adaptive/plan
```

Execute the graph:

```http
POST /api/advisor/adaptive/execute
Content-Type: application/json

{
  "crop": "tomato",
  "question": "다음 주 휴가라 출하가 없고 휴일 다음날 가격 하락이 예상돼. 온도와 수확 계획을 최적화해줘",
  "dashboard": {
    "currentData": {},
    "metrics": {},
    "recentSummary": {},
    "weather": {},
    "market": {},
    "forecast": {},
    "rtr": {}
  },
  "language": "ko",
  "include_narrative": true
}
```

Check whether live context materially invalidated the prior answer:

```http
POST /api/advisor/adaptive/material-change
```

Read/write the operations calendar:

```http
GET /api/advisor/adaptive/operations-calendar/{greenhouse_id}
PUT /api/advisor/adaptive/operations-calendar/{greenhouse_id}
```

## Durable-runtime seam

The graph is intentionally framework-neutral and terminates within one advisory request.
Long-lived sensor, weather, market, and calendar triggers should invoke the API through a
durable orchestrator. Restate or Temporal can be added outside this package without moving
numerical authority into the orchestrator.

A future durable adapter must preserve:

1. snapshot fingerprint as the idempotency key;
2. operations-calendar revision;
3. graph-plan schema version;
4. constraint/admission results;
5. quality-profile validity and invalidation events.

## Rollout

1. Run the legacy and adaptive endpoints in parallel.
2. Compare answers on the same frozen snapshot.
3. Record which graph lanes changed the final recommendation.
4. Promote only after replay cases cover status, diagnosis, what-if, holiday/market plans,
   missing data, stale data, and out-of-range control requests.
5. Keep `main:app` as rollback until the adaptive endpoint passes the production replay
   suite.
