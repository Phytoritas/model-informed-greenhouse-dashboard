import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Input, type InputProps } from './input';

const SearchInput = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--sg-text-faint)]" aria-hidden="true" />
    <Input ref={ref} className={cn('pl-9', className)} {...props} />
  </div>
));

SearchInput.displayName = 'SearchInput';

export { SearchInput };
