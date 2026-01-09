// outputNode.js

import { useState } from 'react';
import { useStore } from '../store';
import { BaseNode } from './BaseNode';

export const OutputNode = ({ id, data }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const removeNode = useStore((state) => state.removeNode);
  const [currName, setCurrName] = useState(
    data?.outputName || id.replace('customOutput-', 'output_')
  );
  const [outputType, setOutputType] = useState(data?.outputType || 'Text');

  const handleNameChange = (e) => {
    const value = e.target.value;
    setCurrName(value);
    updateNodeField(id, 'outputName', value);
  };

  const handleTypeChange = (e) => {
    const value = e.target.value;
    setOutputType(value);
    updateNodeField(id, 'outputType', value);
  };

  return (
    <BaseNode
      title="Output"
      subtitle="Capture results"
      variant="output"
      inputs={[{ id: `${id}-value` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-field">
        <label htmlFor={`${id}-output-name`}>Label</label>
        <input
          id={`${id}-output-name`}
          type="text"
          value={currName}
          onChange={handleNameChange}
          placeholder="output_name"
        />
      </div>
      <div className="node-field">
        <label htmlFor={`${id}-output-type`}>Type</label>
        <select id={`${id}-output-type`} value={outputType} onChange={handleTypeChange}>
          <option value="Text">Text</option>
          <option value="Image">Image</option>
        </select>
      </div>
    </BaseNode>
  );
};
