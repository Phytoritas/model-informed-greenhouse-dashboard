# AGENTS.md

이 파일은 이 **repository 전용 Codex 운영 규칙**이다.
이 repo는 phytoritas workspace factory 표준을 따른다. Home 전역 규칙을 상속하지만, **이 repo 안의 규칙이 더 우선**한다.

이 파일의 목표는 세 가지다.

1. 이 repo에서 Codex가 **바로 움직일 수 있는 실행 규칙**을 제공한다.
2. Home 전역 규칙 없이도 이 repo만으로 **self-contained한 작업 기준**을 제공한다.
3. 구조 변경, 실험 변경, naming 변경, GitHub 기록 흐름을 **재현 가능하고 검증 가능한 방식**으로 강제한다.

## 0) 최상위 운영 원칙

- 사용자는 **로컬에서 코딩하고**, GitHub에는 `commit / push / issue / PR / merge`로 기록을 남긴다.
- 비사소한 작업은 기본적으로 **Issue → Branch → Commit → PR → Merge → Validation** 흐름으로 다룬다.
- 작업 추적의 single source of truth는 GitHub Issue다.
- 새 프로젝트를 만들 때부터 구조를 바로 잡고, 중간에 뒤엎는 리팩토링은 가급적 피한다.
- 가능하면 웹보다 **터미널과 스크립트**를 먼저 사용한다.
- 장기기억이 필요한 비사소한 작업은 가능하면 **General Memento Workflow**를 적용한다.
- 이 repo에서 “완료”는 코드 수정 자체가 아니라, **검증 흔적까지 남은 상태**를 뜻한다.

## 0.1) 작업 시작 전 우선 확인 순서

작업 전 가능하면 아래 순서로 확인한다.

1. `README.md`
2. `docs/variable_glossary.md`
3. `docs/legacy_name_mapping.md` (있다면)
4. `pyproject.toml`
5. `.gitignore`
6. `scripts/`

새 기능, 구조 변경, 대형 리팩토링이면 `Phytoritas.md`도 먼저 확인하거나 갱신한다.

## 0.2) Planning, Phase Gate, Refactor Discipline

- 비사소한 작업은 바로 구현부터 들어가지 말고, goal, context, constraints, done criteria를 먼저 정리한다.
- 독립 파일 여러 개를 건드리는 변경은 **phase 단위**로 나눈다.
- 한 phase는 가능하면 **5 files 이하**를 기준으로 삼고, phase 종료 시 검증 결과를 남긴다.
- 인터랙티브 작업에서는 가능하면 **Phase 1 완료 → 검증 → 사용자 승인 → Phase 2** 흐름을 따른다.
- 파일이 300 LOC를 크게 넘는 상태에서 구조 리팩토링을 시작할 때는, 먼저 **dead code, unused import/export, debug log, dead prop**를 정리하는 “Step 0 cleanup”을 분리한다.
- 아키텍처가 flawed하거나 state가 중복되거나 naming/validation이 허술하면, 최소 변경 원칙만 고집하지 말고 **senior-level structural fix**를 제안하고 반영한다.
- 다만 불필요한 대규모 churn은 피하고, 왜 바꾸는지와 무엇으로 확인했는지를 남긴다.

## 0.3) Context Safety, File Read Budget, Edit Integrity

- 긴 대화나 큰 변경 이후에는 이전에 읽은 파일 내용을 기억으로 신뢰하지 않고, **편집 직전에 대상 파일을 다시 읽는다**.
- 편집 직후에도 대상 파일을 다시 읽어 의도한 변경이 정확히 반영됐는지 확인한다.
- 같은 파일을 연속으로 여러 번 수정할 때는 중간에 verification read를 끼운다.
- 같은 파일을 3회 이상 연속 수정해야 하면, 검증 read 없이 계속 밀지 않는다.
- 파일이 500 LOC를 넘으면 가능한 한 필요한 범위만 **순차 chunk**로 읽고, 한 번의 read로 전체를 다 봤다고 가정하지 않는다.
- 한 번에 읽는 범위는 가능하면 **2,000 lines 이하**로 제한한다.
- 검색/명령 결과가 비정상적으로 짧거나 불완전해 보이면 truncation 가능성을 의심하고 범위를 좁혀 다시 실행한다.

