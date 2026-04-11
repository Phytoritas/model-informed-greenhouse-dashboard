import { X } from 'lucide-react';
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
  const copy = locale === 'ko'
    ? {
        title: '질문 도우미',
        description: '질문과 자료 찾기를 한곳에서 봅니다.',
      }
    : {
        title: 'Assistant',
        description: 'Keep ask and search in one place.',
      };

  return (
    <Sheet open={open}>
      <SheetContent className="w-full max-w-[560px] border-l border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-raised)] p-0">
        <div className="flex h-full flex-col">
          <div className="border-b border-[color:var(--sg-outline-soft)] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                  PhytoSync
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-[color:var(--sg-text-strong)]">
                  {copy.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                  {copy.description}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={locale === 'ko' ? '닫기' : 'Close'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[color:var(--sg-text-strong)] shadow-[var(--sg-shadow-card)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <PageSectionTabs tabs={panelTabs} activeId={activePanel} onSelect={onSelectPanel} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
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
