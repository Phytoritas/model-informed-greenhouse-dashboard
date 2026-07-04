import { ArrowRight, Leaf, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../i18n/LocaleProvider';
import {
  GLOBAL_NAVIGATION_ITEMS,
  type GlobalNavigationKey,
} from '../../routes/globalNavigation';
import { cn } from '../../utils/cn';

interface GlobalTopNavProps {
  onOpenAssistant: () => void;
  activeKey?: GlobalNavigationKey | null;
  onNavigate?: (key: GlobalNavigationKey) => void;
}

/**
 * The single global navigation header shared by the landing page and every
 * routed workspace screen: PhytoSync brand, the HOME…CONTACT tab row, the
 * assistant launcher, and the dashboard CTA. Keeping one component here is
 * what guarantees the top of every page looks identical to HOME.
 */
export default function GlobalTopNav({
  onOpenAssistant,
  activeKey = 'home',
  onNavigate,
}: GlobalTopNavProps) {
  const { locale } = useLocale();
  const assistantLabel = locale === 'ko' ? '질문하기' : 'Ask Assistant';
  const dashboardLabel = locale === 'ko' ? '대시보드 열기' : 'Open Dashboard';

  return (
    <header>
      <nav aria-label={locale === 'ko' ? 'PhytoSync 전역 내비게이션' : 'PhytoSync global navigation'} className="overview-nav">
        <Link to="/overview" className="inline-flex items-center gap-2 text-base font-bold text-[color:var(--sg-text-strong)]">
          <Leaf className="h-5 w-5 text-[color:var(--sg-color-olive)]" aria-hidden="true" />
          PhytoSync
        </Link>
        <div className="overview-nav-links">
          {GLOBAL_NAVIGATION_ITEMS.map((item) => {
            const active = item.key === activeKey;
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={() => onNavigate?.(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'overview-nav-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]',
                  active && 'overview-nav-link-active',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label={assistantLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-color-primary)] shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
          </button>
          <Link
            to="/control"
            onClick={() => onNavigate?.('dashboard')}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[var(--sg-radius-sm)] bg-[color:var(--sg-color-primary)] px-3.5 text-xs font-bold text-white shadow-[var(--sg-shadow-card)] transition hover:bg-[color:var(--sg-color-primary-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)] focus-visible:ring-offset-2"
          >
            {dashboardLabel} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