## 0.4) Search / Rename / Verification Contract

- 함수/타입/변수명 변경 시에는 direct refs, type refs, string literals, dynamic imports/`require()`, re-exports/barrel files, tests/mocks를 **각각 별도로** 확인한다.
- grep 결과 하나만 보고 rename이 끝났다고 판단하지 않는다.
- 작업 완료 보고 전에는 해당 repo에서 정의된 **typecheck → lint → test → build 또는 smoke check**를 순서대로 실행한다.
- type checker나 linter가 없는 repo에서는 그 부재를 명시하고, 대신 실행한 검증을 기록한다.
- 오류가 남아 있으면 완료로 보고하지 않는다.
- 범위가 큰 변경에서는 reviewer 관점의 diff review까지 포함하는 것을 기본값으로 본다.

## 0.5) Routing

- 비사소한 아키텍처 설계, 기능 개발, 구조 리팩토링 작업은 가능하면 `$recursive-architecture-refactoring-auto`를 먼저 사용한다.
- 문헌 연구처럼 실제 source를 깊게 읽고 synthesis가 필요한 작업이면 `literature_researcher`를 우선 사용한다.
- 일반적인 read-only 코드 탐색과 로그 분석은 `code_explorer`, 변경 영향 범위 파악은 `pr_explorer`, correctness/regression/security review는 `reviewer`, 공식 문서 확인은 `docs_researcher`, 구현은 `implementation_worker`, 테스트 작업은 `test_worker`, 고위험 Windows 명령 사전 점검은 `windows_command_guard`를 우선 사용한다.
- built-in `explorer`와 `worker`는 커스텀 agent가 현재 런타임에 없을 때만 fallback으로 사용한다.

## 1) Python 환경 표준

이 repo는 **pyenv(+ Windows면 pyenv-win) + Poetry**를 기본으로 사용한다.

### 1.1) 기본 버전

- Python 버전: `3.12.3`
- Python 제약: `>=3.12,<3.13`

### 1.2) 기본 부트스트랩 / 재부트스트랩 순서

1. `pyenv local 3.12.3`
2. `poetry config virtualenvs.in-project true --local`
3. `poetry install`

### 1.3) 품질 게이트 기본값

- `poetry run pytest`
- `poetry run ruff check .`

가능하면 추가로 아래를 유지한다.

- `tools/naming_audit.py` 또는 동등한 naming 검증
- baseline regression test 1개
- representative smoke test 1개

## 2) Repository 구조 계약

이 repo는 가능하면 아래 구조를 유지한다.

- `src/<package_name>/`: 핵심 코드
- `tests/`: 검증
- `docs/`: 설계/변수사전/결정 기록
- `scripts/`: 반복 실행 스크립트
- `configs/`: 실험 설정
- `data/`: 입력 데이터 설명 또는 샘플
- `artifacts/` 또는 `out/`: 생성물 (Git 추적 제외)

### 2.1) README 계약

`README.md` 첫 화면은 아래 순서를 유지한다.

1. Purpose
2. Inputs
3. Outputs
4. How to run
5. Current status
6. Next validation

## 3) 식물 모델링 변수명 표준

식물 모델링 관련 개념은 **동일 개념 = 동일 변수명**을 유지한다.

### 3.1) 레이어 규칙

- **수식/코어 모델 레이어**: short name 사용
- **파이프라인/입출력/UI 레이어**: full descriptive name 사용
- 변환은 경계에서 1회만 한다.

### 3.2) 코어 short name 고정 목록

