import { useMemo, useRef, useState } from 'react';
import { Check, Database, Loader2, Play, Trash2, Upload } from 'lucide-react';
import type { AppLocale } from '../../i18n/locale';
import type { CropType, TelemetryStatus } from '../../types';
import {
  getDefaultSimulationCsv,
  useSimulationRuntimeControls,
} from '../../hooks/useSimulationRuntimeControls';
import { useEnvironmentDatasets, type EnvironmentDataset } from '../../hooks/useEnvironmentDatasets';
import { Button } from '../ui/button';
import { StatusChip } from '../ui/status-chip';
import { cn } from '../../utils/cn';

interface EnvironmentDatasetCardProps {
  locale: AppLocale;
  crop: CropType;
  telemetryStatus?: TelemetryStatus;
}

function formatBytes(size: number | null): string | null {
  if (size === null || !Number.isFinite(size)) {
    return null;
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDay(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  // The dataset start/end are ISO strings; show only the calendar day, which is what a
  // grower cares about when picking a period. Fall back to the raw prefix if parsing fails.
  const day = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : iso;
}

export default function EnvironmentDatasetCard({
  locale,
  crop,
  telemetryStatus,
}: EnvironmentDatasetCardProps) {
  const datasets = useEnvironmentDatasets();
  const runtime = useSimulationRuntimeControls(crop);
  // `null` means "follow the crop's default"; a name means the grower picked it.
  const [picked, setPicked] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo(() => datasets.datasets ?? [], [datasets.datasets]);
  const defaultName = getDefaultSimulationCsv(crop);
  // Resolve the effective selection: keep the grower's pick only while it still exists,
  // otherwise fall back to the crop default (covers crop switches and deletions).
  const selectedDataset = useMemo(() => {
    if (picked && options.some((dataset) => dataset.name === picked)) {
      return picked;
    }
    return defaultName;
  }, [picked, options, defaultName]);
  const selectedInfo = options.find((dataset) => dataset.name === selectedDataset) ?? null;
  const selectedIsUploaded = selectedInfo?.kind === 'uploaded';
  const isStarting = runtime.state.start.status === 'loading';
  const busy = datasets.busy || isStarting;

  const copy = locale === 'ko'
    ? {
        eyebrow: 'Environment dataset',
        title: '환경 데이터셋 선택',
        description: '시뮬레이션을 돌릴 환경 CSV를 고르고, 필요하면 내 데이터를 넣으세요.',
        countLabel: (n: number) => `${n}개`,
        loading: '데이터셋을 불러오는 중…',
        empty: '표시할 데이터셋이 없습니다. CSV를 넣어 시작하세요.',
        bundledTag: '기본',
        uploadedTag: '내 데이터',
        rows: (n: number) => `${n.toLocaleString()}행`,
        upload: 'CSV 넣기',
        uploading: '올리는 중…',
        delete: '삭제',
        start: '이 데이터로 시작',
        starting: '시작하는 중…',
        columnsHint: (columns: string) => `필수 컬럼: ${columns}`,
        selected: '선택됨',
        startFailed: '시작 실패',
        started: '시뮬레이션을 시작했습니다.',
      }
    : {
        eyebrow: 'Environment dataset',
        title: 'Choose environment dataset',
        description: 'Pick the environment CSV to simulate on, and insert your own if needed.',
        countLabel: (n: number) => `${n} available`,
        loading: 'Loading datasets…',
        empty: 'No datasets to show. Insert a CSV to begin.',
        bundledTag: 'bundled',
        uploadedTag: 'yours',
        rows: (n: number) => `${n.toLocaleString()} rows`,
        upload: 'Insert CSV',
        uploading: 'Uploading…',
        delete: 'Delete',
        start: 'Start on this data',
        starting: 'Starting…',
        columnsHint: (columns: string) => `Required columns: ${columns}`,
        selected: 'Selected',
        startFailed: 'Start failed',
        started: 'Simulation started.',
      };

  const handleUploadFile = async (file: File | null) => {
    if (!file) {
      return;
    }
    const inserted = await datasets.upload(file);
    if (inserted) {
      setPicked(inserted.name);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!selectedIsUploaded) {
      return;
    }
    const removed = await datasets.remove(selectedDataset);
    if (removed) {
      setPicked(null);
    }
  };

  const handleStart = async () => {
    await runtime.start('auto', selectedDataset);
  };

  const buildMeta = (dataset: EnvironmentDataset): string => {
    const parts: string[] = [];
    if (typeof dataset.rows === 'number') {
      parts.push(copy.rows(dataset.rows));
    }
    const start = formatDay(dataset.start);
    const end = formatDay(dataset.end);
    if (start && end) {
      parts.push(start === end ? start : `${start} ~ ${end}`);
    }
    if (parts.length === 0) {
      const size = formatBytes(dataset.size_bytes);
      if (size) {
        parts.push(size);
      }
    }
    return parts.join(' · ');
  };

  const startState = runtime.state.start;

  return (
    <section className="sg-panel p-4" aria-labelledby="environment-dataset-title">
      <div className="flex flex-col gap-2 border-b border-[color:var(--sg-outline-soft)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="sg-eyebrow">{copy.eyebrow}</p>
          <h2 id="environment-dataset-title" className="mt-1 text-lg font-bold text-[color:var(--sg-text-strong)]">
            {copy.title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
            {copy.description}
          </p>
        </div>
        <StatusChip tone="muted" icon={<Database className="h-3.5 w-3.5" aria-hidden="true" />}>
          {copy.countLabel(options.length)}
        </StatusChip>
      </div>

      {datasets.loading && options.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-[color:var(--sg-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {copy.loading}
        </p>
      ) : options.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--sg-text-muted)]">{copy.empty}</p>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby="environment-dataset-title"
          className="mt-4 grid gap-2"
        >
          {options.map((dataset) => {
            const isSelected = dataset.name === selectedDataset;
            const meta = buildMeta(dataset);
            return (
              <button
                key={dataset.name}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={busy}
                onClick={() => setPicked(dataset.name)}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--sg-radius-sm)] border px-3 py-2.5 text-left transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]',
                  isSelected
                    ? 'border-[color:var(--sg-color-primary)] bg-[color:var(--sg-color-primary-soft)]'
                    : 'border-[color:var(--sg-outline-soft)] bg-white hover:bg-[color:var(--sg-surface-muted)]',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-[color:var(--sg-color-primary)] bg-[color:var(--sg-color-primary)] text-white'
                      : 'border-[color:var(--sg-outline-soft)] bg-white',
                  )}
                >
                  {isSelected ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold text-[color:var(--sg-text-strong)]">{dataset.name}</span>
                    <StatusChip tone={dataset.kind === 'bundled' ? 'stable' : 'growth'}>
                      {dataset.kind === 'bundled' ? copy.bundledTag : copy.uploadedTag}
                    </StatusChip>
                  </span>
                  {meta ? (
                    <span className="sg-data-number mt-0.5 block text-xs text-[color:var(--sg-text-muted)]">{meta}</span>
                  ) : null}
                </span>
                {isSelected ? (
                  <span className="flex-shrink-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--sg-color-primary)]">
                    {copy.selected}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => { void handleUploadFile(event.target.files?.[0] ?? null); }}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={busy || options.length === 0} onClick={() => { void handleStart(); }}>
          {isStarting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          {isStarting ? copy.starting : copy.start}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => fileInputRef.current?.click()}>
          {datasets.busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
          {datasets.busy ? copy.uploading : copy.upload}
        </Button>
        {selectedIsUploaded ? (
          <Button variant="ghost" disabled={busy} onClick={() => { void handleDelete(); }} aria-label={copy.delete}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {copy.delete}
          </Button>
        ) : null}
        {telemetryStatus === 'live' ? (
          <StatusChip tone="growth" className="ml-auto">{telemetryStatus}</StatusChip>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] leading-4 text-[color:var(--sg-text-faint)]">
        {copy.columnsHint(datasets.requiredColumns.join(', '))}
      </p>
      {datasets.error ? (
        <p className="mt-1 text-[11px] leading-4 text-[color:var(--sg-color-danger,#c0392b)]">{datasets.error}</p>
      ) : null}
      {startState.status === 'error' ? (
        <p className="mt-1 text-[11px] leading-4 text-[color:var(--sg-color-danger,#c0392b)]">
          {copy.startFailed}: {startState.message}
        </p>
      ) : null}
      {startState.status === 'success' ? (
        <p className="mt-1 text-[11px] leading-4 text-[color:var(--sg-color-success,#2e7d32)]" aria-live="polite">
          {copy.started}
        </p>
      ) : null}
    </section>
  );
}
