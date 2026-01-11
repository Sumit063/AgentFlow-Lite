import { useEffect } from 'react';
import { useUpdateNodeInternals } from 'reactflow';

import { Button } from '../components/ui/button';
import { BaseNode } from './BaseNode';

const parseIdList = (value) => {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.match(/^\d+$/) ? Number(item) : item));
};

const formatIdList = (value) => {
  if (!Array.isArray(value)) {
    return '';
  }
  return value.join(', ');
};

const operatorLabelMap = {
  equals: '==',
  not_equals: '!=',
  contains: 'contains',
  greater_than: '>',
  less_than: '<',
};

const operatorParseMap = {
  '==': 'equals',
  '!=': 'not_equals',
  '>': 'greater_than',
  '<': 'less_than',
};

const buildConditionExpression = (config) => {
  if (config.expression) {
    return config.expression;
  }
  const left = config.left || '';
  const right = config.right || '';
  const operator = operatorLabelMap[config.operator] || config.operator || '';
  return `${left} ${operator} ${right}`.trim();
};

const parseConditionExpression = (expression) => {
  const trimmed = expression.trim();
  if (!trimmed) {
    return null;
  }
  const containsMatch = trimmed.match(/^(.+?)\s+contains\s+(.+)$/i);
  if (containsMatch) {
    return {
      left: containsMatch[1].trim(),
      operator: 'contains',
      right: containsMatch[2].trim(),
    };
  }
  const operators = Object.keys(operatorParseMap);
  for (const symbol of operators) {
    const regex = new RegExp(`^(.+?)\\s*\\${symbol}\\s*(.+)$`);
    const match = trimmed.match(regex);
    if (match) {
      return {
        left: match[1].trim(),
        operator: operatorParseMap[symbol],
        right: match[2].trim(),
      };
    }
  }
  return null;
};

const getPorts = (nodeType) => {
  if (nodeType === 'INPUT') {
    return { inputs: [], outputs: [{ id: 'out', label: 'out' }] };
  }
  if (nodeType === 'OUTPUT') {
    return { inputs: [{ id: 'in', label: 'in' }], outputs: [] };
  }
  if (nodeType === 'CONDITION') {
    return {
      inputs: [{ id: 'in', label: 'input' }],
      outputs: [
        { id: 'true', label: 'true' },
        { id: 'false', label: 'false' },
      ],
    };
  }
  return {
    inputs: [{ id: 'in', label: 'in' }],
    outputs: [{ id: 'out', label: 'out' }],
  };
};

const buildFilePayload = (file, result) => {
  if (file && file.type && file.type.startsWith('image/')) {
    return {
      data_url: result,
      mime_type: file.type,
      filename: file.name,
    };
  }
  return result;
};