#### Environment / time
- `t`, `dt`, `t_a`, `t_l`, `rh`, `vpd`, `r_abs`, `r_incom`

#### Photosynthesis / gas exchange
- `a_n`, `e`, `g_w`, `g_c`, `g_b`, `c_i`, `c_a`, `gamma_star`, `v_cmax`, `j_max`, `k_c`, `k_o`, `r_d`

#### Hydraulics / water potential
- `psi_l`, `psi_s`, `psi_rc`, `psi_rc0`, `psi_soil`, `psi_soil_by_layer`
- `k_l`, `k_sw`, `k_r`, `k_soil`

#### Carbon / growth
- `c_nsc`, `c_struct`, `la`, `h`, `w`, `d`, `g`, `g0`, `r_m`, `r_g`

#### Optimization / sensitivity
- `lambda_wue`, `chi_w`, `d_a_n_d_e`, `d_a_n_d_r_abs`

#### Turgor
- `p_turgor`, `p_turgor_crit`

### 3.3) Full-name 권장 목록

- `net_assimilation_rate`
- `transpiration_rate`
- `leaf_water_potential`
- `stem_water_potential`
- `root_collar_water_potential`
- `soil_water_potential`
- `soil_water_potential_by_layer`
- `marginal_wue`
- `nonstructural_carbon`
- `turgor_pressure`
- `turgor_pressure_threshold`

### 3.4) 금지 규칙

- 단독 `lambda`, `Lambda`, `Λ` 대신 `lambda_wue` 또는 `lambda_aux`
- `P_x_l`, `P_x_s`, `P_x_r`, `p_x_l`, `p_x_s`, `p_x_r` 대신 `psi_l`, `psi_s`, `psi_rc`
- `_vect` 대신 `_vec`
- `_stor`는 output key 문자열에서만 허용하고, 코드 변수명/필드명에는 사용하지 않는다.
- 의미 없는 단독 `k` 바인딩 대신 `k_soil`, `k_c`, `layer_idx`, `model_idx`처럼 의미를 담은 이름을 사용한다.

### 3.5) suffix 규칙

- 1D vector: `_vec`
- 2D matrix: `_mat`
- grid/mesh: `_grid`
- layer axis: `_by_layer`
- time series: `_ts`
- optimal: `_opt`
- critical: `_crit`

### 3.6) 새 개념 추가 규칙

1. 기존 glossary에 맞출 수 있는지 먼저 확인
2. 없으면 `docs/variable_glossary.md`에 새 개념을 먼저 정의
3. short / full name 둘 다 결정
4. 충돌(alias) 규칙을 같이 적음
5. 그 다음에만 코드에 반영

## 4) GitHub CLI 우선 원칙

사용자는 웹보다 **터미널에서 한 번에 끝내는 흐름**을 선호하므로, `gh`가 설치·인증되어 있으면 Codex는 웹보다 GitHub CLI를 우선 사용한다.

### 4.1) 기본 설정값

- 기본 repo visibility: `private`
- 기본 remote 이름: `origin`
- 기본 base branch: `main`
- 기본 Project title: `Phytoritas's Portfolio`
- 기본 Project owner: `@me`

### 4.2) GitHub 작업 전 확인

```bash
gh auth status
gh auth setup-git
```

Project 추가/편집이 필요하면 필요 시 아래를 실행한다.

```bash
gh auth refresh -s project
```

### 4.3) 이 repo에서 우선 사용할 helper scripts

가능하면 아래를 우선 사용한다.

- `scripts/New-GitHubIssueBranch.ps1`
- `scripts/Set-GitHubProjectStatus.ps1`
- `scripts/Set-GitHubProjectField.ps1`
- `scripts/New-GitHubPullRequest.ps1`
- `scripts/Sync-GitHubLabels.ps1`

repo 안에 helper script가 없으면 상위 workspace script를 fallback으로 사용한다.

### 4.4) 의미 있는 작업은 Issue 먼저

