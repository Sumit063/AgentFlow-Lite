import * as React from 'react';
import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 border text-xs font-semibold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-slate-100 text-slate-900 hover:bg-white',
        secondary: 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800',
        outline: 'border-slate-700 bg-transparent text-slate-100 hover:bg-slate-900/40',
        ghost: 'border-transparent bg-transparent text-slate-300 hover:text-white hover:bg-slate-900/40',
        destructive: 'border-red-900/60 bg-red-950 text-red-200 hover:bg-red-900/40',
      },
      size: {
        sm: 'h-8 px-3 rounded-[4px]',
        md: 'h-9 px-4 rounded-[4px]',
        lg: 'h-10 px-5 rounded-[4px]',
        icon: 'h-8 w-8 rounded-[4px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(buttonVariants({ variant, size }), className)}
    {...props}
  />
));

Button.displayName = 'Button';

export { Button, buttonVariants };
