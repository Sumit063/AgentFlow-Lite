// inputNode.js

import { useState } from 'react';
import { useStore } from '../store';
import { BaseNode } from './BaseNode';

export const InputNode = ({ id, data }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const removeNode = useStore((state) => state.removeNode);
  const [currName, setCurrName] = useState(
    data?.inputName || id.replace('customInput-', 'input_')
  );
  const [inputType, setInputType] = useState(data?.inputType || 'Text');

  const handleNameChange = (e) => {
    const value = e.target.value;
    setCurrName(value);
    updateNodeField(id, 'inputName', value);
  };

  const handleTypeChange = (e) => {
    const value = e.target.value;
    setInputType(value);
    updateNodeField(id, 'inputType', value);
  };

  return (
    <BaseNode
      title="Input"
      subtitle="Bring data into the graph"
      variant="input"
      outputs={[{ id: `${id}-value` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-field">
        <label htmlFor={`${id}-input-name`}>Label</label>
        <input
          id={`${id}-input-name`}
          type="text"
          value={currName}
          onChange={handleNameChange}
          placeholder="input_name"
        />
      </div>
      <div className="node-field">
        <label htmlFor={`${id}-input-type`}>Type</label>
        <select id={`${id}-input-type`} value={inputType} onChange={handleTypeChange}>
          <option value="Text">Text</option>
          <option value="File">File</option>
        </select>
      </div>
    </BaseNode>
  );
};
