import { MessageCircle } from 'lucide-react';

interface AssistantFabProps {
  onClick: () => void;
}

export default function AssistantFab({ onClick }: AssistantFabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="질문 도우미 열기"
      className="fixed bottom-20 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--sg-color-primary)] text-white shadow-[var(--sg-shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2 lg:bottom-6 lg:right-6"
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="sr-only">질문 도우미</span>
    </button>
  );
}
