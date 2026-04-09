import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
    return <table className={cn('w-full caption-bottom border-separate border-spacing-y-2 text-sm', className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <thead className={cn('text-[11px] uppercase tracking-[0.14em] text-[color:var(--sg-text-faint)]', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
    return <tbody className={cn(className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
    return <tr className={cn('rounded-[18px] bg-white/84 shadow-[var(--sg-shadow-card)]', className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
    return <th className={cn('px-4 py-3 text-left font-semibold', className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
    return <td className={cn('px-4 py-3 align-middle text-[color:var(--sg-text-strong)]', className)} {...props} />;
}
