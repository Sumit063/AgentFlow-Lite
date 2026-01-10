import { EdgeLabelRenderer, getSmoothStepPath } from 'reactflow';

export const DeletableEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  data,
}) => {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={style}
      />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="edge-delete-button"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (data && data.onDelete) {
              data.onDelete(id);
            }
          }}
          aria-label="Remove link"
          title="Remove link"
        >
          ×
        </button>
      </EdgeLabelRenderer>
    </>
  );
};
