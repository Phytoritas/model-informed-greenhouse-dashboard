import { useState } from 'react';
import { Leaf, Menu, MessageCircle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../i18n/LocaleProvider';
import {
  VISIBLE_GLOBAL_NAVIGATION_ITEMS,
  type GlobalNavigationKey,
} from '../../routes/globalNavigation';
import { cn } from '../../utils/cn';
import ThemeToggle from './ThemeToggle';

interface GlobalTopNavProps {
  onOpenAssistant: () => void;
  activeKey?: GlobalNavigationKey | null;
  onNavigate?: (key: GlobalNavigationKey) => void;
}

/**
 * The single global navigation header shared by the landing page and every
 * routed workspace screen: brand, task destinations and contextual assistant.
 */
export default function GlobalTopNav({
  onOpenAssistant,
  activeKey = 'home',
  onNavigate,
}: GlobalTopNavProps) {
  const { locale } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const assistantLabel = locale === 'ko' ? '질문하기' : 'Ask Assistant';

  return (
    <header>
      <nav aria-label={locale === 'ko' ? 'PhytoSync 전역 내비게이션' : 'PhytoSync global navigation'} className="workspace-nav">
        <Link to="/overview" onClick={() => setMenuOpen(false)} className="workspace-brand">
          <span className="workspace-brand-icon"><Leaf className="h-5 w-5" aria-hidden="true" /></span>
          <span>PhytoSync<small>{locale === 'ko' ? '온실 의사결정' : 'Growing decisions'}</small></span>
        </Link>
        <div id="workspace-main-menu" className={cn('workspace-nav-links', menuOpen && 'workspace-nav-links-open')}>
          {VISIBLE_GLOBAL_NAVIGATION_ITEMS.map((item) => {
            const active = item.key === activeKey;
            const label = locale === 'ko' ? item.labelKo : item.label;
            return (
              <Link
                key={item.key}
                to={item.path}
                onClick={() => { onNavigate?.(item.key); setMenuOpen(false); }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'workspace-nav-link',
                  active && 'workspace-nav-link-active',
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <div className="workspace-nav-tools">
          <ThemeToggle />
          <button
            type="button"
            onClick={onOpenAssistant}
            aria-label={assistantLabel}
            className="workspace-nav-assistant"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            <span>{assistantLabel}</span>
          </button>
          <button type="button" className="workspace-menu-button" aria-expanded={menuOpen} aria-controls="workspace-main-menu" aria-label={locale === 'ko' ? (menuOpen ? '메뉴 닫기' : '메뉴 열기') : (menuOpen ? 'Close menu' : 'Open menu')} onClick={() => setMenuOpen(value => !value)}>
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
    </header>
  );
}
