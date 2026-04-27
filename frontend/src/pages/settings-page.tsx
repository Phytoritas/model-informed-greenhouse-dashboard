import type { ReactNode } from 'react';
import { LifeBuoy, PlugZap, WalletCards, type LucideIcon } from 'lucide-react';
import DashboardCard from '../components/common/DashboardCard';
import PageCanvas from '../components/layout/PageCanvas';

interface SettingsPageProps {
  locale: 'ko' | 'en';
  shellCard: ReactNode;
  laneCard: ReactNode;
  supportCard?: ReactNode;
}

export default function SettingsPage({
  locale,
  shellCard,
  laneCard,
  supportCard,
}: SettingsPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Contact',
        title: '연동 상태와 운영 문의',
        description: '센서·날씨·시세 연결, 작물별 비용 기준, 운영 중 확인할 연락·지원 정보를 정리합니다.',
        heroTitle: '운영 문의 전에 연결·비용·지원 맥락을 한 번에 정리',
        heroBody: '이 탭은 단순 설정 페이지가 아니라 백엔드 설정 API와 현재 연결 상태를 확인하는 운영 지원 표면입니다.',
        connection: '연결 상태',
        connectionBody: '센서, 외기, 시세 신호가 오늘 판단에 들어오는지 확인합니다.',
        cost: '비용 기준',
        costBody: '작물별 판매가와 전력 단가를 저장해 RTR·시세 판단에 사용합니다.',
        support: '문의 준비',
        supportBody: '질문 도우미와 함께 전달할 운영 맥락을 정리합니다.',
      }
    : {
        eyebrow: 'Contact',
        title: 'Connectivity and support',
        description: 'Review service links, crop-specific cost assumptions, and support-ready operating details.',
        heroTitle: 'Collect connectivity, cost, and support context before follow-up',
        heroBody: 'This route is a backend settings and support-readiness surface, not a generic contact page.',
        connection: 'Connections',
        connectionBody: 'Check whether sensor, weather, and market signals are feeding today’s decisions.',
        cost: 'Cost basis',
        costBody: 'Store crop-specific price and power assumptions for RTR and market decisions.',
        support: 'Support ready',
        supportBody: 'Keep operating context ready for assistant and support follow-up.',
      };
  const summaryItems = [
    { label: copy.connection, body: copy.connectionBody, Icon: PlugZap, tone: 'sage' },
    { label: copy.cost, body: copy.costBody, Icon: WalletCards, tone: 'tomato' },
    { label: copy.support, body: copy.supportBody, Icon: LifeBuoy, tone: 'olive' },
  ];

  return (
    <PageCanvas eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <DashboardCard
        variant="hero"
        eyebrow={locale === 'ko' ? 'CONTACT WORKSPACE' : 'CONTACT WORKSPACE'}
        title={copy.heroTitle}
        description={copy.heroBody}
      >
        <div className="grid gap-3 md:grid-cols-3">
          {summaryItems.map((item) => (
            <ContactSummaryCard
              key={item.label}
              label={item.label}
              body={item.body}
              Icon={item.Icon}
              tone={item.tone}
            />
          ))}
        </div>
      </DashboardCard>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="min-w-0">{shellCard}</div>
        <div className="min-w-0">{laneCard}</div>
        {supportCard ? <div className="min-w-0 xl:col-span-2">{supportCard}</div> : null}
      </div>
    </PageCanvas>
  );
}

function ContactSummaryCard({
  label,
  body,
  Icon,
  tone,
}: {
  label: string;
  body: string;
  Icon: LucideIcon;
  tone: string;
}) {
  const iconClass = tone === 'tomato'
    ? 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]'
    : tone === 'olive'
      ? 'bg-[color:var(--sg-color-olive-soft)] text-[color:var(--sg-color-olive)]'
      : 'bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-success)]';

  return (
    <article className="sg-panel bg-[color:var(--sg-surface-raised)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[color:var(--sg-text-strong)]">{label}</h3>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sg-radius-md)] ${iconClass}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-[color:var(--sg-text-muted)]">{body}</p>
    </article>
  );
}
