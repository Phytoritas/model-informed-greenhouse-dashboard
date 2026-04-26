import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function Sidebar({
  className,
  ...props
}: ComponentPropsWithoutRef<'aside'>) {
  return (
    <aside
      className={cn(
        'rounded-[var(--sg-radius-xl)] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(180deg,rgba(255,253,249,0.9),rgba(255,241,233,0.78))] p-3 backdrop-blur-xl',
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
        'mb-4 rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(180deg,rgba(255,253,249,0.98),rgba(232,241,227,0.78))] px-4 py-4',
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
        'mt-4 rounded-[var(--sg-radius-lg)] border border-[color:var(--sg-outline-soft)] bg-[linear-gradient(180deg,rgba(255,241,233,0.88),rgba(255,253,249,0.96))] px-4 py-4 text-sm leading-6 text-[color:var(--sg-text-muted)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
