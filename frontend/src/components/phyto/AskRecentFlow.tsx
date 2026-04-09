import DashboardCard from '../common/DashboardCard';

interface AskRecentFlowProps {
  locale: 'ko' | 'en';
  nowItems: string[];
  todayItems: string[];
  pendingParsers: string[];
}

export default function AskRecentFlow({
  locale,
  nowItems,
  todayItems,
  pendingParsers,
}: AskRecentFlowProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: '최근 흐름',
        title: '지금 이어지는 질문 맥락',
        description: '최근 운영 조언과 대기 중인 자료 준비 상태를 같이 확인합니다.',
        now: '지금 바로 확인',
        today: '오늘 이어서 보기',
        pending: '준비 중인 자료',
        empty: '아직 이어진 질문 흐름이 없습니다.',
      }
    : {
        eyebrow: 'Recent flow',
        title: 'Questions already in motion',
        description: 'Keep the latest actions and pending material prep in one reading lane.',
        now: 'Check now',
        today: 'Continue today',
        pending: 'Materials preparing',
        empty: 'No follow-up question flow has been assembled yet.',
      };

  const renderList = (items: string[], emptyLabel: string) => (
    items.length > 0 ? (
      <ul className="space-y-2 text-sm text-[color:var(--sg-text)]">
        {items.map((item) => (
          <li key={item} className="rounded-[18px] bg-white/82 px-3 py-2" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-[color:var(--sg-text-faint)]">{emptyLabel}</p>
    )
  );

  return (
    <DashboardCard
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      className="sg-card-muted"
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="sg-advisor-inset space-y-3">
          <div className="sg-eyebrow">{copy.now}</div>
          {renderList(nowItems, copy.empty)}
        </div>
        <div className="space-y-4">
          <div className="sg-advisor-inset space-y-3">
            <div className="sg-eyebrow">{copy.today}</div>
            {renderList(todayItems, copy.empty)}
          </div>
          <div className="sg-advisor-inset space-y-3">
            <div className="sg-eyebrow">{copy.pending}</div>
            {renderList(pendingParsers, locale === 'ko' ? '대기 중인 자료가 없습니다.' : 'No pending source preparation.')}
          </div>
        </div>
      </div>
    </DashboardCard>
  );
}
