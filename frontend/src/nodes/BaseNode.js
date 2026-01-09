import { Handle, Position } from 'reactflow';

const buildHandlePositions = (count) => {
  if (count <= 0) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => ((index + 1) * 100) / (count + 1));
};

const normalizeHandle = (handle) =>
  typeof handle === 'string' ? { id: handle } : handle;

export const BaseNode = ({
  title,
  subtitle,
  inputs = [],
  outputs = [],
  variant = 'default',
  className = '',
  style = {},
  onDelete,
  children,
}) => {
  const normalizedInputs = inputs.map(normalizeHandle);
  const normalizedOutputs = outputs.map(normalizeHandle);
  const inputPositions = buildHandlePositions(normalizedInputs.length);
  const outputPositions = buildHandlePositions(normalizedOutputs.length);

  return (
    <div className={`node-card ${className}`} data-variant={variant} style={style}>
      {normalizedInputs.map((handle, index) => (
        <div key={handle.id}>
          <Handle
            type="target"
            position={Position.Left}
            id={handle.id}
            className="node-handle node-handle-input"
            style={{ top: `${inputPositions[index]}%` }}
          />
          {handle.label ? (
            <div
              className="node-handle-label node-handle-label-input"
              style={{ top: `${inputPositions[index]}%` }}
            >
              {handle.label}
            </div>
          ) : null}
        </div>
      ))}
      {normalizedOutputs.map((handle, index) => (
        <div key={handle.id}>
          <Handle
            type="source"
            position={Position.Right}
            id={handle.id}
            className="node-handle node-handle-output"
            style={{ top: `${outputPositions[index]}%` }}
          />
          {handle.label ? (
            <div
              className="node-handle-label node-handle-label-output"
              style={{ top: `${outputPositions[index]}%` }}
            >
              {handle.label}
            </div>
          ) : null}
        </div>
      ))}
      <div className="node-header">
        <div>
          <div className="node-title">{title}</div>
          {subtitle ? <div className="node-subtitle">{subtitle}</div> : null}
        </div>
        {onDelete ? (
          <button
            type="button"
            className="node-delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete();
            }}
            aria-label={`Remove ${title} node`}
            title="Remove node"
          >
            x
          </button>
        ) : null}
      </div>
      {children ? <div className="node-body">{children}</div> : null}
    </div>
  );
};
