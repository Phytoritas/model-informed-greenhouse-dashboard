import { BookOpen, Leaf, MessageCircle, X } from 'lucide-react';
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
        description: '질문, 자료 목차, 농약·양액 근거를 농가 작업 순서에 맞춰 정리합니다.',
        badge: '농가 작업형 답변',
        close: '닫기',
      }
    : {
        title: 'Assistant',
        description: 'Ask questions, browse source material, and keep agronomy evidence in one operating flow.',
        badge: 'Grower-ready answers',
        close: 'Close',
      };

  return (
    <Sheet open={open}>
      <SheetContent className="m-3 h-[calc(100%-1.5rem)] w-[min(100vw-1.5rem,720px)] max-w-[720px] overflow-hidden rounded-[var(--sg-radius-xl)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-bg)] p-0 shadow-[var(--sg-shadow-frame)]">
        <div className="flex h-full flex-col">
          <div className="border-b border-[color:var(--sg-outline-soft)] bg-[linear-gradient(135deg,var(--sg-surface-strong),var(--sg-color-off-white))] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--sg-color-olive)] text-white shadow-[var(--sg-shadow-card)]">
                    <Leaf className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="sg-eyebrow text-[color:var(--sg-color-olive)]">PhytoSync</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--sg-color-sage)] bg-[color:var(--sg-color-sage-soft)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--sg-color-olive)]">
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    {copy.badge}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-normal text-[color:var(--sg-text-strong)]">
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
            <div className="mt-4 rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-white/80 p-2 shadow-[var(--sg-shadow-card)]">
              <PageSectionTabs tabs={panelTabs} activeId={activePanel} onSelect={onSelectPanel} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--sg-bg)] px-5 py-5">
            <div className="mb-4 flex items-center gap-2 rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-strong)] px-3 py-2 text-xs font-semibold text-[color:var(--sg-text-muted)] shadow-[var(--sg-shadow-card)]">
              <BookOpen className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
              {locale === 'ko' ? '검색 결과는 목차와 페이지처럼 탐색할 수 있습니다.' : 'Search results can be browsed like a table of contents and pages.'}
            </div>
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
