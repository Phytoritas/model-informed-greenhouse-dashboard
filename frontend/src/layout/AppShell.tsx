import type { ReactNode } from 'react';

interface AppShellProps {
    header: ReactNode;
    children: ReactNode;
}

/**
 * Routed workspace shell sharing the exact landing-page canvas: the same
 * outer gutters and the same compact overview-browser frame, so every tab
 * renders at the same width as HOME.
 */
export default function AppShell({
    header,
    children,
}: AppShellProps) {
    return (
        <div className="min-h-screen bg-[color:var(--sg-bg)] px-4 py-4 font-sans text-[color:var(--sg-text)] sm:px-6 lg:px-8">
            <main className="overview-browser-shell">
                <div className="overview-browser-frame">
                    <div className="overview-frame-body">
                        {header}
                        <div className="min-w-0">{children}</div>
                    </div>
                </div>
            </main>
        </div>
    );
}
