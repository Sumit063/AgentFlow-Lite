// draggableNode.js

export const DraggableNode = ({ type, label, description, variant }) => {
    const onDragStart = (event, nodeType) => {
      const appData = { nodeType }
      event.currentTarget.style.cursor = 'grabbing';
      event.dataTransfer.setData('application/reactflow', JSON.stringify(appData));
      event.dataTransfer.effectAllowed = 'move';
    };
  
    return (
      <div
        className="draggable-node"
        data-variant={variant}
        onDragStart={(event) => onDragStart(event, type)}
        onDragEnd={(event) => (event.currentTarget.style.cursor = 'grab')}
        draggable
      >
          <div className="draggable-title">{label}</div>
          {description ? <div className="draggable-description">{description}</div> : null}
      </div>
    );
  };
  
