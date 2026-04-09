import type { ReactNode } from 'react';

interface AdvisorActionCardProps {
    eyebrow?: string | null;
    title: string;
    subtitle?: string | null;
    badges?: string[];
    tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'violet';
    children?: ReactNode;
}

const AdvisorActionCard = ({
    eyebrow = null,
    title,
    subtitle = null,
    badges = [],
    tone = 'neutral',
    children = null,
}: AdvisorActionCardProps) => (
    <article
        className={`rounded-[30px] p-5 ${
            ({
                neutral: 'sg-tint-neutral',
                green: 'sg-tint-green',
                blue: 'sg-tint-blue',
                amber: 'sg-tint-amber',
                violet: 'sg-tint-violet',
            })[tone]
        }`}
        style={{ boxShadow: 'var(--sg-shadow-card)' }}
    >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
                {eyebrow ? (
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sg-text-faint)]">
                        {eyebrow}
                    </div>
                ) : null}
                <h4 className="mt-2 text-base font-semibold text-[color:var(--sg-text-strong)]">{title}</h4>
                {subtitle ? (
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-[color:var(--sg-text-muted)]">{subtitle}</p>
                ) : null}
            </div>
            {badges.length > 0 ? (
                <div className="flex flex-wrap gap-2 lg:max-w-[18rem] lg:justify-end">
                    {badges.map((badge) => (
                        <span
                            key={badge}
                            className="rounded-full bg-white/82 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--sg-text-muted)]"
                            style={{ boxShadow: 'var(--sg-shadow-card)' }}
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
