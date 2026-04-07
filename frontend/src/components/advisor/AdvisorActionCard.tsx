import type { ReactNode } from 'react';

interface AdvisorActionCardProps {
    title: string;
    subtitle?: string | null;
    badges?: string[];
    children?: ReactNode;
}

const AdvisorActionCard = ({
    title,
    subtitle = null,
    badges = [],
    children = null,
}: AdvisorActionCardProps) => (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
                <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
                {subtitle ? (
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{subtitle}</p>
                ) : null}
            </div>
            {badges.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {badges.map((badge) => (
                        <span
                            key={badge}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600"
                        >
                            {badge}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
        {children ? <div className="mt-4">{children}</div> : null}
    </article>
);

export default AdvisorActionCard;
