import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';

import { cn } from '../../lib/utils';

const ToastProvider = ToastPrimitive.Provider;

const ToastViewport = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      'fixed right-4 top-4 z-50 flex max-h-screen w-[320px] flex-col gap-2 outline-none',
      className
    )}
    {...props}
  />
));

ToastViewport.displayName = 'ToastViewport';

const Toast = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    className={cn(
      'group pointer-events-auto flex w-full items-start justify-between gap-3 rounded-[4px] border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100 shadow-2xl',
      className
    )}
    {...props}
  />
));

Toast.displayName = 'Toast';

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
));

ToastTitle.displayName = 'ToastTitle';

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn('text-xs text-slate-400', className)}
    {...props}
  />
));

ToastDescription.displayName = 'ToastDescription';

const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn('text-slate-500 hover:text-slate-200', className)}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
));

ToastClose.displayName = 'ToastClose';

export { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription, ToastClose };