비사소한 작업(새 기능, 새 실험, 구조 변경, 버그 수정, 데이터 준비)은 **코드 수정 전에 Issue를 먼저 만든다.**
`recursive-architecture-refactoring-auto` 같은 아키텍처/리팩토링 skill도 예외가 아니다. repo-local `AGENTS.md`를 읽은 뒤, 비사소한 문서/설계 산출물 write를 포함해 먼저 issue/branch linkage를 맞춘다.

```bash
gh issue create   --title "[<Type>] <short summary>"   --body-file <issue-body-file>   --label "<label1>"   --label "<label2>"   --project "Phytoritas's Portfolio"
```

### 4.5) issue에서 branch 바로 만들기

가능하면 `gh issue develop <issue-number> --checkout --name <branch-name>` 또는 repo-local helper script를 우선 사용한다.

branch 이름 규칙:
- `feat/<issue-number>-<slug>`
- `fix/<issue-number>-<slug>`
- `exp/<issue-number>-<slug>`
- `data/<issue-number>-<slug>`
- `docs/<issue-number>-<slug>`

### 4.6) PR 생성

가능하면 repo-local helper script를 우선 사용한다.

```bash
gh pr create   --fill   --body-file <pr-body-file>   --project "Phytoritas's Portfolio"
```

PR 본문에는 반드시 아래 줄을 포함한다.

```text
Closes #<issue-number>
```

### 4.7) Project field / Status 자동화

Project 보드의 built-in automation(`Item added`, `Item closed`, `Pull request merged`)은 그대로 활용한다.
그 외의 중간 상태는 `gh project item-edit`를 직접 치기보다, repo-local script 또는 workspace script를 우선 사용한다.

## 5) GitHub Project 상태 / label / issue 타입

### 5.1) Status 흐름

- `Inbox`
- `Ready`
- `Running`
- `Blocked`
- `Validating`
- `Done`

원칙:
- 새 이슈는 `Inbox`
- 오늘 실제로 손대는 것만 `Running`
- 검증이 남아 있으면 `Validating`
- 이슈가 닫히면 `Done`
- 끝난 뒤 같은 범위가 미완성이면 `reopen`
- 새 요구사항이면 새 issue
- 새 부작용이면 새 bug issue

### 5.2) label 표준

- type: `type:hypothesis`, `type:experiment`, `type:model-change`, `type:data`, `type:bug`, `type:doc`
- priority: `prio:p0`, `prio:p1`, `prio:p2`
- model: `model:gosm`, `model:thorp`, `model:tdgm`, `model:load-cell`, `model:general`
- crop: `crop:tomato`, `crop:cucumber`, `crop:general`

가능하면 초기화 직후 `scripts/Sync-GitHubLabels.ps1`로 label 세트를 맞춘다.

### 5.3) issue 타입 최소 내용

- `Experiment Run`: dataset, config, metric, output path, decision
- `Model Change`: why, affected model, validation method, comparison target
- `Bug`: repro, expected / actual, scope, fix idea, test

## 6) Git 위생 규칙과 완료 정의

- `.venv/`, `__pycache__/`, `*.pyc`, `artifacts/`, `out/`, `runs/`, `results/`는 기본적으로 Git 추적 대상이 아니다.
- 로컬 전용 `config.local.*`, `.env`, 개인 경로가 들어간 설정, 임시 노트는 커밋하지 않는다.
- 생성물과 소스 변경은 한 커밋에 되도록 섞지 않는다.

작업이 끝났다고 판단하려면 아래 중 하나 이상의 검증 흔적이 있어야 한다.

- 테스트 결과
- 실행 로그
- 스크린샷
- 대표 출력 경로
- README 갱신
- 결정 문서 갱신

완료 시 가능하면 아래 3줄을 남긴다.

- 무엇이 바뀌었는가
- 무엇으로 확인했는가
- 다음 액션은 무엇인가
