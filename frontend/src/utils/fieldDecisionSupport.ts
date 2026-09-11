import type { CropType, SensorData, TelemetryStatus } from '../types';
import knowledge from '../data/field-decision-knowledge.json';

export type SituationId = 'water' | 'humidity' | 'nutrition' | 'rtr' | 'co2' | 'followup';
export type ObservationKey = 'wilting' | 'delivery' | 'rootMoisture' | 'surfaceWetness' | 'outsideDrier' | 'supplyMismatch' | 'stage' | 'fruitLoad' | 'co2Delivery' | 'ventilation' | 'execution' | 'response' | 'workBacklog';
export type FieldObservations = Partial<Record<ObservationKey, string>>;
export type SubstrateDemoId = 'balanced' | 'interrupted' | 'wetWilt' | 'off';
export function getSubstrateDemoScenarios(locale: 'ko' | 'en' = 'ko'): { id: SubstrateDemoId; label: string; summary: string; observations: FieldObservations }[] {
  const ko = locale === 'ko';
  return [
    { id: 'balanced', label: ko ? '급액 도달·시듦 없음' : 'Delivery confirmed, no wilting',
      summary: ko ? '함수율 62% · 근권 21.5°C · 급액 도달 · 확인 개체 시듦 없음' : 'Water content 62% · root zone 21.5°C · delivery confirmed · no wilting on checked plants',
      observations: { wilting: 'no', delivery: 'normal', rootMoisture: 'wet' } },
    { id: 'interrupted', label: ko ? '급액 중단·건조' : 'Interrupted supply, dry substrate',
      summary: ko ? '함수율 31% · 근권 25.0°C · 급액 중단 · 건조·시듦 관찰' : 'Water content 31% · root zone 25.0°C · supply interrupted · dry substrate and wilting',
      observations: { wilting: 'yes', delivery: 'stopped', rootMoisture: 'dry' } },
    { id: 'wetWilt', label: ko ? '젖은 배지·시듦' : 'Wet substrate with wilting',
      summary: ko ? '함수율 78% · 근권 20.0°C · 급액 도달 · 젖은 배지에서 시듦' : 'Water content 78% · root zone 20.0°C · delivery confirmed · wilting in wet substrate',
      observations: { wilting: 'yes', delivery: 'normal', rootMoisture: 'wet' } },
    { id: 'off', label: ko ? '직접 입력' : 'Enter conditions', summary: ko ? '배지 상태를 직접 확인해 입력하세요.' : 'Check substrate conditions and enter your observations.', observations: {} },
  ];
}
export interface DecisionQuestion { key: ObservationKey; label: string; options: { value: string; label: string }[] }
export interface DecisionEvidence { id: string; title: string; claim: string; limits: string[]; locator: string; url?: string }
export interface FieldDecision {
  id: SituationId; title: string; priority: 'first' | 'today' | 'observe' | 'data';
  reason: string; confirm: string[]; action: string; recheck: string; limit: string;
  evidence: DecisionEvidence[]; questions: DecisionQuestion[]; destination: 'advisor' | 'rtr'; basis: string;
}
export interface FieldDecisionInput {
  crop: CropType; currentData: SensorData; telemetryStatus: TelemetryStatus;
  rtrDeltaC?: number; rtrToleranceC?: number; rtrWindowHours?: number; rtrWindowUsable?: boolean;
  observations?: FieldObservations; locale?: 'ko' | 'en'; substrateDemo?: SubstrateDemoId;
}

// The reviewed excerpts supply conditional context, never automatic setpoints.
const evidenceIds: Record<SituationId, string[]> = {
  water: ['KR-01', 'KR-03', 'WEB-05', 'CASE-11', 'OBS-K08'],
  humidity: ['WEB-09', 'KR-05', 'CASE-07'],
  nutrition: ['KR-03', 'KR-04', 'CASE-05', 'OBS-K03', 'OBS-K04'],
  rtr: ['OBS-K06', 'OBS-K10', 'JP-CUC-03', 'JP-CUC-08', 'WEB-06'],
  co2: ['CASE-10', 'CASE-13'],
  followup: ['CASE-04', 'CASE-09', 'CASE-11', 'CASE-14', 'OBS-K09', 'OBS-C12'],
};

