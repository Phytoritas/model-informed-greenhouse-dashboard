# 구축 데이터의 LLM 응답 품질 및 추천 정확도 기여 검증 초안

## 2. 연구개발과제의 수행 과정 및 수행 내용

본 과제에서는 온실 운영 데이터, 작물 생리 모델 산출물, 작물별 재배 지식 자료, 방제 및 양액 처방 워크북을 단순 참고 자료로 보관하는 수준이 아니라, LLM 응답과 추천 엔진이 직접 활용할 수 있는 구조화 데이터 자산으로 전환하였다. 검증의 핵심 질문은 구축 데이터가 실제로 LLM 응답의 근거성, 실행 가능성, 누락 데이터 인지 능력, 그리고 방제·양액·환경·작업 추천 정확도 향상에 기여했는지 확인하는 것이다.

수행 과정은 네 단계로 구성하였다.

첫째, 데이터 원천을 작물·도메인·사용 목적별로 구분하였다. 온실 센서 및 환경 관측 데이터는 환경 제어와 RTR 기반 의사결정의 입력으로, 작물 생리 및 재배 문헌은 LLM의 작물별 배경 지식으로, 방제 및 양액 워크북은 결정론적 추천 엔진의 기준 데이터로 정리하였다. 특히 토마토와 오이처럼 작물별 운영 맥락이 다른 경우에는 crop scope를 명시해 교차 작물 추천이 발생하지 않도록 데이터 경계를 설정하였다.

둘째, 비정형 자료와 표 형식 자료를 검색·추천 가능한 형태로 정규화하였다. PDF, CSV, XLSX 기반 자산은 knowledge document, chunk, entity, pesticide product, pesticide target, pesticide rotation, nutrient recipe, fertilizer, adjustment rule 등으로 나누어 SQLite 기반 지식 데이터베이스에 적재하였다. 이 과정에서 원문 위치, source type, asset family, topic major/minor, crop scope를 함께 유지해 LLM 입력과 추천 결과가 어떤 데이터 경로에서 생성되었는지 추적할 수 있게 했다.

셋째, 사용자 질의와 대시보드 상태를 구축 데이터에 연결하는 retrieval 및 orchestration 경로를 구현하였다. 지식 검색은 intent routing, source filter, FTS/lexical hybrid ranking, rerank bonus를 사용해 질의 유형별로 적합한 데이터 표면을 우선하도록 설계하였다. 예를 들어 방제 교호 추천 질의는 pesticide workbook과 rotation topic으로, 양액 보정 질의는 nutrient workbook과 drain feedback/guardrail topic으로, 환경 제어 질의는 PDF와 CSV 기반 환경 지식으로 라우팅된다.

넷째, LLM에는 전체 원천 데이터를 그대로 노출하지 않고, bounded evidence card와 요약된 retrieval context만 주입하도록 하였다. 내부 provenance, document id, chunk id, routing detail은 machine payload와 internal provenance로 분리하고, 사용자-facing 응답에는 작물별 근거 요약과 실행 지시 중심의 정보만 전달되도록 구성하였다. 이를 통해 LLM이 원문 식별자를 그대로 출력하거나, 검색되지 않은 정보를 임의 생성하는 위험을 줄이고자 했다.

검증 설계는 LLM 응답 품질과 추천 정확도를 분리해 진행하였다. LLM 응답 품질은 다음 항목을 기준으로 검증한다.

- 구축 지식 자료가 실제 OpenAI prompt 입력에 포함되는지
- LLM이 dashboard와 model runtime에 제공된 수치만 사용하도록 제한되는지
- retrieval context가 준비된 경우에만 LLM 입력에 주입되는지
- 검색 근거는 압축해 제공하되 내부 provenance는 사용자 응답에서 숨기는지
- 검색 실패 또는 데이터 부족 상황에서 임의 추론 대신 monitoring-first 또는 추가 데이터 필요 상태로 응답하는지

추천 정확도는 다음 항목을 기준으로 검증한다.

- 작물 범위가 다른 방제 대상이 추천 결과에 섞이지 않는지
- 방제 추천에서 등록 상태, manual review flag, FRAC/MOA 중복 제거, 교호 순서가 정책대로 적용되는지
- 양액 추천에서 생육 단계가 정확히 매칭되고 EC, Cl, HCO3, Na 등 guardrail이 반영되는지
- 양액 보정에서 배액 피드백, 원수 분석값, stock tank 단위 계약, 잔류 초과 위험이 추천 결과에 반영되는지
- 환경·작업·수확·생리 advisor tab이 대시보드 상태와 지식 검색 결과를 함께 사용하고, 필수 입력이 부족할 때 실행 추천보다 관측/데이터 복구를 우선하는지

현재 repository 기준으로는 `openai_service.py`, `knowledge_database.py`, `knowledge_query_router.py`, `advisor_context_builder.py`, `advisor_orchestration.py`, `advisory.py`, `workbook_normalization.py` 및 관련 테스트 파일이 위 검증 경로를 뒷받침한다. 다만 "LLM 응답 품질 향상률"을 수치로 제시하려면 구축 데이터 사용 전후를 비교하는 별도 평가 세트, human rubric, 또는 offline LLM evaluation harness가 추가로 필요하다. 따라서 본 문서의 현 단계 초안은 구현·테스트 근거로 입증 가능한 기여와, 아직 정량 검증이 필요한 영역을 명확히 구분한다.

## 3. 연구개발과제의 수행 결과 및 목표 달성 정도

수행 결과, 구축 데이터는 세 가지 경로를 통해 LLM 응답 품질과 추천 정확도 향상에 기여하는 구조로 반영되었다.

