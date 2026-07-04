import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../../i18n/LocaleProvider';
import type { GlobalNavigationItem, GlobalNavigationKey } from '../../routes/globalNavigation';
import { cn } from '../../utils/cn';

export type DashboardWorkspaceKey =
  | 'command'
  | 'advisor'
  | 'rtr'
  | 'trend'
  | 'crop'
  | 'resources'
  | 'alerts'
  | 'knowledge'
  | 'settings';

export interface WorkspaceNavAction {
  id: string;
  label: string;
}

export interface WorkspaceNavItem {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  icon: LucideIcon;
  actions?: WorkspaceNavAction[];
}

interface WorkspaceTopNavProps {
  globalItems: readonly GlobalNavigationItem[];
  items: WorkspaceNavItem[];
  activeGlobalKey?: GlobalNavigationKey | null;
  activeWorkspace: string;
  activeActionId?: string;
  onSelectGlobal?: (key: GlobalNavigationKey) => void;
  onSelectContact?: () => void;
  onSelect: (workspace: string) => void;
  onSelectAction?: (workspace: string, actionId: string) => void;
}

/**
 * Horizontal workspace navigation rendered above route content. The first row
 * is the global navigation shared with the landing page; the second row only
 * shows subtabs that belong to the active global category. Route-local panel
 * actions stay below the subtab row.
 */
export default function WorkspaceTopNav({
  globalItems,
  items,
  activeGlobalKey,
  activeWorkspace,
  activeActionId,
  onSelectGlobal,
  onSelectContact,
  onSelect,
  onSelectAction,
}: WorkspaceTopNavProps) {
  const { locale } = useLocale();
  const activeItem = items.find((item) => item.key === activeWorkspace);
  const actions = activeItem?.actions ?? [];

  return (
    <div className="mb-5 grid gap-2">
      <nav
        aria-label={locale === 'ko' ? '전역 내비게이션' : 'Global navigation'}
        data-testid="workspace-global-nav"
        className="overview-nav-links justify-start"
      >
        {globalItems.map((item) => {
          const active = item.key === activeGlobalKey;
          const className = cn(
            'overview-nav-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sg-color-primary)]',
            active && 'overview-nav-link-active',
          );

          return item.path ? (
            <Link
              key={item.key}
              to={item.path}
              onClick={() => onSelectGlobal?.(item.key)}
              aria-current={active ? 'page' : undefined}
              className={className}
            >
              {item.label}
            </Link>
          ) : (
            <button
              key={item.key}
              type="button"
              onClick={onSelectContact}
              aria-current={active ? 'page' : undefined}
              className={className}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
      {items.length > 0 ? (
        <nav
          aria-label={locale === 'ko' ? '카테고리 서브탭 내비게이션' : 'Category subtab navigation'}
          data-testid="workspace-top-nav"
          className="overview-tab-strip"
        >
          {items.map((item) => {
            const active = item.key === activeWorkspace;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                aria-current={active ? 'step' : undefined}
                title={item.description}
                className={cn('overview-tab-link', active && 'overview-tab-link-active')}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
      {actions.length > 0 && onSelectAction ? (
        <nav
          aria-label={locale === 'ko' ? '패널 액션 내비게이션' : 'Panel action navigation'}
          data-testid="workspace-top-nav-actions"
          className="flex flex-wrap items-center gap-1.5"
        >
          {actions.map((action) => {
            const active = activeActionId === action.id;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => onSelectAction(activeWorkspace, action.id)}
                aria-pressed={active}
                data-active={active}
                className={cn(
                  'rounded-full border px-3 py-1 text-[0.68rem] font-bold transition',
                  active
                    ? 'border-[color:var(--sg-color-primary)] bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]'
                    : 'border-[color:var(--sg-outline-soft)] bg-white text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]',
                )}
              >
                {action.label}
              </button>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