export function buildFieldDecisions(input: FieldDecisionInput): FieldDecision[] {
  return buildDecisions(input);
}

/** The shared RTR graph extrapolates its final sample. A decision additionally
 * needs a full observed day, valid contributing frames and no gap over one hour.
 * This is a data-resolution requirement for the comparison, not a crop threshold.
 */
export function isDecisionRtrWindowUsable(history: SensorData[], currentData: SensorData): boolean {
  const last = currentData.timestamp;
  if (!Number.isFinite(last)) return false;
  const window = history.filter((row) => row.timestamp >= last - 24 * 3_600_000);
  if (window.length < 2 || window.at(-1)?.timestamp !== last
    || last - window[0].timestamp < 24 * 3_600_000) return false;
  return window.every((row, i) => {
    const gap = i ? row.timestamp - window[i - 1].timestamp : 1;
    return Number.isFinite(row.timestamp) && gap > 0 && gap <= 3_600_000
      && row.dataQuality?.status !== 'invalid'
      && !/failed|unconverged|invalid_input|error/i.test(row.simulationStatus ?? '')
      && row.fieldAvailability?.temperature !== false && row.fieldAvailability?.light !== false
      && Number.isFinite(row.temperature) && Number.isFinite(row.light) && row.light >= 0;
  });
}

