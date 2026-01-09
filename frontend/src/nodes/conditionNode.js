import { useState } from 'react';
import { useStore } from '../store';
import { BaseNode } from './BaseNode';

export const ConditionNode = ({ id, data }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const removeNode = useStore((state) => state.removeNode);
  const [operator, setOperator] = useState(data?.operator || 'equals');

  const handleChange = (event) => {
    const value = event.target.value;
    setOperator(value);
    updateNodeField(id, 'operator', value);
  };

  return (
    <BaseNode
      title="Condition"
      subtitle="Branch by rule"
      variant="condition"
      inputs={[{ id: `${id}-value` }]}
      outputs={[
        { id: `${id}-true`, label: 'true' },
        { id: `${id}-false`, label: 'false' },
      ]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-field">
        <label htmlFor={`${id}-condition-op`}>Operator</label>
        <select id={`${id}-condition-op`} value={operator} onChange={handleChange}>
          <option value="equals">Equals</option>
          <option value="contains">Contains</option>
          <option value="greaterThan">Greater than</option>
          <option value="lessThan">Less than</option>
        </select>
      </div>
      <div className="node-helper">Outputs route to true/false handles.</div>
    </BaseNode>
  );
};
