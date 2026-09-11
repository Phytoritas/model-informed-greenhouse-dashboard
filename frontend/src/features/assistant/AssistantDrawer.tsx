import { useId } from 'react';
import { Leaf, X } from 'lucide-react';
import type { RagAssistantOpenRequest } from '../../components/chat/ragAssistantTypes';
import AskSearchPage from '../../components/phyto/AskSearchPage';
import PageSectionTabs from '../../components/phyto/PageSectionTabs';
import { Sheet, SheetContent } from '../../components/ui/sheet';
import type { SmartGrowKnowledgeSummary } from '../../hooks/useSmartGrowKnowledge';
import type { AppLocale } from '../../i18n/locale';
import type {
  AdvancedModelMetrics,
  CropType,
  ForecastData,
  ProducePricesPayload,
  RtrProfile,
  SensorData,
  WeatherOutlook,
} from '../../types';

type AssistantPanelId = 'assistant-chat' | 'assistant-search' | 'assistant-history';

interface AssistantDrawerProps {
  open: boolean;
  locale: AppLocale;
  crop: CropType;
  cropLabel: string;
  panelTabs: Array<{ id: string; label: string }>;
  activePanel: AssistantPanelId;
  summary: SmartGrowKnowledgeSummary | null;
  searchRequest?: RagAssistantOpenRequest | null;
  chatRequest?: { query: string; nonce: number } | null;
  currentData: SensorData;
  metrics: AdvancedModelMetrics;
  forecast?: ForecastData | null;
  history?: SensorData[];
  producePrices?: ProducePricesPayload | null;
  weather?: WeatherOutlook | null;
  rtrProfile?: RtrProfile | null;
  smartGrowLoading?: boolean;
  smartGrowError?: string | null;
  onClose: () => void;
  onSelectPanel: (panelId: string) => void;
  onOpenSearch: (request?: Omit<RagAssistantOpenRequest, 'nonce'>) => void;
}

export default function AssistantDrawer({
  open,
  locale,
  crop,
  cropLabel,
  panelTabs,
  activePanel,
  summary,
  searchRequest = null,
  chatRequest = null,
  currentData,
  metrics,
  forecast = null,
  history = [],
  producePrices = null,
  weather = null,
  rtrProfile = null,
  smartGrowLoading = false,
  smartGrowError = null,
  onClose,
  onSelectPanel,
  onOpenSearch,
}: AssistantDrawerProps) {
  const titleId = useId();
  const copy = locale === 'ko'
    ? {
        title: '질문 도우미',
        description: '현재 온실 상태와 재배 자료를 함께 살펴보세요.',
        close: '닫기',
      }
    : {
        title: 'Assistant',
        description: 'Explore the greenhouse context and growing references together.',
        close: 'Close',
      };

  return (
    <Sheet open={open} onClose={onClose} labelledBy={titleId}>
      <SheetContent className="assistant-drawer-surface h-[100dvh] w-full max-w-[720px] overflow-hidden border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-bg)] p-0 shadow-[var(--sg-shadow-frame)] sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:w-[min(100vw-1.5rem,720px)] sm:rounded-2xl">
        <div className="flex h-full flex-col">
          <div className="border-b border-[color:var(--sg-outline-soft)] bg-white px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]">
                    <Leaf className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--sg-text-muted)]">PhytoSync · {cropLabel}</span>
                </div>
                <h2 id={titleId} className="mt-2 text-xl font-bold tracking-normal text-[color:var(--sg-text-strong)]">
                  {copy.title}
                </h2>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[color:var(--sg-text-muted)]">
                  {copy.description}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={copy.close}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-text-strong)] shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <PageSectionTabs tabs={panelTabs} activeId={activePanel} onSelect={onSelectPanel} />
            </div>
          </div>
          <div className={`min-h-0 flex-1 overflow-y-auto bg-[color:var(--sg-bg)] p-3 sm:p-4 ${activePanel === 'assistant-chat' ? 'assistant-drawer-chat-body' : ''}`}>
            <AskSearchPage
              locale={locale}
              crop={crop}
              cropLabel={cropLabel}
              summary={summary}
              activePanel={activePanel}
              searchRequest={searchRequest}
              chatRequest={chatRequest}
              currentData={currentData}
              metrics={metrics}
              forecast={forecast}
              history={history}
              producePrices={producePrices}
              weather={weather}
              rtrProfile={rtrProfile}
              smartGrowLoading={smartGrowLoading}
              smartGrowError={smartGrowError}
              onOpenSearch={onOpenSearch}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
