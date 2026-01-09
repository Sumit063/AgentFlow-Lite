import React, { useEffect, useMemo, useRef, useState } from 'react';

import { createWorkflow, generateWorkflow } from '../api';

const NODE_TYPES = [
  { type: 'INPUT', label: 'INPUT' },
  { type: 'TRANSFORM', label: 'TRANSFORM' },
  { type: 'HTTP', label: 'HTTP' },
  { type: 'LLM', label: 'LLM' },
  { type: 'OUTPUT', label: 'OUTPUT' },
];

const NODE_WIDTH = 140;
const NODE_HEIGHT = 60;

const VARIABLE_REGEX = /\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}/g;
const DOUBLE_VARIABLE_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

const extractVariables = (text) => {
  const vars = new Set();
  DOUBLE_VARIABLE_REGEX.lastIndex = 0;
  let match = DOUBLE_VARIABLE_REGEX.exec(text);
  while (match) {
    vars.add(match[1]);
    match = DOUBLE_VARIABLE_REGEX.exec(text);
  }
  VARIABLE_REGEX.lastIndex = 0;
  match = VARIABLE_REGEX.exec(text);
  while (match) {
    vars.add(match[1]);
    match = VARIABLE_REGEX.exec(text);
  }
  return Array.from(vars);
};

const getTopologicalOrder = (nodes, edges) => {
  const indegree = new Map();
  const adjacency = new Map();
  nodes.forEach((node) => {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });
  edges.forEach((edge) => {
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)) {
      return;
    }
    adjacency.get(edge.from).push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
  });

  const queue = [];
  indegree.forEach((value, key) => {
    if (value === 0) {
      queue.push(key);
    }
  });

  const order = [];
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    adjacency.get(current).forEach((next) => {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) {
        queue.push(next);
      }
    });
  }

  return {
    order,
    isDag: order.length === nodes.length,
  };
};

const formatNodeSummary = (node) => {
  const type = node.type;
  if (type === 'INPUT') {
    return 'Collects run input variables.';
  }
  if (type === 'HTTP') {
    return node.config.url ? `GET ${node.config.url}` : 'HTTP GET request.';
  }
  if (type === 'TRANSFORM') {
    return node.config.template
      ? `Template: ${node.config.template}`
      : 'Template transform.';
  }
  if (type === 'LLM') {
    return node.config.prompt
      ? `Prompt: ${node.config.prompt}`
      : 'LLM prompt.';
  }
  if (type === 'OUTPUT') {
    const select = node.config.select;
    if (Array.isArray(select) && select.length > 0) {
      return `Returns outputs from nodes: ${select.join(', ')}`;
    }
    return 'Returns all outputs.';
  }
  return 'Workflow step.';
};

