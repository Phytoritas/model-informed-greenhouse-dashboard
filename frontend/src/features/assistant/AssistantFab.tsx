import { MessageCircle } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';

interface AssistantFabProps {
  onClick: () => void;
}

export default function AssistantFab({ onClick }: AssistantFabProps) {
  const { locale } = useLocale();
  const label = locale === 'ko' ? '질문 도우미' : 'Ask assistant';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={locale === 'ko' ? '질문 도우미 열기' : 'Open assistant'}
      className="fixed bottom-5 right-4 z-40 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[color:var(--sg-color-primary)] px-4 text-white shadow-[var(--sg-shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2 lg:bottom-6 lg:right-6"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden text-sm font-semibold sm:inline">{label}</span>
    </button>
  );
}
