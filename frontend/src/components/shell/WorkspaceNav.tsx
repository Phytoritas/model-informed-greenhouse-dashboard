import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils/cn';
import { useLocale } from '../../i18n/LocaleProvider';

export type DashboardWorkspaceKey =
    | 'command'
    | 'advisor'
    | 'rtr'
    | 'crop'
    | 'resources'
    | 'alerts'
    | 'knowledge';

export interface WorkspaceNavItem {
    key: DashboardWorkspaceKey;
    label: string;
    shortLabel: string;
    description: string;
    icon: LucideIcon;
}

interface WorkspaceNavProps {
    items: WorkspaceNavItem[];
    activeWorkspace: DashboardWorkspaceKey;
    onSelect: (workspace: DashboardWorkspaceKey) => void;
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
            className={cn(
                'group flex w-full items-center gap-3 rounded-[24px] px-4 py-3 text-left transition-all',
                active
                    ? 'bg-[color:var(--sg-surface-strong)] text-[color:var(--sg-text-strong)]'
                    : 'text-[color:var(--sg-text-muted)] hover:bg-white/60 hover:text-[color:var(--sg-text-strong)]',
                compact ? 'w-[92px] shrink-0 justify-center rounded-[20px] px-3 py-2.5' : '',
            )}
            style={active ? { boxShadow: 'var(--sg-shadow-soft)' } : undefined}
        >
            <span
                className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px]',
                    active ? 'bg-[color:var(--sg-accent-violet-soft)] text-[color:var(--sg-accent-violet)]' : 'bg-white/75 text-[color:var(--sg-text-muted)]',
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
    onSelect,
}: WorkspaceNavProps) {
    const { locale } = useLocale();
    const activeItem = items.find((item) => item.key === activeWorkspace) ?? items[0];
    const copy = locale === 'ko'
        ? {
            workspaces: '워크스페이스',
            commandNote: '운영 메모',
        }
        : {
            workspaces: 'Workspaces',
            commandNote: 'Command note',
        };

    return (
        <>
            <aside className="hidden min-h-[calc(100vh-8rem)] rounded-[36px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(239,244,255,0.85))] p-3 backdrop-blur-xl lg:block" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                <div className="mb-4 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(223,242,231,0.74))] px-4 py-4" style={{ boxShadow: 'var(--sg-shadow-card)' }}>
                    <div className="sg-eyebrow text-[color:var(--sg-accent-forest)]">{copy.workspaces}</div>
                    <div className="mt-2 text-lg font-semibold tracking-[-0.04em] text-[color:var(--sg-text-strong)]">{activeItem?.label}</div>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--sg-text-muted)]">{activeItem?.description}</p>
                </div>
                <nav className="space-y-2">
                    {items.map((item) => (
                        <WorkspaceButton
                            key={item.key}
                            item={item}
                            active={item.key === activeWorkspace}
                            onSelect={() => onSelect(item.key)}
                        />
                    ))}
                </nav>
                <div className="mt-4 rounded-[28px] bg-[linear-gradient(180deg,rgba(232,232,251,0.92),rgba(255,255,255,0.96))] px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-muted)]">
                    <div className="sg-eyebrow text-[color:var(--sg-accent-violet)]">{copy.commandNote}</div>
                    <p className="mt-2">
                        {activeItem?.shortLabel} · {activeItem?.description}
                    </p>
                </div>
            </aside>
            <nav className="fixed inset-x-4 bottom-4 z-40 rounded-[28px] border border-white/70 bg-[color:var(--sg-glass)] p-2 backdrop-blur-xl lg:hidden" style={{ boxShadow: 'var(--sg-shadow-soft)' }}>
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {items.map((item) => (
                        <WorkspaceButton
                            key={item.key}
                            item={item}
                            active={item.key === activeWorkspace}
                            onSelect={() => onSelect(item.key)}
                            compact
                        />
                    ))}
                </div>
            </nav>
        </>
    );
}
