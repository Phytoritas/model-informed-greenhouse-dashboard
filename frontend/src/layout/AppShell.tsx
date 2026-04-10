import type { ReactNode } from 'react';

interface AppShellProps {
    header: ReactNode;
    sidebar?: ReactNode;
    commandTray?: ReactNode;
    children: ReactNode;
}

export default function AppShell({
    header,
    sidebar,
    children,
}: AppShellProps) {
    return (
        <div className="min-h-screen pb-24 font-sans text-[color:var(--sg-text)]">
            {header}
            <div className="mx-auto w-full max-w-[1640px] px-4 py-6 sm:px-6 xl:px-8">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                    {sidebar ? (
                        <div
                            data-testid="app-shell-sidebar-slot"
                            className="w-full lg:w-[248px] lg:shrink-0 lg:self-start"
                        >
                            {sidebar}
                        </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <div className="min-w-0">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