첫째, LLM 응답의 근거성이 강화되었다. 기존 LLM 응답이 대시보드 수치와 일반 농업 지식에 의존할 수밖에 없었다면, 현재 구조에서는 crop-scoped knowledge context, retrieval evidence card, model runtime answer focus, control precision matrix가 함께 prompt에 주입된다. 테스트에서는 "Cucumber agronomy compendium", "Nutrient recipe workbook"과 같은 구축 지식 항목이 실제 OpenAI input에 포함되는지 확인하고, 계산된 효과와 추천 계약을 사용할 때 "제공된 숫자만 사용"하도록 prompt 계약이 유지되는지 검증한다. 이는 LLM 응답이 일반론보다 현재 데이터와 구축 지식에 기반하도록 만드는 직접적인 품질 개선 경로다.

둘째, 추천 정확도를 결정론적 데이터 표면으로 보강하였다. 방제 추천은 pesticide workbook에서 작물, 대상 병해충, 등록 상태, FRAC/MOA, 교호 순서, manual review 여부를 분리해 사용한다. 테스트에서는 crop-scoped candidate 반환, 교차 작물 질의 거부, registered-first 정책, unique MOA rotation, malformed row 및 duplicate MOA 제외, manual review flag 부여가 확인된다. 양액 추천은 nutrient recipe, source water baseline, guardrail, drain feedback, stock tank 단위 계약을 사용하며, 테스트에서는 exact stage recipe, Cl guardrail 초과, bounded drain feedback, macro bundle blocking, residual safe alternative 정책이 검증된다. 이 경로는 LLM이 자유 생성으로 추천을 만들지 않고, 정규화된 workbook 기준과 계산 규칙을 거친 결과를 설명하도록 한다.

셋째, 검색 정확도와 응답 안전성이 개선되었다. `query_knowledge_database()`는 질의 intent를 disease/pest, nutrient recipe, environment control, crop physiology, cultivation work, harvest market 등으로 분류하고, 각 intent에 맞는 source type과 asset family를 적용한다. 테스트에서는 "powdery mildew rotation recommendation"이 pesticide workbook으로, "calcium guardrail drain feedback"이 nutrient workbook으로, "vpd humidity control"이 PDF/CSV 환경 지식으로 라우팅되는지 검증한다. 또한 "오이재배방법"과 같은 재배 질의가 농약 workbook으로 오분류되지 않도록 확인한다. 이는 검색 결과가 LLM 응답의 근거로 들어가기 전에 도메인 부적합 자료가 섞이는 위험을 줄인다.

목표 달성 정도는 다음과 같이 정리할 수 있다.

| 목표 항목 | 현재 달성 정도 | 근거 및 해석 |
| --- | --- | --- |
| 구축 데이터를 LLM 입력에 연결 | 달성 | knowledge context와 model runtime contract가 OpenAI prompt에 포함되는 테스트가 존재한다. |
| 검색 근거를 bounded evidence로 압축 | 달성 | advisor context builder가 evidence card, focus topic, chunk provenance를 분리하고 ready 상태의 retrieval만 주입한다. |
| 추천 정확도에 구조화 workbook 반영 | 달성 | 방제·양액 추천에서 crop scope, 등록 상태, MOA 중복, guardrail, manual review 정책이 테스트된다. |
| 데이터 부족/검색 실패 시 안전한 fallback | 부분 달성 | retrieval fallback, database missing, monitoring-first 응답 경로가 테스트되지만 실제 현장 로그 기반 빈도 평가는 추가 필요하다. |
| LLM 응답 품질의 정량 향상률 산출 | 미완료 | 현재 테스트는 prompt 주입과 추천 정확도 경로를 검증하지만, before/after LLM 품질 점수는 별도 평가 세트가 필요하다. |

따라서 현 단계에서의 목표 달성 정도는 "구축 데이터가 LLM과 추천 엔진에 실제로 연결되고, 추천 정확도를 높이는 주요 규칙이 자동 테스트로 검증되는 수준"까지는 달성된 것으로 판단된다. 특히 방제·양액 추천처럼 정답 기준을 워크북과 guardrail로 정의할 수 있는 영역은 기능 테스트를 통해 정확도 개선 근거가 비교적 명확하다. 반면 LLM 응답 품질은 prompt에 구축 데이터가 주입되고 환각 방지 계약이 적용되는 구조적 근거는 확인되었지만, 응답 품질 향상률 자체는 아직 별도 정량 평가가 필요하다.

후속 검증은 다음 방식으로 진행하는 것이 적절하다.

- 동일 질의 세트에 대해 구축 데이터 미사용 baseline과 구축 데이터 사용 모델을 비교한다.
- 평가 기준은 근거 일치율, 추천 실행 가능성, 누락 데이터 명시율, 작물/병해충 scope 위반률, guardrail 위반률, manual review flag 정확도로 둔다.
- 방제와 양액은 deterministic expected output을 기준으로 top-k match, policy compliance, unsafe recommendation rate를 산출한다.
- LLM 응답은 blind human review 또는 rubric-based evaluation으로 groundedness, actionability, hallucination risk, Korean operator readability를 점수화한다.
- 운영 로그가 축적되면 실제 사용자 feedback, 추천 채택률, 수정 요청률, 사후 오류율을 함께 비교해 정량 성과로 확장한다.

결론적으로 구축 데이터는 현재 시스템에서 LLM 응답의 근거를 제공하고, 추천 엔진의 판단 범위를 작물·질의·정책 기준으로 제한하며, 내부 provenance를 통해 검증 가능한 추천 흐름을 만드는 데 기여했다. 다만 연구개발 결과 보고서에서 "품질이 몇 퍼센트 향상되었다"와 같은 정량 표현을 사용하려면, 본 초안 이후 별도 평가 세트와 비교 실험 결과를 추가해야 한다.
