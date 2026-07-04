import { Bell, Leaf, Mail, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { SectionHeader } from '../components/ui/section-header';
import type { AppLocale } from '../i18n/locale';

interface ContactRoutePageProps {
  locale: AppLocale;
  onOpenAssistant: () => void;
}

const CONTACT_EMAIL = 'contact@phytosync.local';

export default function ContactRoutePage({ locale, onOpenAssistant }: ContactRoutePageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Contact',
        title: '문의하기',
        description: 'PhytoSync 운영, 도입, 데이터 연동에 대한 문의 채널을 한곳에 모았습니다.',
        emailTitle: '이메일 문의',
        emailBody: '도입 상담과 운영 문의는 이메일로 보내주세요. 영업일 기준 1일 안에 답합니다.',
        emailAction: '이메일 보내기',
        assistantTitle: '질문 도우미',
        assistantBody: '재배, 환경, 자료에 대한 질문은 질문 도우미에서 바로 확인할 수 있습니다.',
        assistantAction: '질문 도우미 열기',
        statusTitle: '온실 상태 확인',
        statusBody: '긴급 알림과 센서 상태는 알림 화면에서 실시간으로 확인합니다.',
        statusAction: '긴급 알림 열기',
        ctaEyebrow: '다음 단계',
        ctaTitle: '한 플랫폼에서 더 나은 판단과 안정적인 수확을 만드세요.',
        ctaSupport: '업무 이메일을 남기면 시작 안내를 보내드립니다.',
        emailLabel: '업무 이메일',
        emailPlaceholder: '업무 이메일 입력',
        submit: '무료로 시작',
        rights: '© 2026 PhytoSync. 모든 권리 보유.',
      }
    : {
        eyebrow: 'Contact',
        title: 'Contact us',
        description: 'Every PhytoSync onboarding, operations, and data question starts here.',
        emailTitle: 'Email',
        emailBody: 'Send onboarding and operations questions by email. We reply within one business day.',
        emailAction: 'Send email',
        assistantTitle: 'Ask Assistant',
        assistantBody: 'Cultivation, climate, and knowledge questions get instant answers in the assistant.',
        assistantAction: 'Open assistant',
        statusTitle: 'Greenhouse status',
        statusBody: 'Urgent alerts and sensor freshness live on the alerts screen.',
        statusAction: 'Open alerts',
        ctaEyebrow: 'Next Step',
        ctaTitle: 'One platform. Better decisions. Stronger harvests.',
        ctaSupport: 'Leave your work email and we will send the onboarding guide.',
        emailLabel: 'Email',
        emailPlaceholder: 'Enter your work email',
        submit: 'Get Started Free',
        rights: '© 2026 PhytoSync. All rights reserved.',
      };

  const channels = [
    {
      key: 'email',
      icon: Mail,
      title: copy.emailTitle,
      body: copy.emailBody,
      action: (
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[color:var(--sg-color-primary)] px-3.5 text-xs font-bold text-white shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2"
        >
          <Mail className="h-4 w-4" aria-hidden="true" />
          {copy.emailAction}
        </a>
      ),
      detail: CONTACT_EMAIL,
    },
    {
      key: 'assistant',
      icon: MessageCircle,
      title: copy.assistantTitle,
      body: copy.assistantBody,
      action: (
        <Button type="button" variant="secondary" size="sm" className="rounded-full" onClick={onOpenAssistant}>
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {copy.assistantAction}
        </Button>
      ),
      detail: null,
    },
    {
      key: 'status',
      icon: Bell,
      title: copy.statusTitle,
      body: copy.statusBody,
      action: (
        <Link
          to="/alerts"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[color:var(--sg-outline-soft)] bg-white px-3.5 text-xs font-bold text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          {copy.statusAction}
        </Link>
      ),
      detail: null,
    },
  ];

  return (
    <div className="min-w-0 space-y-4" data-command-surface="contact">
      <section className="sg-panel space-y-4 p-4" aria-labelledby="contact-title">
        <SectionHeader
          density="compact"
          eyebrow={copy.eyebrow}
          title={copy.title}
          titleId="contact-title"
          description={copy.description}
        />
        <div className="grid gap-3 md:grid-cols-3">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <article
                key={channel.key}
                className="flex min-w-0 flex-col gap-3 rounded-[var(--sg-radius-md)] border border-[color:var(--sg-outline-soft)] bg-white p-4 shadow-[var(--sg-shadow-card)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[color:var(--sg-text-strong)]">{channel.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--sg-text-muted)]">{channel.body}</p>
                  {channel.detail ? (
                    <p className="mt-1 truncate text-xs font-semibold text-[color:var(--sg-text-strong)]">{channel.detail}</p>
                  ) : null}
                </div>
                <div>{channel.action}</div>
              </article>
            );
          })}
        </div>
      </section>
      <section
        id="contact"
        className="sg-panel grid gap-3 bg-[color:var(--sg-surface-warm)] p-4 md:grid-cols-[minmax(0,1fr)_minmax(300px,0.76fr)] md:items-center"
        aria-labelledby="contact-cta-title"
      >
        <div className="flex items-center gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sg-radius-md)] bg-[color:var(--sg-color-sage-soft)] text-[color:var(--sg-color-olive)]">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="sg-eyebrow">{copy.ctaEyebrow}</p>
            <h2 id="contact-cta-title" className="text-base font-bold text-[color:var(--sg-text-strong)]">{copy.ctaTitle}</h2>
            <p className="mt-0.5 text-xs text-[color:var(--sg-text-muted)]">{copy.ctaSupport}</p>
          </div>
        </div>
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => event.preventDefault()}>
          <label className="sr-only" htmlFor="contact-email">{copy.emailLabel}</label>
          <Input id="contact-email" type="email" aria-label={copy.emailLabel} placeholder={copy.emailPlaceholder} />
          <Button type="submit" variant="primary" className="shrink-0">{copy.submit}</Button>
        </form>
      </section>
      <footer className="flex flex-col gap-2 border-t border-[color:var(--sg-outline-soft)] py-2 text-xs text-[color:var(--sg-text-muted)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 font-semibold text-[color:var(--sg-text-strong)]">
          <Leaf className="h-4 w-4 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
          PhytoSync
        </div>
        <div>{copy.rights}</div>
      </footer>
    </div>
  );
}
