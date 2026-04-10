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
      className="fixed bottom-24 right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full bg-[color:var(--sg-accent-violet)] px-5 text-sm font-semibold text-white shadow-[var(--sg-shadow-soft)] transition hover:-translate-y-0.5 hover:bg-[#e04e52] lg:bottom-8 lg:right-8"
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">질문 도우미</span>
    </button>
  );
}
