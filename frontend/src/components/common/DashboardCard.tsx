import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

type DashboardCardVariant = 'hero' | 'metric' | 'narrative' | 'table' | 'scenario' | 'alert' | 'empty' | 'loading';

interface DashboardCardProps {
    eyebrow?: string;
    title?: string;
    description?: string;
    actions?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    variant?: DashboardCardVariant;
    className?: string;
    contentClassName?: string;
}

const VARIANT_CLASSNAME: Record<DashboardCardVariant, string> = {
    hero: 'sg-card sg-card-hero',
    metric: 'sg-card sg-card-metric',
    narrative: 'sg-card',
    table: 'sg-card',
    scenario: 'sg-card sg-card-muted',
    alert: 'sg-card sg-card-alert',
    empty: 'sg-card sg-card-empty',
    loading: 'sg-card sg-card-muted',
};

export default function DashboardCard({
    eyebrow,
    title,
    description,
    actions,
    footer,
    children,
    variant = 'narrative',
    className,
    contentClassName,
}: DashboardCardProps) {
    return (
        <section className={cn(VARIANT_CLASSNAME[variant], className)}>
            {(eyebrow || title || description || actions) ? (
                <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                        {eyebrow ? <p className="sg-eyebrow">{eyebrow}</p> : null}
                        {title ? <h3 className="sg-card-title mt-2">{title}</h3> : null}
                        {description ? <p className="sg-card-description mt-2">{description}</p> : null}
                    </div>
                    {actions ? <div className="shrink-0">{actions}</div> : null}
                </header>
            ) : null}
            <div className={contentClassName}>{children}</div>
            {footer ? <footer className="mt-5 border-t border-[color:var(--sg-outline-soft)] pt-4">{footer}</footer> : null}
        </section>
    );
}
