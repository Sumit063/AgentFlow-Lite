import { cva } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[4px] border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-slate-700 text-slate-200',
        high: 'border-red-700 text-red-300',
        medium: 'border-amber-600 text-amber-300',
        low: 'border-emerald-700 text-emerald-300',
        success: 'border-emerald-700 text-emerald-300',
        warning: 'border-amber-600 text-amber-300',
        danger: 'border-red-700 text-red-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Badge = ({ className, variant, ...props }) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { Badge };
