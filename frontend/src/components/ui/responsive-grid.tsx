import type { HTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface ResponsiveGridProps extends HTMLAttributes<HTMLDivElement> {
  dense?: boolean;
}

export function ResponsiveGrid({ className, dense = false, ...props }: ResponsiveGridProps) {
  return (
    <div
      className={cn(
        dense
          ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12'
          : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12',
        className,
      )}
      {...props}
    />
  );
}
