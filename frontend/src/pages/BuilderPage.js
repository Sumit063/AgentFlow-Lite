import React, { useMemo, useRef, useState } from 'react';

import { createWorkflow } from '../api';

const NODE_TYPES = [
  { type: 'INPUT', label: 'INPUT' },
  { type: 'HTTP', label: 'HTTP' },
  { type: 'LLM', label: 'LLM' },
  { type: 'OUTPUT', label: 'OUTPUT' },
];

const NODE_WIDTH = 140;
const NODE_HEIGHT = 60;

const BuilderPage = ({ token, onBack, onOpenWorkflow }) => {
  const canvasRef = useRef(null);
  const nextNodeId = useRef(1);
  const nextEdgeId = useRef(1);
  const typeCounts = useRef({ INPUT: 0, HTTP: 0, LLM: 0, OUTPUT: 0 });
  const dragInfo = useRef({ id: null, offsetX: 0, offsetY: 0, moved: false });
  const suppressClick = useRef(false);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [pendingConnectId, setPendingConnectId] = useState(null);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [generatedJson, setGeneratedJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const nodeMap = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  const handleDragStart = (event, type) => {
    event.dataTransfer.setData('application/node-type', type);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/node-type');
    if (!type || !canvasRef.current) {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left - NODE_WIDTH / 2;
    const y = event.clientY - rect.top - NODE_HEIGHT / 2;
    addNode(type, x, y);
  };

  const addNode = (type, x, y) => {
    typeCounts.current[type] = (typeCounts.current[type] || 0) + 1;
    const id = nextNodeId.current;
    nextNodeId.current += 1;

    const defaultConfig = {};

    setNodes((prev) => [
      ...prev,
      {
        id,
        type,
        name: `${type} ${typeCounts.current[type]}`,
        x: Math.max(0, x),
        y: Math.max(0, y),
        config: defaultConfig,
      },
    ]);
  };

  const handleCanvasClick = () => {
    setPendingConnectId(null);
    setSelectedNodeId(null);
  };

  const removeNode = (nodeId) => {
    setNodes((prev) => prev.filter((node) => node.id !== nodeId));
    setEdges((prev) => prev.filter((edge) => edge.from !== nodeId && edge.to !== nodeId));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (pendingConnectId === nodeId) {
      setPendingConnectId(null);
    }
  };

  const removeEdge = (edgeId) => {
    setEdges((prev) => prev.filter((edge) => edge.id !== edgeId));
  };

  const handleNodeClick = (event, nodeId) => {
    event.stopPropagation();
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }

    if (pendingConnectId && pendingConnectId !== nodeId) {
      const added = tryAddEdge(pendingConnectId, nodeId);
      if (added) {
        setPendingConnectId(null);
        setSelectedNodeId(nodeId);
      } else {
        setSelectedNodeId(pendingConnectId);
      }
      return;
    }

    if (pendingConnectId === nodeId) {
      setPendingConnectId(null);
    } else {
      setPendingConnectId(nodeId);
    }
    setSelectedNodeId(nodeId);
  };

  const tryAddEdge = (fromId, toId) => {
    if (fromId === toId) {
      setError('Cannot connect a node to itself.');
      return false;
    }
    if (edges.find((edge) => edge.from === fromId && edge.to === toId)) {
      setError('Link already exists.');
      return false;
    }
    if (createsCycle(fromId, toId)) {
      setError('Connecting these nodes would create a cycle.');
      return false;
    }
    setError('');
    setEdges((prev) => [...prev, { id: nextEdgeId.current++, from: fromId, to: toId }]);
    return true;
  };

  const createsCycle = (fromId, toId) => {
    const adjacency = {};
    nodes.forEach((node) => {
      adjacency[node.id] = [];
    });
    edges.forEach((edge) => {
      if (!adjacency[edge.from]) {
        adjacency[edge.from] = [];
      }
      adjacency[edge.from].push(edge.to);
    });
    if (!adjacency[fromId]) {
      adjacency[fromId] = [];
    }
    adjacency[fromId].push(toId);

    const stack = [toId];
    const visited = new Set();
    while (stack.length) {
      const current = stack.pop();
      if (current === fromId) {
        return true;
      }
      if (visited.has(current)) {
        continue;
      }
      visited.add(current);
      const neighbors = adjacency[current] || [];
      neighbors.forEach((next) => stack.push(next));
    }
    return false;
  };

  const handleNodeMouseDown = (event, nodeId) => {
    event.stopPropagation();
    if (!canvasRef.current) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    dragInfo.current = {
      id: nodeId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (event) => {
    if (!dragInfo.current.id || !canvasRef.current) {
      return;
    }
    const rect = canvasRef.current.getBoundingClientRect();
    const newX = event.clientX - rect.left - dragInfo.current.offsetX;
    const newY = event.clientY - rect.top - dragInfo.current.offsetY;
    dragInfo.current.moved = true;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === dragInfo.current.id
          ? {
              ...node,
              x: Math.max(0, Math.min(newX, rect.width - NODE_WIDTH)),
              y: Math.max(0, Math.min(newY, rect.height - NODE_HEIGHT)),
            }
          : node
      )
    );
  };

  const handleMouseUp = () => {
    if (dragInfo.current.moved) {
      suppressClick.current = true;
    }
    dragInfo.current = { id: null, offsetX: 0, offsetY: 0, moved: false };
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  };

  const selectedNode = selectedNodeId ? nodeMap.get(selectedNodeId) : null;

  const updateSelectedNode = (changes) => {
    if (!selectedNode) {
      return;
    }
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNode.id ? { ...node, ...changes } : node
      )
    );
  };

  const updateSelectedConfig = (changes) => {
    if (!selectedNode) {
      return;
    }
    updateSelectedNode({ config: { ...selectedNode.config, ...changes } });
  };

  const handleGenerate = () => {
    const payload = buildPayload();
    setGeneratedJson(JSON.stringify(payload, null, 2));
  };

  const buildPayload = () => {
    return {
      name: workflowName || 'Untitled Workflow',
      description: workflowDescription || null,
      nodes: nodes.map(({ id, type, name, config }) => ({ id, type, name, config })),
      edges: edges.map(({ from, to }) => ({ from_node_id: from, to_node_id: to })),
    };
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = buildPayload();
      setGeneratedJson(JSON.stringify(payload, null, 2));
      const created = await createWorkflow(payload, token);
      setMessage('Workflow saved.');
      if (onOpenWorkflow) {
        onOpenWorkflow(created.id);
      }
    } catch (err) {
      setError(err.message || 'Unable to save workflow');
    } finally {
      setSaving(false);
    }
  };

  const toggleOutputSelection = (nodeId) => {
    if (!selectedNode) {
      return;
    }
    const current = selectedNode.config.select || [];
    const exists = current.includes(nodeId);
    const next = exists ? current.filter((id) => id !== nodeId) : [...current, nodeId];
    updateSelectedConfig({ select: next });
  };

  const connectHint = pendingConnectId
    ? `Connecting from ${nodeMap.get(pendingConnectId)?.name || 'node'}. Click another node to link.`
    : 'Click a node, then click another to connect.';

  return (
    <div className="page builder-page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" type="button" onClick={onBack}>
            Back
          </button>
          <h2>Workflow Builder</h2>
          <p className="muted">Drag nodes, click to connect, then generate JSON.</p>
        </div>
      </div>

      <div className="builder-layout">
        <aside className="panel builder-sidebar">
          <h3>Node Types</h3>
          <div className="sidebar-list">
            {NODE_TYPES.map((node) => (
              <div
                key={node.type}
                className="sidebar-item"
                draggable
                onDragStart={(event) => handleDragStart(event, node.type)}
              >
                {node.label}
              </div>
            ))}
          </div>
          <div className="helper">
            <p className="muted">Drop on canvas. {connectHint}</p>
          </div>
        </aside>

        <section className="panel builder-canvas-panel">
          <div
            className="builder-canvas"
            ref={canvasRef}
            onDrop={handleDrop}
            onDragOver={(event) => event.preventDefault()}
            onClick={handleCanvasClick}
          >
            <svg className="canvas-lines">
              {edges.map((edge, index) => {
                const fromNode = nodeMap.get(edge.from);
                const toNode = nodeMap.get(edge.to);
                if (!fromNode || !toNode) {
                  return null;
                }
                const x1 = fromNode.x + NODE_WIDTH / 2;
                const y1 = fromNode.y + NODE_HEIGHT / 2;
                const x2 = toNode.x + NODE_WIDTH / 2;
                const y2 = toNode.y + NODE_HEIGHT / 2;
                return (
                  <line
                    key={`${edge.from}-${edge.to}-${index}`}
                    className="edge-line"
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    markerEnd="url(#arrow)"
                  />
                );
              })}
              <defs>
                <marker
                  id="arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="6"
                  refY="4"
                  orient="auto"
                >
                  <path d="M0,0 L8,4 L0,8 Z" fill="#2a5d7c" />
                </marker>
              </defs>
            </svg>
            {edges.map((edge) => {
              const fromNode = nodeMap.get(edge.from);
              const toNode = nodeMap.get(edge.to);
              if (!fromNode || !toNode) {
                return null;
              }
              const midX = (fromNode.x + toNode.x) / 2 + NODE_WIDTH / 2;
              const midY = (fromNode.y + toNode.y) / 2 + NODE_HEIGHT / 2;
              return (
                <button
                  key={`edge-delete-${edge.id}`}
                  type="button"
                  className="edge-delete-button"
                  style={{ left: midX - 10, top: midY - 10 }}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeEdge(edge.id);
                  }}
                  aria-label="Remove link"
                  title="Remove link"
                >
                  ×
                </button>
              );
            })}
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const isPending = node.id === pendingConnectId;
              return (
                <div
                  key={node.id}
                  className={`node-card ${isSelected ? 'selected' : ''} ${isPending ? 'pending' : ''}`}
                  style={{ left: node.x, top: node.y }}
                  onMouseDown={(event) => handleNodeMouseDown(event, node.id)}
                  onClick={(event) => handleNodeClick(event, node.id)}
                >
                  <button
                    type="button"
                    className="node-delete"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeNode(node.id);
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    aria-label="Remove node"
                    title="Remove node"
                  >
                    ×
                  </button>
                  <div className="node-type">{node.type}</div>
                  <div className="node-name">{node.name}</div>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="panel config-panel">
          <h3>Configuration</h3>
          {selectedNode ? (
            <div className="form">
              <label className="field">
                <span>Name</span>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={(event) => updateSelectedNode({ name: event.target.value })}
                />
              </label>
              {selectedNode.type === 'HTTP' && (
                <label className="field">
                  <span>URL</span>
                  <input
                    type="text"
                    value={selectedNode.config.url || ''}
                    onChange={(event) => updateSelectedConfig({ url: event.target.value })}
                  />
                </label>
              )}
              {selectedNode.type === 'LLM' && (
                <label className="field">
                  <span>Prompt</span>
                  <textarea
                    rows={4}
                    value={selectedNode.config.prompt || ''}
                    onChange={(event) => updateSelectedConfig({ prompt: event.target.value })}
                  />
                </label>
              )}
              {selectedNode.type === 'OUTPUT' && (
                <div className="field">
                  <span>Select upstream nodes</span>
                  <div className="checkbox-list">
                    {nodes
                      .filter((node) => node.id !== selectedNode.id)
                      .map((node) => (
                        <label key={node.id} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={(selectedNode.config.select || []).includes(node.id)}
                            onChange={() => toggleOutputSelection(node.id)}
                          />
                          {node.name}
                        </label>
                      ))}
                  </div>
                </div>
              )}
              {selectedNode.type === 'INPUT' && (
                <p className="muted">Input nodes pass through run input.</p>
              )}
            </div>
          ) : (
            <p className="muted">Select a node to edit its settings.</p>
          )}
        </aside>
      </div>

      <section className="panel json-panel">
        <div className="page-header">
          <div>
            <h3>Workflow JSON</h3>
            <p className="muted">Generate JSON to save or review.</p>
          </div>
          <div className="actions">
            <button className="btn btn-secondary" type="button" onClick={handleGenerate}>
              Generate JSON
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
        <div className="form">
          <label className="field">
            <span>Workflow name</span>
            <input
              type="text"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Description</span>
            <input
              type="text"
              value={workflowDescription}
              onChange={(event) => setWorkflowDescription(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Generated JSON</span>
            <textarea rows={10} value={generatedJson} readOnly />
          </label>
          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>
    </div>
  );
};

export default BuilderPage;