const SAMPLE_WORKFLOWS = [
  {
    id: 'welcome',
    title: 'Welcome Message',
    description: 'INPUT → TRANSFORM → OUTPUT',
    payload: {
      name: 'Welcome Flow',
      description: 'Turns user input into a greeting.',
      nodes: [
        { id: 1, type: 'INPUT', name: 'User Input', config: {} },
        {
          id: 2,
          type: 'TRANSFORM',
          name: 'Greeting',
          config: { template: 'Hello {{text}}!' },
        },
        { id: 3, type: 'OUTPUT', name: 'Result', config: { select: [2] } },
      ],
      edges: [
        { from_node_id: 1, to_node_id: 2 },
        { from_node_id: 2, to_node_id: 3 },
      ],
    },
  },
  {
    id: 'http',
    title: 'HTTP Fetch',
    description: 'INPUT → HTTP → OUTPUT',
    payload: {
      name: 'HTTP Fetch',
      description: 'Fetches JSON from a URL and returns it.',
      nodes: [
        { id: 1, type: 'INPUT', name: 'Input', config: {} },
        {
          id: 2,
          type: 'HTTP',
          name: 'Fetch Data',
          config: { url: 'https://jsonplaceholder.typicode.com/todos/1' },
        },
        { id: 3, type: 'OUTPUT', name: 'Output', config: { select: [2] } },
      ],
      edges: [
        { from_node_id: 1, to_node_id: 2 },
        { from_node_id: 2, to_node_id: 3 },
      ],
    },
  },
  {
    id: 'llm',
    title: 'LLM Summary',
    description: 'INPUT → LLM → OUTPUT',
    payload: {
      name: 'LLM Summary',
      description: 'Sends input to a stubbed LLM step.',
      nodes: [
        { id: 1, type: 'INPUT', name: 'Input', config: {} },
        {
          id: 2,
          type: 'LLM',
          name: 'Summary',
          config: { prompt: 'Summarize the run input.' },
        },
        { id: 3, type: 'OUTPUT', name: 'Output', config: { select: [2] } },
      ],
      edges: [
        { from_node_id: 1, to_node_id: 2 },
        { from_node_id: 2, to_node_id: 3 },
      ],
    },
  },
];

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
  const [showHelp, setShowHelp] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [variableValues, setVariableValues] = useState({});
  const [promptDraft, setPromptDraft] = useState('');
  const [promptError, setPromptError] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);

  const nodeMap = useMemo(() => {
    return new Map(nodes.map((node) => [node.id, node]));
  }, [nodes]);

  const flowSummary = useMemo(() => {
    if (nodes.length === 0) {
      return { isDag: true, steps: [] };
    }
    const { order, isDag } = getTopologicalOrder(nodes, edges);
    const steps = isDag
      ? order.map((nodeId, index) => {
          const node = nodeMap.get(nodeId);
          return {
            index: index + 1,
            id: nodeId,
            name: node?.name || `Node ${nodeId}`,
            type: node?.type || 'UNKNOWN',
            summary: node ? formatNodeSummary(node) : 'Missing node.',
          };
        })
      : [];
    return { isDag, steps };
  }, [nodes, edges, nodeMap]);

  const variables = useMemo(() => {
    const found = new Set();
    nodes.forEach((node) => {
      if (node.type === 'TRANSFORM' && node.config.template) {
        extractVariables(node.config.template).forEach((name) => found.add(name));
      }
      if (node.type === 'LLM' && node.config.prompt) {
        extractVariables(node.config.prompt).forEach((name) => found.add(name));
      }
    });
    return Array.from(found).sort();
  }, [nodes]);

  useEffect(() => {
    setVariableValues((prev) => {
      const next = {};
      variables.forEach((name) => {
        next[name] = prev[name] ?? '';
      });
      return next;
    });
  }, [variables]);

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
    setNodes((prev) =>
      prev
        .filter((node) => node.id !== nodeId)
        .map((node) => {
          if (node.type !== 'OUTPUT') {
            return node;
          }
          const select = node.config.select || [];
          if (!select.includes(nodeId)) {
            return node;
          }
          return { ...node, config: { ...node.config, select: select.filter((id) => id !== nodeId) } };
        })
    );
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

  const loadWorkflowPayload = (payload) => {
    if (!payload || !payload.nodes || !payload.edges) {
      throw new Error('Invalid workflow JSON. Expected nodes and edges.');
    }

    const normalizedNodes = payload.nodes.map((node, index) => {
      const rawId = Number(node.id);
      const nodeId = Number.isFinite(rawId) ? rawId : index + 1;
      const x = typeof node.x === 'number' ? node.x : 20 + (index % 3) * 180;
      const y = typeof node.y === 'number' ? node.y : 20 + Math.floor(index / 3) * 120;
      return {
        id: nodeId,
        type: node.type,
        name: node.name || `${node.type} ${index + 1}`,
        x,
        y,
        config: node.config || {},
      };
    });

    const normalizedEdges = payload.edges.map((edge, index) => {
      const from = edge.from ?? edge.from_node_id;
      const to = edge.to ?? edge.to_node_id;
      return {
        id: edge.id || index + 1,
        from: Number(from),
        to: Number(to),
      };
    });

    const maxNodeId = normalizedNodes.reduce((max, node) => Math.max(max, node.id), 0);
    const maxEdgeId = normalizedEdges.reduce((max, edge) => Math.max(max, edge.id), 0);
    const counts = normalizedNodes.reduce(
      (acc, node) => {
        acc[node.type] = (acc[node.type] || 0) + 1;
        return acc;
      },
      { INPUT: 0, TRANSFORM: 0, HTTP: 0, LLM: 0, OUTPUT: 0 }
    );

    nextNodeId.current = maxNodeId + 1;
    nextEdgeId.current = maxEdgeId + 1;
    typeCounts.current = counts;

    setNodes(normalizedNodes);
    setEdges(normalizedEdges);
    setWorkflowName(payload.name || 'Imported Workflow');
    setWorkflowDescription(payload.description || '');
    setSelectedNodeId(null);
    setPendingConnectId(null);
    setMessage('Workflow loaded.');
    setError('');
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

  const handleCopyRunInput = async () => {
    const text = JSON.stringify(variableValues, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Run input copied to clipboard.');
    } catch (err) {
      setMessage('Run input generated. Copy it manually.');
    }
  };

  const handleCopyJson = async () => {
    const payload = buildPayload();
    const text = JSON.stringify(payload, null, 2);
    setGeneratedJson(text);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('JSON copied to clipboard.');
    } catch (err) {
      setMessage('JSON generated. Copy it manually.');
    }
  };

  const updateVariableValue = (name, value) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleImport = () => {
    setImportError('');
    setMessage('');
    try {
      const parsed = JSON.parse(importJson);
      loadWorkflowPayload(parsed);
    } catch (err) {
      setImportError('Invalid JSON. Please paste a full workflow payload.');
    }
  };

  const handleLoadSample = (sample) => {
    setImportJson('');
    setImportError('');
    loadWorkflowPayload(sample.payload);
  };

  const runInputPreview = JSON.stringify(variableValues, null, 2);

  const handleGenerateFromPrompt = async () => {
    if (!promptDraft.trim()) {
      setPromptError('Please enter a prompt.');
      return;
    }
    setPromptLoading(true);
    setPromptError('');
    setMessage('');
    try {
      const payload = await generateWorkflow(promptDraft.trim(), token);
      loadWorkflowPayload(payload);
      setGeneratedJson(JSON.stringify(payload, null, 2));
      setMessage('Workflow generated from prompt.');
    } catch (err) {
      setPromptError(err.message || 'Unable to generate workflow.');
    } finally {
      setPromptLoading(false);
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
        <div className="actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
          >
            {showHelp ? 'Close Help' : 'Help'}
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Builder help</h3>
              <button
                className="btn btn-ghost btn-small"
                type="button"
                onClick={() => setShowHelp(false)}
              >
                Close
              </button>
            </div>
            <ol className="help-list">
              <li>Drag a node from the sidebar onto the canvas.</li>
              <li>Click one node, then click another to connect them.</li>
              <li>Click a node to edit its settings on the right.</li>
              <li>Use {'{{variable}}'} placeholders in TRANSFORM/LLM.</li>
              <li>Fill values in Run Inputs and copy the JSON.</li>
            </ol>
            <div className="help-example">
              <div className="help-title">Example (INPUT → TRANSFORM → OUTPUT)</div>
              <pre>
{`TRANSFORM template: Hello {{text}}!

Run input JSON:
{ "text": "world" }`}
              </pre>
            </div>
            <div className="sidebar-section">
              <div className="section-title">Sample workflows</div>
              <div className="sample-list">
                {SAMPLE_WORKFLOWS.map((sample) => (
                  <div key={sample.id} className="sample-card">
                    <div className="sample-title">{sample.title}</div>
                    <div className="sample-meta">{sample.description}</div>
                    <button
                      className="btn btn-ghost btn-small"
                      type="button"
                      onClick={() => handleLoadSample(sample)}
                    >
                      Load
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
              {selectedNode.type === 'TRANSFORM' && (
                <label className="field">
                  <span>Template</span>
                  <textarea
                    rows={3}
                    value={selectedNode.config.template || ''}
                    onChange={(event) => updateSelectedConfig({ template: event.target.value })}
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
            <button className="btn btn-ghost" type="button" onClick={handleCopyJson}>
              Copy JSON
            </button>
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Workflow'}
            </button>
          </div>
        </div>
        <div className="form">
          <div className="flow-summary">
            <div className="section-title">Flow summary</div>
            {nodes.length === 0 ? (
              <p className="muted">Add nodes to see the execution flow.</p>
            ) : flowSummary.isDag ? (
              <ol className="flow-list">
                {flowSummary.steps.map((step) => (
                  <li key={step.id}>
                    <span className="flow-step">
                      {step.index}. {step.name} ({step.type})
                    </span>
                    <span className="flow-detail">{step.summary}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="error">Flow is not a valid DAG. Remove cycles to proceed.</p>
            )}
          </div>
          <div className="prompt-builder">
            <div className="section-title">Describe your goal</div>
            <textarea
              rows={4}
              value={promptDraft}
              onChange={(event) => setPromptDraft(event.target.value)}
              placeholder="Example: Build a pipeline for creating a chatbot that replies using my input."
            />
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleGenerateFromPrompt}
              disabled={promptLoading}
            >
              {promptLoading ? 'Generating...' : 'Generate Workflow'}
            </button>
            {promptError && <p className="error">{promptError}</p>}
          </div>
          <div className="input-builder">
            <div className="section-title">Run Inputs (variables)</div>
            {variables.length === 0 ? (
              <p className="muted">
                No variables detected. Add {'{{name}}'} in TRANSFORM or LLM to create inputs.
              </p>
            ) : (
              <div className="input-list">
                {variables.map((name) => (
                  <label key={name} className="input-row">
                    <span className="input-key">{name}</span>
                    <input
                      type="text"
                      value={variableValues[name] || ''}
                      onChange={(event) => updateVariableValue(name, event.target.value)}
                      placeholder="Value"
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
          <label className="field">
            <span>Run Input JSON</span>
            <textarea rows={6} value={runInputPreview} readOnly />
          </label>
          <button className="btn btn-ghost" type="button" onClick={handleCopyRunInput}>
            Copy Run Input
          </button>
          <label className="field">
            <span>Import JSON</span>
            <textarea
              rows={6}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder="Paste workflow JSON here"
            />
          </label>
          <button className="btn btn-secondary" type="button" onClick={handleImport}>
            Import JSON
          </button>
          {importError && <p className="error">{importError}</p>}
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
