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
        <main className="w-full py-6">
            {overview}

            <div className="mb-10 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,0.86fr)] 2xl:grid-cols-[minmax(0,1.95fr)_minmax(340px,0.82fr)]">
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