export const WorkflowNode = ({ id, data }) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const { nodeType, name, config = {}, onChange, onConfigChange, onDelete } = data;
  const safeType = nodeType || 'NODE';
  const ports = getPorts(safeType);
  const inputType = config.input_type || 'text';

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, name, config, updateNodeInternals]);

  const handleNameChange = (event) => {
    onChange(id, { name: event.target.value });
  };

  const handleConfigChange = (changes) => {
    onConfigChange(id, changes);
  };

  const handleInputTypeChange = (event) => {
    handleConfigChange({ input_type: event.target.value, value: '' });
  };

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      handleConfigChange({ value: buildFilePayload(file, reader.result) });
      event.target.value = '';
    };
    if (file.type && file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  const fileName =
    config.value && typeof config.value === 'object' && config.value.filename
      ? config.value.filename
      : '';

  const conditionExpression =
    safeType === 'CONDITION' ? buildConditionExpression(config) : '';

  const mergeSourcesValue = safeType === 'MERGE' ? formatIdList(config.sources) : '';
  const outputSelectValue = safeType === 'OUTPUT' ? formatIdList(config.select) : '';

  return (
    <BaseNode
      title={name || safeType}
      subtitle={safeType}
      variant={safeType.toLowerCase()}
      className={`node-${safeType.toLowerCase()}`}
      inputs={ports.inputs}
      outputs={ports.outputs}
      onDelete={() => onDelete(id)}
    >
      <div className="node-fields">
        <div className="node-field-group">
          <label htmlFor={`${id}-name`}>Name</label>
          <input
            id={`${id}-name`}
            className="node-field nodrag"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="Node name"
          />
        </div>

        {safeType === 'INPUT' && (
          <>
            <div className="node-field-group">
              <label htmlFor={`${id}-input-key`}>Input key</label>
              <input
                id={`${id}-input-key`}
                className="node-field nodrag"
                type="text"
                value={config.key || ''}
                onChange={(event) => handleConfigChange({ key: event.target.value })}
                placeholder="input_key"
              />
            </div>
            <div className="node-field-group">
              <label htmlFor={`${id}-input-type`}>Input type</label>
              <select
                id={`${id}-input-type`}
                className="node-field nodrag"
                value={inputType}
                onChange={handleInputTypeChange}
              >
                <option value="text">Text</option>
                <option value="file">File</option>
                <option value="image">Image</option>
              </select>
            </div>
            {inputType === 'text' ? (
              <div className="node-field-group">
                <label htmlFor={`${id}-input-value`}>Value</label>
                <textarea
                  id={`${id}-input-value`}
                  className="node-field nodrag"
                  rows={2}
                  value={config.value || ''}
                  onChange={(event) => handleConfigChange({ value: event.target.value })}
                  placeholder="text input"
                />
              </div>
            ) : (
              <div className="node-field-group">
                <label htmlFor={`${id}-input-file`}>Upload</label>
                <input
                  id={`${id}-input-file`}
                  className="node-field nodrag"
                  type="file"
                  accept={inputType === 'image' ? 'image/*' : '.txt,.md,.csv,.json'}
                  onChange={handleFileChange}
                />
                {fileName ? <div className="node-file-name">{fileName}</div> : null}
                {config.value ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="nodrag"
                    type="button"
                    onClick={() => handleConfigChange({ value: '' })}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            )}
          </>
        )}

        {safeType === 'HTTP' && (
          <>
            <div className="node-field-group">
              <label htmlFor={`${id}-http-url`}>URL</label>
              <input
                id={`${id}-http-url`}
                className="node-field nodrag"
                type="text"
                value={config.url || ''}
                onChange={(event) => handleConfigChange({ url: event.target.value })}
                placeholder="https://api.example.com"
              />
            </div>
            <div className="node-field-group">
              <label htmlFor={`${id}-http-method`}>Method</label>
              <select
                id={`${id}-http-method`}
                className="node-field nodrag"
                value={(config.method || 'GET').toUpperCase()}
                onChange={(event) => handleConfigChange({ method: event.target.value })}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div className="node-field-group">
              <label htmlFor={`${id}-http-body`}>Body (optional)</label>
              <textarea
                id={`${id}-http-body`}
                className="node-field nodrag"
                rows={2}
                value={config.body || ''}
                onChange={(event) => handleConfigChange({ body: event.target.value })}
                placeholder='{"key":"value"}'
              />
            </div>
          </>
        )}

        {safeType === 'TRANSFORM' && (
          <div className="node-field-group">
            <label htmlFor={`${id}-transform-template`}>Template</label>
            <textarea
              id={`${id}-transform-template`}
              className="node-field nodrag"
              rows={2}
              value={config.template || ''}
              onChange={(event) => handleConfigChange({ template: event.target.value })}
              placeholder="Hello {{name}}"
            />
          </div>
        )}

        {safeType === 'LLM' && (
          <>
            <div className="node-field-group">
              <label htmlFor={`${id}-llm-prompt`}>Prompt</label>
              <textarea
                id={`${id}-llm-prompt`}
                className="node-field nodrag"
                rows={2}
                value={config.prompt || ''}
                onChange={(event) => handleConfigChange({ prompt: event.target.value })}
                placeholder="Summarize {{text}}"
              />
            </div>
            <div className="node-field-group">
              <label htmlFor={`${id}-llm-image`}>Image key (optional)</label>
              <input
                id={`${id}-llm-image`}
                className="node-field nodrag"
                type="text"
                value={config.image_key || ''}
                onChange={(event) => handleConfigChange({ image_key: event.target.value })}
                placeholder="input key"
              />
            </div>
          </>
        )}

        {safeType === 'CONDITION' && (
          <div className="node-field-group">
            <label htmlFor={`${id}-condition`}>Condition</label>
            <textarea
              id={`${id}-condition`}
              className="node-field nodrag"
              rows={2}
              value={conditionExpression}
              onChange={(event) => {
                const expression = event.target.value;
                const parsed = parseConditionExpression(expression);
                const nextConfig = { expression };
                if (parsed) {
                  nextConfig.left = parsed.left;
                  nextConfig.operator = parsed.operator;
                  nextConfig.right = parsed.right;
                }
                handleConfigChange(nextConfig);
              }}
              placeholder="left > right"
            />
          </div>
        )}

        {safeType === 'MERGE' && (
          <>
            <div className="node-field-group">
              <label htmlFor={`${id}-merge-sources`}>Sources</label>
              <input
                id={`${id}-merge-sources`}
                className="node-field nodrag"
                type="text"
                value={mergeSourcesValue}
                onChange={(event) =>
                  handleConfigChange({ sources: parseIdList(event.target.value) })
                }
                placeholder="1,2,3"
              />
            </div>
            <div className="node-field-group">
              <label htmlFor={`${id}-merge-key`}>Key by</label>
              <select
                id={`${id}-merge-key`}
                className="node-field nodrag"
                value={config.key_by || 'name'}
                onChange={(event) => handleConfigChange({ key_by: event.target.value })}
              >
                <option value="name">Name</option>
                <option value="id">ID</option>
              </select>
            </div>
          </>
        )}

        {safeType === 'DELAY' && (
          <div className="node-field-group">
            <label htmlFor={`${id}-delay`}>Seconds</label>
            <input
              id={`${id}-delay`}
              className="node-field nodrag"
              type="number"
              min="0"
              step="0.5"
              value={config.seconds ?? 1}
              onChange={(event) => handleConfigChange({ seconds: Number(event.target.value) })}
            />
          </div>
        )}

        {safeType === 'OUTPUT' && (
          <div className="node-field-group">
            <label htmlFor={`${id}-output-select`}>Select</label>
            <input
              id={`${id}-output-select`}
              className="node-field nodrag"
              type="text"
              value={outputSelectValue}
              onChange={(event) =>
                handleConfigChange({ select: parseIdList(event.target.value) })
              }
              placeholder="1,2"
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
};
