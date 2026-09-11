import { useEffect, useRef, useState } from 'react';
import { Loader2, Pause, Play, RefreshCw, Square, Trash2, Upload } from 'lucide-react';
import type { AppLocale } from '../../i18n/locale';
import type { CropType, TelemetryStatus } from '../../types';
import {
  DEFAULT_SIMULATION_PACE, getDefaultSimulationCsv, isSimulationPacePreset,
  readStoredSimulationPace, simulationRuntimePacePresets, simulationRuntimeTimeSteps,
  writeStoredSimulationPace, type SimulationRuntimePacePreset,
  type SimulationRuntimeTimeStep, useSimulationRuntimeControls,
} from '../../hooks/useSimulationRuntimeControls';
import { useEnvironmentDatasets } from '../../hooks/useEnvironmentDatasets';
import { Button } from '../ui/button';
import { Select } from '../ui/select';
import { StatusChip } from '../ui/status-chip';

interface SimulationRuntimePanelProps {
  locale: AppLocale;
  crop: CropType;
  telemetryStatus: TelemetryStatus;
  telemetryDetail?: string | null;
}

export default function SimulationRuntimePanel({ locale, crop }: SimulationRuntimePanelProps) {
  const ko = locale === 'ko';
  const runtime = useSimulationRuntimeControls(crop);
  const datasets = useEnvironmentDatasets();
  const [timeStep, setTimeStep] = useState<SimulationRuntimeTimeStep>('auto');
  const [pace, setPace] = useState<SimulationRuntimePacePreset>(() => readStoredSimulationPace() ?? DEFAULT_SIMULATION_PACE);
  const [selectedDataset, setSelectedDataset] = useState(() => getDefaultSimulationCsv(crop));
  const [datasetEdited, setDatasetEdited] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = runtime.status;
  const busy = Object.values(runtime.state).some(action => action.status === 'loading');
  const paused = status?.paused === true;
  const running = status?.running === true && !paused;
  const canAct = !busy && !runtime.statusLoading && !runtime.statusError && status !== null;
  const datasetOptions = datasets.datasets ?? [];
  const selectedInfo = datasetOptions.find(dataset => dataset.name === selectedDataset);
  const latest = runtime.latestAction ? runtime.state[runtime.latestAction] : null;
  const names: Record<string, string> = ko
    ? { idle: '시작 전', active: '실행 중', paused: '일시정지', stopped: '정지', completed: '계산 완료', stalled: '계산 지연', error: '계산 오류', failed: '계산 오류' }
    : { idle: 'Ready', active: 'Running', paused: 'Paused', stopped: 'Stopped', completed: 'Complete', stalled: 'Calculation delayed', error: 'Calculation error', failed: 'Calculation error' };
  const actionNames: Record<string, string> = ko
    ? { start: '시작', pause: '일시정지', resume: '재개', stop: '정지', speed: '속도 변경', step: '계산', run: '실행' }
    : { start: 'Start', pause: 'Pause', resume: 'Resume', stop: 'Stop', speed: 'Speed change', step: 'Step', run: 'Run' };
  const stateLabel = runtime.statusLoading ? (ko ? '상태 확인 중' : 'Checking status')
    : runtime.statusError ? (ko ? '상태 확인 필요' : 'Check connection')
      : names[status?.status ?? ''] ?? (ko ? '상태 확인 필요' : 'Status unavailable');
  const simulatedDate = status?.simulatedAt ? new Date(status.simulatedAt) : null;
  const simulatedLabel = simulatedDate && Number.isFinite(simulatedDate.getTime())
    ? simulatedDate.toLocaleString(ko ? 'ko-KR' : 'en-GB', { timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' KST'
    : (ko ? '계산 전' : 'Not started');

  useEffect(() => {
    if (!datasetEdited && status?.dataSource) setSelectedDataset(status.dataSource);
  }, [datasetEdited, status?.dataSource]);
  useEffect(() => {
    if (typeof status?.pace === 'number' && isSimulationPacePreset(status.pace)) setPace(status.pace);
  }, [status?.pace]);

  const upload = async (file: File | null) => {
    if (!file) return;
    const inserted = await datasets.upload(file);
    if (inserted) { setSelectedDataset(inserted.name); setDatasetEdited(true); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const changePace = async (value: SimulationRuntimePacePreset) => {
    const result = await runtime.setSpeed(value);
    if (result) { setPace(value); writeStoredSimulationPace(value); }
  };

  return (
    <section className="sg-panel space-y-4 p-5" aria-labelledby="simulation-runtime-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="simulation-runtime-title" className="text-lg font-bold">{ko ? '시뮬레이션 실행' : 'Run simulation'}</h2>
          <p className="mt-1 text-sm text-[color:var(--sg-text-muted)]">{ko ? '환경 데이터를 재생하며 작물과 설정의 반응을 확인합니다.' : 'Replay environmental data to explore crop and setting responses.'}</p>
        </div>
        <StatusChip tone={runtime.statusError ? 'warning' : running ? 'growth' : 'muted'}>{stateLabel}</StatusChip>
      </div>
      <dl className="grid gap-3 rounded-xl bg-[color:var(--sg-surface-muted)] p-3 text-sm sm:grid-cols-3">
        <div><dt className="text-xs text-[color:var(--sg-text-muted)]">{ko ? '현재 데이터' : 'Current data'}</dt><dd className="mt-1 break-all font-semibold">{status?.dataSource ?? (ko ? '선택 전' : 'Not selected')}</dd></div>
        <div><dt className="text-xs text-[color:var(--sg-text-muted)]">{ko ? '시뮬레이션 시각' : 'Simulation time'}</dt><dd className="mt-1 font-semibold">{simulatedLabel}</dd></div>
        <div><dt className="text-xs text-[color:var(--sg-text-muted)]">{ko ? '진행률' : 'Progress'}</dt><dd className="mt-1 font-semibold">{typeof status?.progress === 'number' ? status.progress.toFixed(1) + ' %' : '—'}</dd></div>
      </dl>
      {runtime.statusError && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[color:var(--sg-status-warning-bg)] p-3 text-sm">
        <span>{runtime.statusError}</span><Button size="sm" variant="secondary" onClick={() => { void runtime.refreshStatus(); }}><RefreshCw className="h-4 w-4" />{ko ? '다시 확인' : 'Retry'}</Button>
      </div>}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-[color:var(--sg-outline-soft)] p-3">
          <label className="block text-xs font-semibold">{ko ? '환경 데이터셋' : 'Environment dataset'}
            <Select aria-label={ko ? '환경 데이터셋' : 'Environment dataset'} className="mt-1" value={selectedDataset} disabled={busy || datasets.busy} onChange={event => { setSelectedDataset(event.target.value); setDatasetEdited(true); }}>
              {!selectedInfo && <option value={selectedDataset}>{selectedDataset}</option>}
              {datasetOptions.map(dataset => <option key={dataset.name} value={dataset.name}>{dataset.name}{dataset.kind === 'uploaded' ? (ko ? ' · 내 데이터' : ' · uploaded') : ''}</option>)}
            </Select>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" aria-label={ko ? '환경 CSV 파일' : 'Environment CSV file'} onChange={event => { void upload(event.target.files?.[0] ?? null); }} />
            <Button size="sm" variant="secondary" disabled={busy || datasets.busy} onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" />{datasets.busy ? (ko ? '처리 중…' : 'Working…') : (ko ? 'CSV 넣기' : 'Upload CSV')}</Button>
            {selectedInfo?.kind === 'uploaded' && <Button size="sm" variant="ghost" disabled={busy || datasets.busy || ((running || paused) && status?.dataSource === selectedDataset)} onClick={async () => {
              if (await datasets.remove(selectedDataset)) { setSelectedDataset(getDefaultSimulationCsv(crop)); setDatasetEdited(true); }
            }}><Trash2 className="h-4 w-4" />{ko ? '삭제' : 'Delete'}</Button>}
            {selectedInfo?.rows !== null && selectedInfo?.rows !== undefined && <span className="text-xs text-[color:var(--sg-text-muted)]">{selectedInfo.rows.toLocaleString()} {ko ? '행' : 'rows'}</span>}
          </div>
          {datasets.error && <p role="alert" className="text-xs text-[color:var(--sg-status-warning-text)]">{datasets.error}</p>}
          {datasets.requiredColumns.length > 0 && <details className="text-xs text-[color:var(--sg-text-muted)]"><summary className="cursor-pointer">{ko ? 'CSV 형식 보기' : 'CSV format'}</summary><p className="mt-1 break-words">{datasets.requiredColumns.join(', ')}</p></details>}
          <label className="block text-xs font-semibold">{ko ? '계산 간격' : 'Calculation interval'}
            <Select id="runtime-time-step" aria-label={ko ? '계산 간격' : 'Calculation interval'} value={timeStep} disabled={busy || running || paused} className="mt-1" onChange={event => setTimeStep(event.target.value as SimulationRuntimeTimeStep)}>
              {simulationRuntimeTimeSteps.map(value => <option value={value} key={value}>{value === 'auto' ? (ko ? '데이터 간격 사용' : 'Use data interval') : value}</option>)}
            </Select>
          </label>
        </div>
        <div className="space-y-3 rounded-xl border border-[color:var(--sg-outline-soft)] p-3">
          <h3 className="text-xs font-semibold">{ko ? '재생 속도' : 'Playback speed'}</h3>
          <div role="group" aria-label={ko ? '재생 속도' : 'Playback speed'} className="grid grid-cols-3 gap-2">
            {simulationRuntimePacePresets.map(value => <button type="button" key={value} aria-label={value + ' s/s'} aria-pressed={pace === value} disabled={!canAct} onClick={() => { void changePace(value); }} className={'rounded-lg border px-2 py-2 text-sm font-semibold disabled:opacity-40 ' + (pace === value ? 'border-[color:var(--sg-color-primary)] bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]' : 'border-[color:var(--sg-outline-soft)]')}>{value}×</button>)}
          </div>
          <p className="text-xs text-[color:var(--sg-text-muted)]">{ko ? '실제 1초에 시뮬레이션 ' + pace + '초' : pace + ' simulated seconds per real second'}</p>
          <div className="flex flex-wrap gap-2 border-t border-[color:var(--sg-outline-soft)] pt-3">
            <Button disabled={!canAct || running || paused || datasets.busy} onClick={async () => { const result = await runtime.start(timeStep, selectedDataset); if (result) setDatasetEdited(false); }}><Play className="h-4 w-4" />{ko ? '시작' : 'Start'}</Button>
            <Button variant="secondary" disabled={!canAct || !running} onClick={() => { void runtime.pause(); }}><Pause className="h-4 w-4" />{ko ? '일시정지' : 'Pause'}</Button>
            <Button variant="secondary" disabled={!canAct || !paused} onClick={() => { void runtime.resume(); }}><Play className="h-4 w-4" />{ko ? '재개' : 'Resume'}</Button>
            <Button variant="secondary" disabled={!canAct || (!running && !paused)} onClick={() => { void runtime.stop(); }}><Square className="h-4 w-4" />{ko ? '정지' : 'Stop'}</Button>
          </div>
          <p className="text-xs text-[color:var(--sg-text-muted)]">{ko ? '시작하면 선택한 데이터의 처음부터 새로 계산합니다.' : 'Start begins a new calculation from the selected dataset’s first row.'}</p>
        </div>
      </div>
      {latest && latest.status !== 'idle' && <div role={latest.status === 'error' ? 'alert' : 'status'} className="flex items-center gap-2 rounded-lg bg-[color:var(--sg-surface-muted)] px-3 py-2 text-sm">
        {latest.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
        {actionNames[runtime.latestAction ?? 'start']}: {latest.status === 'loading' ? (ko ? '처리 중…' : 'Working…') : latest.status === 'success' ? (ko ? '요청이 처리되었습니다.' : 'Request accepted.') : (ko ? '처리하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요.' : 'The request failed. Check the connection and retry.')}
      </div>}
    </section>
  );
}
