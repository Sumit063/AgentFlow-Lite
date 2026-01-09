import { useState } from 'react';
import { useStore } from '../store';
import { BaseNode } from './BaseNode';

export const NumberNode = ({ id, data }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const removeNode = useStore((state) => state.removeNode);
  const [value, setValue] = useState(data?.value ?? 0);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setValue(nextValue);
    updateNodeField(id, 'value', Number(nextValue));
  };

  return (
    <BaseNode
      title="Number"
      subtitle="Constant value"
      variant="number"
      outputs={[{ id: `${id}-value` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-field">
        <label htmlFor={`${id}-number-value`}>Value</label>
        <input
          id={`${id}-number-value`}
          type="number"
          value={value}
          onChange={handleChange}
        />
      </div>
    </BaseNode>
  );
};
