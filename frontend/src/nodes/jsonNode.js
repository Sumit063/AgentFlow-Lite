import { useState } from 'react';
import { useStore } from '../store';
import { BaseNode } from './BaseNode';

const DEFAULT_JSON = '{\n  "key": "value"\n}';

export const JSONNode = ({ id, data }) => {
  const updateNodeField = useStore((state) => state.updateNodeField);
  const removeNode = useStore((state) => state.removeNode);
  const [jsonValue, setJsonValue] = useState(data?.json || DEFAULT_JSON);

  const handleChange = (event) => {
    const value = event.target.value;
    setJsonValue(value);
    updateNodeField(id, 'json', value);
  };

  return (
    <BaseNode
      title="JSON"
      subtitle="Structured payload"
      variant="json"
      outputs={[{ id: `${id}-payload` }]}
      onDelete={() => removeNode(id)}
    >
      <div className="node-field">
        <label htmlFor={`${id}-json-value`}>Payload</label>
        <textarea
          id={`${id}-json-value`}
          value={jsonValue}
          onChange={handleChange}
          className="node-textarea"
          spellCheck={false}
          wrap="off"
        />
      </div>
    </BaseNode>
  );
};
