import DashboardCard from '../common/DashboardCard';
import { localizeSmartGrowSurfaceNames } from '../../utils/smartGrowSurfaceNames';

interface AskResultSummaryProps {
  locale: 'ko' | 'en';
  readyTools: string[];
  note: string;
  signals: Array<{ label: string; value: string }>;
}

export default function AskResultSummary({
  locale,
  readyTools,
  note,
  signals,
}: AskResultSummaryProps) {
  const localizedReadyTools = localizeSmartGrowSurfaceNames(readyTools, locale);
  const copy = locale === 'ko'
    ? {
        eyebrow: '바로 이어질 화면',
        title: '검색 뒤에 열릴 운영 도구',
        description: '자료를 찾은 뒤 바로 연결될 운영 화면과 현재 신호를 함께 보여줍니다.',
        tools: '준비된 도구',
      }
    : {
        eyebrow: 'Next screens',
        title: 'Operating tools linked to search',
        description: 'Show the next tools and the live signals that will matter after search.',
        tools: 'Ready tools',
      };

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      variant="scenario"
    >
      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <div className="sg-advisor-inset space-y-3">
          <div className="sg-eyebrow">{copy.tools}</div>
          <div className="flex flex-wrap gap-2">
            {localizedReadyTools.length > 0 ? localizedReadyTools.map((tool) => (
              <span
                key={tool}
                className="rounded-full bg-white/86 px-3 py-2 text-xs font-semibold text-[color:var(--sg-text-muted)]"
                style={{ boxShadow: 'var(--sg-shadow-card)' }}
              >
                {tool}
              </span>
            )) : (
              <span className="text-sm text-[color:var(--sg-text-faint)]">
                {locale === 'ko' ? '연결된 도구가 아직 없습니다.' : 'No linked tool is ready yet.'}
              </span>
            )}
          </div>
          <p className="text-sm leading-7 text-[color:var(--sg-text-muted)]">{note}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {signals.map((signal) => (
            <div key={signal.label} className="sg-advisor-inset-soft">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]">
                {signal.label}
              </div>
              <div className="mt-2 text-sm font-semibold text-[color:var(--sg-text-strong)]">
                {signal.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardCard>
  );
}
