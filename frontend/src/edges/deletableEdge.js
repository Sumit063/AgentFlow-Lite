import { BaseEdge, EdgeLabelRenderer, getBezierPath } from 'reactflow';
import { useStore } from '../store';

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
}) => {
  const removeEdge = useStore((state) => state.removeEdge);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <button
          type="button"
          className="edge-delete"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
          onClick={(event) => {
            event.stopPropagation();
            removeEdge(id);
          }}
          aria-label="Remove edge"
          title="Remove edge"
        >
          x
        </button>
      </EdgeLabelRenderer>
    </>
  );
};
