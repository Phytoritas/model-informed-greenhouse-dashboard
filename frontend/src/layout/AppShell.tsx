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
    commandTray,
    children,
}: AppShellProps) {
    return (
        <div className="min-h-screen bg-[color:var(--sg-bg)] px-3 py-4 pb-24 font-sans text-[color:var(--sg-text)] sm:px-5 lg:px-6">
            <div className="mx-auto w-full max-w-[1580px] overflow-hidden rounded-[30px] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(180deg,rgba(255,253,249,0.96),rgba(255,241,233,0.54)_42%,rgba(250,247,242,0.98))] p-3 shadow-[var(--sg-shadow-frame)] sm:rounded-[34px] sm:p-4">
                {header}
                {commandTray ? <div className="mt-3">{commandTray}</div> : null}
                <div className="mt-4">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                        {sidebar ? (
                            <div
                                data-testid="app-shell-sidebar-slot"
                                className="w-full lg:w-[248px] lg:shrink-0 lg:self-start"
                            >
                                {sidebar}
                            </div>
                        ) : null}
                        <main className="min-w-0 flex-1" aria-label="PhytoSync workspace">
                            <div className="min-w-0">{children}</div>
                        </main>
                    </div>
                </div>
            </div>
        </div>
    );
}
