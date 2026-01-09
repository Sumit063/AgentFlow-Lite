// toolbar.js

import { DraggableNode } from './draggableNode';
import { nodeRegistry } from './nodes/nodeRegistry';

export const PipelineToolbar = () => {
    const groupedNodes = nodeRegistry.reduce((acc, node) => {
        if (!acc[node.group]) {
            acc[node.group] = [];
        }
        acc[node.group].push(node);
        return acc;
    }, {});

    return (
        <div className="toolbar">
            <div className="toolbar-title">Node Library</div>
            <div className="toolbar-subtitle">
                Drag a node onto the canvas to start wiring a pipeline.
            </div>
            {Object.entries(groupedNodes).map(([group, nodes]) => (
                <div className="toolbar-section" key={group}>
                    <div className="toolbar-section-title">{group}</div>
                    <div className="toolbar-grid">
                        {nodes.map((node) => (
                            <DraggableNode
                                key={node.type}
                                type={node.type}
                                label={node.label}
                                description={node.description}
                                variant={node.variant}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
