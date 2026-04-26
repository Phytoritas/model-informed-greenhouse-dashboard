import { useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { useLocale } from '../../i18n/LocaleProvider';
import { cn } from '../../utils/cn';
import { Sidebar, SidebarFooter, SidebarHeader } from '../ui/sidebar';

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

interface WorkspaceNavProps {
  items: WorkspaceNavItem[];
  activeWorkspace: string;
  activeActionId?: string;
  statusLabel: string;
  onSelect: (workspace: string) => void;
  onSelectAction?: (workspace: string, actionId: string) => void;
}

function WorkspaceButton({
  item,
  active,
  onSelect,
  compact,
}: {
  item: WorkspaceNavItem;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex w-full items-center gap-3 rounded-[24px] px-4 py-3 text-left transition-all',
        active
          ? 'bg-[color:var(--sg-surface-strong)] text-[color:var(--sg-text-strong)]'
          : 'text-[color:var(--sg-text-muted)] hover:bg-[color:var(--sg-surface-warm)] hover:text-[color:var(--sg-text-strong)]',
        compact ? 'w-[92px] shrink-0 justify-center rounded-[20px] px-3 py-2.5' : '',
      )}
      style={active ? { boxShadow: 'var(--sg-shadow-soft)' } : undefined}
    >
      <span
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px]',
          active ? 'bg-[color:var(--sg-color-primary-soft)] text-[color:var(--sg-color-primary)]' : 'bg-[color:var(--sg-surface-raised)] text-[color:var(--sg-text-muted)]',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      {compact ? null : (
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{item.label}</span>
          <span className="mt-1 block text-xs leading-5 text-[color:var(--sg-text-faint)]">
            {item.description}
          </span>
        </span>
      )}
      {compact ? (
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[11px] font-semibold tracking-[-0.01em]">
            {item.shortLabel}
          </span>
        </span>
      ) : null}
    </button>
  );
}

export default function WorkspaceNav({
  items,
  activeWorkspace,
  activeActionId,
  statusLabel,
  onSelect,
  onSelectAction,
}: WorkspaceNavProps) {
  const { locale } = useLocale();
  const [expandedWorkspace, setExpandedWorkspace] = useState<string | null>(null);
  const activeItem = items.find((item) => item.key === activeWorkspace) ?? items[0];
  const copy = locale === 'ko'
    ? {
        brand: 'PhytoSync',
      }
    : {
        brand: 'PhytoSync',
      };

  const handleWorkspaceClick = (item: WorkspaceNavItem) => {
    onSelect(item.key);

    if (!item.actions?.length) {
      setExpandedWorkspace(null);
      return;
    }

    setExpandedWorkspace((current) => {
      if (item.key === activeWorkspace) {
        return current === item.key ? null : item.key;
      }
      return item.key;
    });
  };

  return (
    <>
      <Sidebar className="hidden min-h-[calc(100vh-8rem)] lg:block">
        <SidebarHeader>
          <div className="sg-eyebrow text-[color:var(--sg-color-primary)]">{copy.brand}</div>
          <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">{activeItem?.label}</div>
        </SidebarHeader>
        <nav className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="space-y-2">
              <WorkspaceButton
                item={item}
                active={item.key === activeWorkspace}
                onSelect={() => handleWorkspaceClick(item)}
              />
              {item.key === activeWorkspace && expandedWorkspace === item.key && item.actions?.length ? (
                <div
                  className="grid w-full gap-2 rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[color:var(--sg-surface-warm)] p-2"
                  style={{ boxShadow: 'var(--sg-shadow-card)' }}
                >
                  {item.actions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      aria-current={activeActionId === action.id ? 'step' : undefined}
                      onClick={() => onSelectAction?.(item.key, action.id)}
                      className={cn(
                        'rounded-full px-3 py-2 text-xs font-semibold transition',
                        activeActionId === action.id
                          ? 'bg-[color:var(--sg-color-primary)] text-white'
                          : 'bg-[color:var(--sg-surface-raised)] text-[color:var(--sg-text-muted)] hover:text-[color:var(--sg-text-strong)]',
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <SidebarFooter>
          <span className="inline-flex items-center rounded-full bg-[color:var(--sg-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sg-text-muted)]">
            {statusLabel}
          </span>
        </SidebarFooter>
      </Sidebar>
      <nav className="fixed inset-x-4 bottom-4 z-40 rounded-[28px] border border-white/70 bg-[color:var(--sg-glass)] p-2 backdrop-blur-xl lg:hidden" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <WorkspaceButton
              key={item.key}
              item={item}
              active={item.key === activeWorkspace}
              onSelect={() => handleWorkspaceClick(item)}
              compact
            />
          ))}
        </div>
        {expandedWorkspace === activeWorkspace && activeItem.actions?.length ? (
          <div className="mt-2 grid gap-2 rounded-[20px] bg-white/75 p-2">
            {activeItem.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                aria-current={activeActionId === action.id ? 'step' : undefined}
                onClick={() => onSelectAction?.(activeItem.key, action.id)}
                className={cn(
                  'rounded-full px-3 py-2 text-xs font-semibold transition',
                  activeActionId === action.id
                    ? 'bg-[color:var(--sg-color-primary)] text-white'
                    : 'bg-[color:var(--sg-surface-raised)] text-[color:var(--sg-text-muted)]',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </nav>
    </>
  );
}
