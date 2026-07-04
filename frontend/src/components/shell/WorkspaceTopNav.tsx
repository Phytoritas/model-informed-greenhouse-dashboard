import type { LucideIcon } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
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
  items: WorkspaceNavItem[];
  activeWorkspace: string;
  activeActionId?: string;
  onSelect: (workspace: string) => void;
  onSelectAction?: (workspace: string, actionId: string) => void;
}

/**
 * Horizontal workspace navigation strip rendered above route content, replacing
 * the former left WorkspaceNav sidebar. Reuses the Command landing tab-strip
 * classes so workspace routes share the landing's navigation look. The active
 * workspace's sub-actions render as a second chip row (aria-current="step").
 */
export default function WorkspaceTopNav({
  items,
  activeWorkspace,
  activeActionId,
  onSelect,
  onSelectAction,
}: WorkspaceTopNavProps) {
  const { locale } = useLocale();
  const activeItem = items.find((item) => item.key === activeWorkspace);
  const actions = activeItem?.actions ?? [];

  return (
    <div className="mb-5 grid gap-2">
      <nav
        aria-label={locale === 'ko' ? '워크스페이스 내비게이션' : 'Workspace navigation'}
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
              aria-current={active ? 'page' : undefined}
              title={item.description}
              className={cn('overview-tab-link', active && 'overview-tab-link-active')}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      {actions.length > 0 && onSelectAction ? (
        <nav
          aria-label={locale === 'ko' ? '섹션 내비게이션' : 'Section navigation'}
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
                aria-current={active ? 'step' : undefined}
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