function buildDecisions({ crop, currentData: d, telemetryStatus, rtrDeltaC, rtrToleranceC,
  rtrWindowHours, rtrWindowUsable, observations: entered = {}, locale = 'ko', substrateDemo = 'off' }: FieldDecisionInput): FieldDecision[] {
  const t = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const demo = getSubstrateDemoScenarios(locale).find((row) => row.id === substrateDemo && row.id !== 'off');
  const observations: FieldObservations = { ...demo?.observations, ...entered };
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const frameUsable = (telemetryStatus === 'live' || telemetryStatus === 'delayed')
    && d.dataQuality?.status !== 'invalid'
    && !/failed|unconverged|invalid_input|error/i.test(d.simulationStatus ?? '');
  const value = (key: 'vpd' | 'humidity' | 'temperature' | 'light' | 'co2' | 'soilMoisture') => {
    const n = d[key];
    if (!frameUsable || d.fieldAvailability?.[key] === false || !finite(n)) return null;
    if ((key !== 'temperature' && n < 0) || (key === 'humidity' && n > 100)) return null;
    return n;
  };
  const vpd = value('vpd'), rh = value('humidity'), co2 = value('co2');
  const unknown = { value: 'unknown', label: t('아직 확인하지 않음', 'Not checked yet') };
  const q = (key: ObservationKey, ko: string, en: string, options: [string, string, string][]): DecisionQuestion => ({
    key, label: t(ko, en), options: [unknown, ...options.map(([value, a, b]) => ({ value, label: t(a, b) }))],
  });
  const yesNo: [string, string, string][] = [['yes', '있음', 'Yes'], ['no', '없음', 'No']];
  const questions: Record<SituationId, DecisionQuestion[]> = {
    water: [q('wilting', '같은 개체의 시듦', 'Wilting on the same plants', [
      ['yes', '시듦 관찰', 'Wilting observed'], ['persistent', '지속되거나 번짐', 'Persistent or spreading'], ['no', '관찰한 개체에는 없음', 'Absent on checked plants']]),
      q('delivery', '드리퍼의 실제 급액 도달', 'Actual delivery at the dripper', [['stopped', '중단·미도달 확인', 'Stopped or not reaching roots'], ['normal', '도달 확인', 'Delivery confirmed']]),
      q('rootMoisture', '뿌리 위치에서 확인한 배지', 'Substrate checked at root depth', [['dry', '건조', 'Dry'], ['wet', '젖어 있음', 'Wet']])],
    humidity: [q('surfaceWetness', '잎·과실 표면의 물방울', 'Droplets on leaves or fruit', yesNo),
      q('outsideDrier', '내외기 수분함량 비교 결과', 'Outside versus inside moisture content', [['yes', '외기 수분함량이 더 낮음', 'Outside contains less moisture'], ['no', '외기가 같거나 더 습함', 'Outside is equal or wetter']])],
    nutrition: [q('supplyMismatch', '동일 기준으로 확인한 설정–드리퍼 EC·pH 차이', 'Setpoint versus dripper EC/pH, on the same basis', yesNo)],
    rtr: [q('stage', '현장에서 확인한 생육단계', 'Growth stage checked in the crop', [['establishing', '정식·활착 중', 'Transplant establishment'], ['fruiting', '착과·수확 중', 'Fruiting or harvesting']]),
      q('fruitLoad', '현재 착과 부담', 'Current fruit load', [['heavy', '부담이 크다고 관찰', 'Observed to be heavy'], ['normal', '평소와 비슷함', 'Similar to usual']])],
    co2: [q('co2Delivery', 'CO₂ 공급 장치 확인', 'CO₂ supply equipment', [['fault', '공급 문제 확인', 'Supply fault confirmed'], ['working', '실제 공급 확인', 'Actual supply confirmed']]),
      q('ventilation', '환기창 실제 상태', 'Actual vent position', [['open', '열림', 'Open'], ['closed', '닫힘', 'Closed']])],
    followup: [q('execution', '검토 중인 조치의 실행 상태', 'Execution of the action being reviewed', [['planned', '계획·설정만 함', 'Planned or set only'], ['done', '실제 동작·작업 확인', 'Actual operation or work confirmed']]),
      q('response', '같은 개체·구역의 후속 반응', 'Follow-up on the same plants or area', [['improved', '개선 관찰', 'Improvement observed'], ['partial', '일부 개선·증상 남음', 'Partial improvement, symptoms remain'], ['unchanged', '뚜렷한 변화 없음', 'No clear change'], ['worse', '악화·피해 확대', 'Worse or spreading']]),
      q('workBacklog', '밀린 작업 또는 인력·장비 제약', 'Work backlog or labour/equipment constraints', yesNo)],
  };
  const allowed = new Map(Object.values(questions).flat().map((row) => [row.key, row.options.map((o) => o.value)]));
  const a = (key: ObservationKey) => allowed.get(key)?.includes(observations[key] ?? '') ? observations[key] : 'unknown';
  const sourceBasis = t('시뮬레이션 입력·계산 맥락', 'Simulation input and model context');
  const make = (id: SituationId, ko: string, en: string, body: Pick<FieldDecision, 'reason' | 'confirm' | 'action' | 'recheck' | 'limit'>): FieldDecision => ({
    id, title: t(ko, en), priority: 'observe', ...body, destination: id === 'rtr' ? 'rtr' : 'advisor',
    questions: questions[id],
    evidence: knowledge.filter((r) => evidenceIds[id].includes(r.id) && (r.crop === crop.toLowerCase() || r.crop === 'shared')),
    basis: id === 'water' && demo
      ? t('선택한 배지 조건 · 수치는 예시이며 관수 임계값이 아님', 'Selected substrate conditions · illustrative values, not irrigation thresholds')
      : questions[id].some((row) => a(row.key) !== 'unknown')
      ? t('사용자가 입력한 현장 관찰 · 표시 자료는 시뮬레이션 맥락', 'User-entered field observations · displayed data are simulation context')
      : frameUsable ? `${sourceBasis}${telemetryStatus === 'delayed' ? t(' · 수신 지연', ' · delayed receipt') : ''}`
        : t('표시 자료의 수신·계산 상태 확인 필요', 'Confirm receipt and calculation state of displayed data'),
  });
  const water = make('water', '시듦과 실제 급액', 'Wilting and actual water delivery', {
    reason: t('급액 도달·배지 젖음·시듦은 현장에서 확인해야 합니다.', 'Water delivery, substrate wetness and wilting need field confirmation.'),
    confirm: [t('피해·비피해 개체의 위치와 시작 시각', 'Affected and unaffected locations and onset'), t('드리퍼 토출과 뿌리 위치의 실제 젖음', 'Dripper discharge and wetness at root depth')],
    action: t('같은 구역의 급액 도달과 배지 젖음을 확인한 뒤 관수 계획을 검토하세요.', 'Check delivery and substrate wetness in the same area before reviewing irrigation.'),
    recheck: t('공급 복구와 같은 개체의 회복·지속·악화를 각각 확인하세요.', 'Check restored delivery and recovery, persistence or deterioration on the same plants separately.'),
    limit: t('배지 종류·교정이 없는 수분 비율이나 배액 발생만으로 관수 증감을 정하지 않습니다.', 'An uncalibrated moisture percentage or drainage alone cannot set irrigation changes.'),
  });
  if (a('wilting') === 'persistent' || (a('wilting') === 'yes' && a('rootMoisture') === 'wet')) {
    water.priority = 'first';
    water.reason = a('wilting') === 'persistent' ? t('시듦이 지속되거나 번진다고 입력했습니다.', 'Persistent or spreading wilting was entered.') : t('시듦과 젖은 배지를 함께 관찰했다고 입력했습니다.', 'Wilting and wet substrate were both entered.');
    water.action = t('피해 분포·뿌리·접목부·도관 상태를 확인하고 현장 진단으로 연결하세요. 급액 도달 여부도 함께 확인하세요.', 'Check the affected pattern, roots, graft and vascular tissue and arrange field diagnosis. Confirm actual delivery as well.');
  } else if (a('delivery') === 'stopped') {
    water.priority = 'first'; water.reason = t('실제 급액 중단·미도달을 확인했다고 입력했습니다.', 'Interrupted or failed delivery was entered.');
    water.action = t('막힘·밸브·공급 경로를 확인하고 확인된 공급 문제를 조정한 뒤 뿌리 위치까지 물이 도달하는지 보세요.', 'Check blockage, valves and the delivery path; address the confirmed supply problem and verify water reaches the root zone.');
  } else if (a('wilting') === 'yes' || a('rootMoisture') === 'dry') {
    water.priority = a('wilting') === 'yes' ? 'first' : 'today';
    water.reason = t('시듦 또는 뿌리 위치의 건조를 관찰했다고 입력했습니다.', 'Wilting or dryness at root depth was entered.');
    water.action = t('급액 균일성·실제 젖음과 일사 노출을 비교하세요. 공급이 도달해도 시듦이 남으면 뿌리·접목 상태를 확인하세요.', 'Compare delivery uniformity, actual wetness and light exposure. If wilting persists despite delivery, inspect roots and grafts.');
  } else if (vpd !== null && vpd > 1.45) {
    water.priority = 'today'; water.reason = t(`표시된 공기 VPD는 ${vpd.toFixed(2)} kPa입니다. 수분 공급과 작물 반응을 함께 볼 항목입니다.`, `Displayed air VPD is ${vpd.toFixed(2)} kPa. Check water delivery alongside the crop response.`);
  } else if (a('delivery') === 'normal' && a('rootMoisture') === 'wet' && a('wilting') === 'no') {
    water.reason = t('급액 도달·젖은 배지와 확인 개체의 시듦 없음이 입력돼 있습니다.', 'Delivery, wet substrate and absence of wilting on checked plants are recorded.');
    water.action = t('다음 급액 전후 여러 위치의 젖음과 같은 개체의 상태를 비교하세요. 현재 관찰만으로 다른 구역의 문제를 배제하지 마세요.', 'Compare wetness at several positions and the same plants before and after the next irrigation. The current observation does not rule out problems elsewhere.');
  } else if (value('soilMoisture') === null) {
    water.priority = 'data'; water.reason = t('확인 가능한 배지 수분 실측값이 없습니다. 화면 기본값으로 관수 시점을 정할 수 없습니다.', 'No usable measured substrate moisture is available. A display fallback cannot determine irrigation timing.');
  }
  if (demo) {
    const manualOverride = questions.water.some((row) => entered[row.key] !== undefined);
    water.reason = manualOverride
      ? `${t('직접 바꾼 배지 조건을 적용했습니다.', 'Manually edited substrate conditions are applied.')} ${water.reason}`
      : `${demo.summary}${vpd !== null && vpd > 1.45 ? t(` · 표시 공기 VPD ${vpd.toFixed(2)} kPa`, ` · displayed air VPD ${vpd.toFixed(2)} kPa`) : ''}`;
    if (manualOverride) water.basis = t('선택한 배지 조건 + 직접 입력 · 예시 수치와 입력 조건이 다를 수 있음', 'Selected substrate conditions + manually entered conditions · example values may differ from entered conditions');
  }
  const humidity = make('humidity', '표면 젖음과 습 배출', 'Surface wetness and moisture removal', {
    reason: rh !== null && vpd !== null ? t(`표시 습도 ${rh.toFixed(0)}%, 공기 VPD ${vpd.toFixed(2)} kPa입니다. 표면 젖음은 별도 확인이 필요합니다.`, `Displayed RH is ${rh.toFixed(0)}%, air VPD ${vpd.toFixed(2)} kPa. Surface wetness needs separate confirmation.`)
      : t('기온·습도 자료와 실제 잎·과실 표면 상태를 확인하세요.', 'Confirm temperature/humidity data and actual leaf and fruit surfaces.'),
    confirm: [t('잎·과실 물방울과 젖어 있던 시간', 'Droplets on leaves/fruit and wetness duration'), t('외기와 내기의 수분함량·열 공급 여력', 'Inside/outside moisture content and available heating')],
    action: t('군락 안의 표면 젖음과 내외기 수분함량을 먼저 비교하세요. 외기 RH만 낮다고 제습이 되는 것은 아닙니다.', 'First compare canopy surface wetness and inside/outside moisture content. Lower outside RH alone does not establish drying potential.'),
    recheck: t('RH 하락뿐 아니라 같은 표면이 마르는지, 새 물방울이 생기는지 확인하세요.', 'Check whether the same surfaces dry and whether new droplets form, alongside RH.'),
    limit: t('RH·공기 VPD는 감염 여부를 확정하지 못합니다. 가온·순환만으로 수분이 제거됐다고 볼 수 없습니다.', 'RH and air VPD cannot diagnose infection. Heating or circulation alone does not establish moisture removal.'),
  });
  humidity.priority = rh === null || vpd === null ? 'data' : (rh >= 85 || vpd <= 0.55) ? 'today' : 'observe';
  if (a('surfaceWetness') === 'yes') {
    humidity.priority = 'today'; humidity.reason = t('잎·과실 표면의 물방울을 관찰했다고 입력했습니다.', 'Droplets on leaves or fruit were entered.');
    humidity.action = a('outsideDrier') === 'yes'
      ? t('열 공급 여력과 냉기 유입을 확인한 뒤 스크린·환기·가온 조합을 검토하세요. 실제 표면 건조로 결과를 판단하세요.', 'Check heating capacity and cold-air entry, then review the screen/ventilation/heating combination. Judge the result by actual surface drying.')
      : a('outsideDrier') === 'no'
        ? t('환기만으로 습이 빠질 조건인지 재검토하고, 사용 가능한 제습 능력과 표면 냉각을 확인하세요.', 'Reconsider whether ventilation can remove moisture; check available dehumidification capacity and surface cooling.')
        : humidity.action;
  }
  const nutrition = make('nutrition', '급액 EC·pH와 설정 차이', 'Feed EC/pH versus settings', {
    reason: t('현재 표시 자료에는 드리퍼 급액·배액 EC·pH 실측이 없습니다.', 'The displayed feed contains no measured dripper/drain EC or pH.'),
    confirm: [t('원수·급액·배액 구분, 같은 시각·단위·계기', 'Distinguish source water/feed/drain; align time, units and meter'), t('원액·산액 잔량, 주입과 실제 토출', 'Stock/acid levels, injection and actual discharge')],
    action: t('계기를 확인하고 같은 기준의 급액·배액을 기록하세요. 배액량과 EC는 같은 집계기간으로 비교하세요.', 'Check the meter and record comparable feed/drain values. Compare drain volume and EC over the same collection period.'),
    recheck: t('설정–실제 공급 차이가 줄었는지와 신엽·뿌리 반응을 각각 확인하세요.', 'Check convergence of settings and actual supply separately from new-leaf and root responses.'),
    limit: t('급액 수치의 변화가 작물 증상의 원인 확인이나 회복을 뜻하지 않습니다.', 'A changed feed reading does not establish the cause of crop symptoms or recovery.'),
  });
  if (a('supplyMismatch') === 'yes') {
    nutrition.priority = 'today'; nutrition.reason = t('같은 기준으로 비교한 설정–드리퍼 EC·pH 차이가 있다고 입력했습니다.', 'A setpoint-to-dripper EC/pH mismatch on a comparable basis was entered.');
    nutrition.action = t('원액·산액 잔량, 주입기·계기와 실제 토출을 확인하세요. 확인된 공급 문제를 조정한 뒤 드리퍼에서 다시 측정하세요.', 'Check stock/acid levels, injector, meter and actual discharge. Address the confirmed supply problem and remeasure at the dripper.');
  }
  const rtr = make('rtr', '광·평균온도와 착과 부담', 'Light, mean temperature and fruit load', {
    reason: t('RTR는 같은 기간의 광·평균온도 비교입니다. 생육·착과 상태를 함께 확인하세요.', 'RTR compares light and mean temperature over the same period. Include crop stage and fruit load.'),
    confirm: [t('광·온도 집계기간과 자정 초기화', 'Light/temperature window and midnight reset'), t('실제 활착·착과 부담과 난방·채광 목적', 'Actual establishment/fruit load and heating/light objectives')],
    action: t('완료된 비교기간과 생육단계를 확인한 뒤 온도·수광·착과 관리의 선택지를 비교하세요.', 'Confirm the completed comparison period and growth stage before comparing temperature, light and fruit-load options.'),
    recheck: t('동일한 집계기간의 광·평균온도와 이후 마디·화방·과실 변화를 함께 보세요.', 'Compare light and mean temperature over the same window with subsequent node, truss and fruit changes.'),
    limit: t('기준 안이라는 이유로 설정 유지나 무손상을 보장할 수 없고, 기준 차이를 생식·영양 전환으로 단정할 수 없습니다.', 'Being inside a reference band does not validate unchanged settings or absence of damage; a deviation cannot diagnose a generative/vegetative shift.'),
  });
  const comparisonAvailable = value('temperature') !== null && value('light') !== null && finite(rtrDeltaC)
    && finite(rtrToleranceC) && rtrToleranceC > 0;
  const fullWindow = finite(rtrWindowHours) && rtrWindowHours >= 24 && rtrWindowUsable !== false;
  if (!comparisonAvailable || !fullWindow) {
    rtr.priority = 'data';
    rtr.reason = rtrWindowUsable === false ? t('비교 이력에 하루 미완료·누락·무효 값이 있어 광·평균온도 판단을 보류합니다.', 'The comparison history is incomplete, gapped or invalid; light/mean-temperature judgement is pending.')
      : !comparisonAvailable ? t('유효한 광·온도 비교 자료가 부족합니다.', 'Usable light/temperature comparison data are incomplete.')
      : finite(rtrWindowHours) ? t(`현재 비교기간은 ${rtrWindowHours.toFixed(1)}시간입니다. 24시간 기준과 바로 맞출 수 없습니다.`, `The current window is ${rtrWindowHours.toFixed(1)} hours. It cannot be directly compared with a 24-hour reference.`)
        : t('광·온도의 비교기간이 확인되지 않았습니다.', 'The light/temperature comparison window is unconfirmed.');
    rtr.action = t('같은 기간의 유효한 광·기온 자료를 확보하세요. 하루 미완료나 누락 자료로 난방·환기를 결정하지 마세요.', 'Obtain valid light and temperature data for the same window. An incomplete day or missing data cannot determine heating or ventilation.');
  } else {
    rtr.priority = Math.abs(rtrDeltaC) > rtrToleranceC ? 'today' : 'observe';
    rtr.reason = t(`평균온도–설정 기준 차이는 ${rtrDeltaC >= 0 ? '+' : ''}${rtrDeltaC.toFixed(1)}°C입니다. 현재 작물에 맞는 기준인지는 별도 확인해야 합니다.`, `Mean temperature minus the configured reference is ${rtrDeltaC >= 0 ? '+' : ''}${rtrDeltaC.toFixed(1)}°C. Its fit to the current crop needs separate confirmation.`);
  }
  if (a('stage') === 'establishing') {
    rtr.action = t('정식·활착 상태와 근권 온도·급액·최소 보온 목적을 먼저 확인하세요. 과실이 없다는 이유로 난방을 배제하지 마세요.', 'First check transplant establishment, root-zone temperature, water delivery and minimum heating needs. Absence of fruit does not remove the need for heating.');
  } else if (a('fruitLoad') === 'heavy') {
    rtr.action = t('실제 과실 부하와 수광·초세를 확인하고 온도 운용과 착과 관리의 선택지를 함께 비교하세요. 공통 감온량·적과 수를 정하지 마세요.', 'Check actual fruit load, light interception and vigour and compare temperature and fruit-load options together. Do not infer a universal cooling increment or thinning count.');
  }
  const carbon = make('co2', 'CO₂ 공급과 환기', 'CO₂ supply and ventilation', {
    reason: co2 !== null ? t(`표시 CO₂는 ${co2.toFixed(0)} ppm입니다. 실제 공급과 환기량은 확인되지 않았습니다.`, `Displayed CO₂ is ${co2.toFixed(0)} ppm. Actual supply and ventilation rates are unconfirmed.`)
      : t('표시 CO₂ 자료와 실제 공급 상태를 확인하세요.', 'Confirm the displayed CO₂ data and actual supply.'),
    confirm: [t('공급원·기화기·밸브의 실제 동작', 'Actual operation of source, vaporizer and valve'), t('실제 환기창 상태와 공급 전후 농도', 'Actual vent state and concentration before/after supply')],
    action: t('목표값을 바꾸기 전에 공급과 환기 이력을 대조하세요.', 'Compare supply and ventilation history before changing the target.'),
    recheck: t('실제 공급 복구와 농도 회복을 확인하세요. 생육·수량 효과는 별도로 관찰하세요.', 'Confirm actual supply restoration and concentration recovery. Observe crop growth and yield effects separately.'),
    limit: t('낮은 농도만으로 작물 흡수가 활발하다고 판단하거나 고온을 감수하며 창을 닫도록 권하지 않습니다.', 'Low concentration alone does not establish active crop uptake or justify closing vents despite overheating.'),
  });
  if (co2 === null) carbon.priority = 'data';
  if (a('co2Delivery') === 'fault') {
    carbon.priority = 'first'; carbon.reason = t('CO₂ 공급 장치 문제가 확인됐다고 입력했습니다.', 'A CO₂ supply fault was entered.');
    carbon.action = t('확인된 공급 문제의 복구 상태를 점검하고 공급 후 실제 농도를 측정하세요. 설정 복귀만으로 복구 완료 처리하지 마세요.', 'Check restoration of the confirmed supply fault and measure actual concentration after supply. Restoring a setting does not establish recovery.');
  } else if (a('co2Delivery') === 'working' && a('ventilation') === 'open') {
    carbon.priority = 'today'; carbon.reason = t('실제 공급과 열린 환기창을 확인했다고 입력했습니다.', 'Actual supply and open vents were entered.');
    carbon.action = t('같은 시간의 공급량·농도·환기를 비교하고 비용과 고온 부담을 함께 검토하세요.', 'Compare supply rate, concentration and ventilation over the same period, including cost and heat load.');
  }
  const follow = make('followup', '실행과 작물 반응', 'Execution and crop response', {
    reason: t('조치가 실행됐는지와 작물이 어떻게 반응했는지는 서로 다른 확인 사항입니다.', 'Whether an action occurred and how the crop responded are separate observations.'),
    confirm: [t('변경 대상·시각·실제 동작·작업 완료', 'Changed item, time, actual operation and work completion'), t('같은 개체의 전후 상태와 함께 변한 날씨·관리', 'Before/after on the same plants and concurrent weather/management changes')],
    action: t('계획·실행·후속 반응을 각각 기록하고 남은 증상과 작업 제약을 갱신하세요.', 'Record plans, actual execution and follow-up separately; update residual symptoms and work constraints.'),
    recheck: t('개선·부분 회복·무반응·악화를 같은 지표로 계속 구분하세요.', 'Continue distinguishing improvement, partial recovery, no response and deterioration using the same measure.'),
    limit: t('설정 변경·환경값 회복·작물 회복은 같은 결과가 아니며, 전후 차이만으로 조치 효과를 확정할 수 없습니다.', 'Changed settings, restored environment values and crop recovery are different outcomes; a before/after difference alone does not establish an intervention effect.'),
  });
  if (a('response') === 'worse') {
    follow.priority = 'first'; follow.reason = t('후속 관찰에서 악화·피해 확대를 입력했습니다.', 'Deterioration or spreading damage was entered.');
    follow.action = t('실제 실행 여부와 피해 확대 위치를 확인하고 현장 진단을 재검토하세요. 같은 조치를 반복하기 전에 원인 가정을 다시 보세요.', 'Confirm actual execution and where damage spread; reassess field diagnosis before repeating the same action.');
  } else if (a('execution') === 'done') {
    follow.priority = 'today'; follow.reason = t('실제 동작·작업 완료를 확인했다고 입력했습니다.', 'Actual operation or work completion was entered.');
    if (a('response') === 'partial' || a('response') === 'unchanged') {
      follow.reason += t(' 일부 증상이 남거나 뚜렷한 변화가 없다고 기록했습니다.', ' Residual symptoms or no clear change were recorded.');
      follow.action = t('개선된 점과 남은 증상을 같은 개체에서 추적하고, 공급·근권 상태와 함께 바뀐 조건을 다시 확인하세요.', 'Track improvements and remaining symptoms on the same plants; recheck delivery, root-zone state and concurrent changes.');
    } else if (a('response') === 'improved') {
      follow.reason += t(' 개선 관찰도 기록했습니다.', ' Improvement was also recorded.');
      follow.action = t('같은 지표로 개선이 지속되는지 확인하고 함께 바뀐 날씨·급액·환기를 남기세요. 해당 조치만의 효과로 확정하지 마세요.', 'Track whether improvement persists using the same measure and record concurrent weather, irrigation and ventilation changes. Do not attribute the response solely to that action.');
    }
  } else if (a('execution') === 'planned' || a('response') !== 'unknown') {
    follow.priority = 'today'; follow.action = t('실제 동작과 작업 완료 여부부터 확인하세요. 관찰한 반응을 아직 실행되지 않은 조치의 효과로 연결하지 마세요.', 'First confirm actual operation and work completion. Do not attribute an observed response to an action not confirmed as executed.');
  }
  if (a('workBacklog') === 'yes') {
    if (follow.priority !== 'first') follow.priority = 'today';
    follow.confirm.push(t('가용 인력·장비 시간과 실제 완료량', 'Available labour/equipment hours and actual completed work'));
    follow.action += t(' 가용시간과 완료량을 기준으로 작업 순서를 조정하세요.', ' Adjust work order using available hours and completed work.');
  }
  const rank = { first: 0, today: 1, data: 2, observe: 3 };
  return [water, humidity, nutrition, rtr, carbon, follow].sort((x, y) => rank[x.priority] - rank[y.priority]);
}
