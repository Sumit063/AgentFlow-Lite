import { useState } from 'react';
import { useStore } from '../store';
import { BaseNode } from './BaseNode';

export const DelayNode = ({ id, data }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const removeNode = useStore((state) => state.removeNode);
  const [delayMs, setDelayMs] = useState(data?.delayMs ?? 300);

  const handleChange = (event) => {
    const value = Number(event.target.value);
    setDelayMs(value);
    updateNodeField(id, 'delayMs', value);
  };

  return (
    <BaseNode
      title="Delay"
      subtitle="Pause processing"
      variant="delay"
      inputs={[{ id: `${id}-in` }]}
      outputs={[{ id: `${id}-out` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-field">
        <label htmlFor={`${id}-delay-ms`}>Milliseconds</label>
        <input
          id={`${id}-delay-ms`}
          type="number"
          min="0"
          value={delayMs}
          onChange={handleChange}
        />
      </div>
    </BaseNode>
  );
};
