import { useStore } from '../store';
import { BaseNode } from './BaseNode';

export const MergeNode = ({ id }) => {
  const removeNode = useStore((state) => state.removeNode);

  return (
    <BaseNode
      title="Merge"
      subtitle="Combine multiple inputs"
      variant="merge"
      inputs={[{ id: `${id}-a` }, { id: `${id}-b` }, { id: `${id}-c` }]}
      outputs={[{ id: `${id}-out` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-body-copy">
        Funnel multiple sources into a single output stream.
      </div>
    </BaseNode>
  );
};
