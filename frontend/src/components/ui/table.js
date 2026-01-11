import { cn } from '../../lib/utils';

const Table = ({ className, ...props }) => (
  <div className="w-full overflow-auto">
    <table className={cn('data-table', className)} {...props} />
  </div>
);

export { Table };
