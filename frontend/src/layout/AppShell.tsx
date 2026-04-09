import type { ReactNode } from 'react';

interface AppShellProps {
    header: ReactNode;
    sidebar?: ReactNode;
    contextRail?: ReactNode;
    commandTray?: ReactNode;
    children: ReactNode;
}

export default function AppShell({
    header,
    sidebar,
    contextRail,
    commandTray,
    children,
}: AppShellProps) {
    return (
        <div className="min-h-screen pb-24 font-sans text-[color:var(--sg-text)]">
            {header}
            <div className="mx-auto grid max-w-[1880px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:px-8">
                {sidebar ? <div className="lg:sticky lg:top-[7.25rem] lg:self-start">{sidebar}</div> : null}
                <div className="min-w-0 space-y-6">
                    {commandTray}
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
                        <div className="min-w-0">{children}</div>
                        {contextRail ? <aside className="space-y-4 xl:sticky xl:top-[7.5rem] xl:self-start">{contextRail}</aside> : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
