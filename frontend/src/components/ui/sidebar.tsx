import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function Sidebar({
  className,
  ...props
}: ComponentPropsWithoutRef<'aside'>) {
  return (
    <aside
      className={cn(
        'rounded-[36px] bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(239,244,255,0.85))] p-3 backdrop-blur-xl',
        className,
      )}
      style={{ boxShadow: 'var(--sg-shadow-card)' }}
      {...props}
    />
  );
}

export function SidebarHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mb-4 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(223,242,231,0.74))] px-4 py-4',
        className,
      )}
      style={{ boxShadow: 'var(--sg-shadow-card)' }}
    >
      {children}
    </div>
  );
}

export function SidebarFooter({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'mt-4 rounded-[28px] bg-[linear-gradient(180deg,rgba(232,232,251,0.92),rgba(255,255,255,0.96))] px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-muted)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
