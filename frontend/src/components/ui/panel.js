import { cn } from '../../lib/utils';

const Panel = ({ className, ...props }) => (
  <div
    className={cn('panel-surface rounded-[6px] p-4 md:p-5', className)}
    {...props}
  />
);

export { Panel };
