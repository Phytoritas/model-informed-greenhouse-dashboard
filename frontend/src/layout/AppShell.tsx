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
        <div className="min-h-screen pb-24 font-sans text-[color:var(--sg-text)]">
            {header}
            <div className="mx-auto w-full max-w-[1536px] px-4 py-8 sm:px-6 xl:px-0">
                {commandTray ? <div className="mb-8 min-w-0">{commandTray}</div> : null}
                <div className="flex gap-6">
                    {sidebar ? <div className="hidden w-[240px] shrink-0 lg:block lg:self-start">{sidebar}</div> : null}
                    <div className="min-w-0 flex-1 space-y-8">
                        <div className="min-w-0">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
