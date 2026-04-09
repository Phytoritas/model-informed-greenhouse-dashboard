import type { ReactNode } from 'react';

interface MainDashboardProps {
    overview: ReactNode;
    leftColumn: ReactNode;
    rightSidebar: ReactNode;
    lowerFold: ReactNode;
    bottomRow: ReactNode;
}

export default function MainDashboard({
    overview,
    leftColumn,
    rightSidebar,
    lowerFold,
    bottomRow,
}: MainDashboardProps) {
    return (
        <main className="mx-auto max-w-[1740px] px-4 py-8 sm:px-6 lg:px-8">
            {overview}

            <div className="mb-10 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.95fr)]">
                <div className="space-y-8">{leftColumn}</div>
                <div className="space-y-4 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:self-start xl:overflow-y-auto">
                    {rightSidebar}
                </div>
            </div>

            {lowerFold}
            {bottomRow}
        </main>
    );
}
