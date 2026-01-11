import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import ReactFlow, {
  addEdge,
  Background,
  BackgroundVariant,
  ConnectionLineType,
  Controls,
  MarkerType,
  Panel as FlowPanel,
  useEdgesState,
  useNodesState,
} from 'reactflow';

import 'reactflow/dist/style.css';

import { createWorkflow, generateWorkflow } from '../api';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Panel } from '../components/ui/panel';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../components/ui/use-toast';
import { DeletableEdge } from '../edges/deletableEdge';
import { WorkflowNode } from '../nodes/WorkflowNode';

const NODE_TYPES = [
  { type: 'INPUT', label: 'INPUT' },
  { type: 'TRANSFORM', label: 'TRANSFORM' },
  { type: 'HTTP', label: 'HTTP' },
  { type: 'LLM', label: 'LLM' },
  { type: 'CONDITION', label: 'CONDITION' },
  { type: 'MERGE', label: 'MERGE' },
  { type: 'DELAY', label: 'DELAY' },
  { type: 'OUTPUT', label: 'OUTPUT' },
];

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 12,
    height: 12,
    color: '#94a3b8',
  },
};

const CONNECTION_LINE_STYLE = {
  stroke: '#94a3b8',
  strokeWidth: 1,
  strokeDasharray: '4 6',
};

const nodeTypes = { workflow: WorkflowNode };
const edgeTypes = { deletable: DeletableEdge };

const getDefaultConfig = (nodeType, index) => {
  if (nodeType === 'INPUT') {
    return {
      key: `input_${index}`,
      input_type: 'text',
      value: '',
    };
  }
  if (nodeType === 'HTTP') {
    return { url: '', method: 'GET', body: '' };
  }
  if (nodeType === 'DELAY') {
    return { seconds: 1 };
  }
  if (nodeType === 'CONDITION') {
    return { left: '', operator: 'equals', right: '', expression: '' };
  }
  if (nodeType === 'MERGE') {
    return { key_by: 'name', sources: [] };
  }
  if (nodeType === 'OUTPUT') {
    return { select: [] };
  }
  return {};
};

const operatorLabelMap = {
  equals: '==',
  not_equals: '!=',
  contains: 'contains',
  greater_than: '>',
  less_than: '<',
};

const formatNodeSummary = (node) => {
  if (!node) {
    return 'Missing node.';
  }
  const type = node.nodeType;
  const config = node.config || {};
  if (type === 'INPUT') {
    const key = config.key;
    if (key && 'value' in config) {
      return `Input key: ${key} (preset)`;
    }
    return key ? `Reads run input key: ${key}` : 'Collects run input variables.';
  }
  if (type === 'HTTP') {
    const method = (config.method || 'GET').toUpperCase();
    return config.url ? `${method} ${config.url}` : `HTTP ${method} request.`;
  }
  if (type === 'TRANSFORM') {
    return config.template ? `Template: ${config.template}` : 'Template transform.';
  }
  if (type === 'LLM') {
    return config.prompt ? `Prompt: ${config.prompt}` : 'LLM prompt.';
  }
  if (type === 'CONDITION') {
    if (config.expression) {
      return `Condition: ${config.expression}`;
    }
    const left = config.left || '';
    const operator = operatorLabelMap[config.operator] || config.operator || '';
    const right = config.right || '';
    return `Condition: ${left} ${operator} ${right}`.trim();
  }
  if (type === 'MERGE') {
    const sources = config.sources;
    if (Array.isArray(sources) && sources.length > 0) {
      return `Merges outputs from: ${sources.join(', ')}`;
    }
    return 'Merges all prior outputs.';
  }
  if (type === 'DELAY') {
    return `Waits ${config.seconds || 1} seconds.`;
  }
  if (type === 'OUTPUT') {
    const select = config.select;
    if (Array.isArray(select) && select.length > 0) {
      return `Returns outputs from nodes: ${select.join(', ')}`;
    }
    return 'Returns all outputs.';
  }
  return 'Workflow step.';
};

const getTopologicalOrder = (nodes, edges) => {
  const indegree = new Map();
  const adjacency = new Map();
  nodes.forEach((node) => {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  });
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) {
      return;
    }
    adjacency.get(edge.source).push(edge.target);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
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

const getGridPosition = (index, total) => {
  const columns = total <= 4 ? 2 : total <= 9 ? 3 : 4;
  const spacingX = 220;
  const spacingY = 160;
  const startX = 40;
  const startY = 40;
  const col = index % columns;
  const row = Math.floor(index / columns);
  return { x: startX + col * spacingX, y: startY + row * spacingY };
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
        {
          id: 1,
          type: 'INPUT',
          name: 'User Input',
          config: { key: 'text', input_type: 'text', value: 'world' },
        },
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
        {
          id: 1,
          type: 'INPUT',
          name: 'Input',
          config: { key: 'text', input_type: 'text', value: '' },
        },
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
        {
          id: 1,
          type: 'INPUT',
          name: 'Input',
          config: { key: 'text', input_type: 'text', value: 'Summarize this.' },
        },
        {
          id: 2,
          type: 'LLM',
          name: 'Summary',
          config: { prompt: 'Summarize {{text}}.' },
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
  const reactFlowWrapper = useRef(null);
  const nextNodeId = useRef(1);
  const typeCounts = useRef({
    INPUT: 0,
    TRANSFORM: 0,
    HTTP: 0,
    LLM: 0,
    CONDITION: 0,
    MERGE: 0,
    DELAY: 0,
    OUTPUT: 0,
  });

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [workflowName, setWorkflowName] = useState('New Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [generatedJson, setGeneratedJson] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showPromptPanel, setShowPromptPanel] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [showRunInputPanel, setShowRunInputPanel] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [promptError, setPromptError] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const { toast } = useToast();

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const updateNodeData = useCallback(
    (nodeId, changes) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...changes } } : node
        )
      );
    },
    [setNodes]
  );

  const updateNodeConfig = useCallback(
    (nodeId, changes) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, config: { ...node.data.config, ...changes } } }
            : node
        )
      );
    },
    [setNodes]
  );

  const removeEdge = useCallback(
    (edgeId) => {
      setEdges((current) => current.filter((edge) => edge.id !== edgeId));
    },
    [setEdges]
  );

  const removeNode = useCallback(
    (nodeId) => {
      setNodes((current) => current.filter((node) => node.id !== nodeId));
      setEdges((current) =>
        current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
    },
    [setNodes, setEdges]
  );

  const nodesWithHandlers = useMemo(() => {
    return nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onChange: updateNodeData,
        onConfigChange: updateNodeConfig,
        onDelete: removeNode,
      },
    }));
  }, [nodes, updateNodeConfig, updateNodeData, removeNode]);

  const flowSummary = useMemo(() => {
    if (nodes.length === 0) {
      return { isDag: true, steps: [] };
    }
    const { order, isDag } = getTopologicalOrder(nodes, edges);
    const steps = isDag
      ? order.map((nodeId, index) => {
          const node = nodeMap.get(nodeId);
          const data = node?.data;
          return {
            index: index + 1,
            id: nodeId,
            name: data?.name || `Node ${nodeId}`,
            type: data?.nodeType || 'UNKNOWN',
            summary: formatNodeSummary(data),
          };
        })
      : [];
    return { isDag, steps };
  }, [nodes, edges, nodeMap]);

  const derivedRunInput = useMemo(() => {
    const result = {};
    nodes.forEach((node) => {
      if (!node.data || node.data.nodeType !== 'INPUT') {
        return;
      }
      const key = (node.data.config?.key || '').trim();
      if (!key) {
        return;
      }
      if (node.data.config && 'value' in node.data.config) {
        result[key] = node.data.config.value;
      }
    });
    return result;
  }, [nodes]);

  useEffect(() => {
    if (!reactFlowInstance || nodes.length === 0) {
      return;
    }
    reactFlowInstance.fitView({ padding: 0.2, duration: 200 });
  }, [nodes.length, reactFlowInstance]);

  const runInputPreview = JSON.stringify(derivedRunInput, null, 2);

  const handleDragStart = (event, type) => {
    event.dataTransfer.setData('application/node-type', type);
    event.dataTransfer.setData('text/plain', type);
    event.dataTransfer.effectAllowed = 'move';
  };

  const addNode = useCallback(
    (nodeType, position) => {
      typeCounts.current[nodeType] = (typeCounts.current[nodeType] || 0) + 1;
      const id = String(nextNodeId.current);
      nextNodeId.current += 1;
      const name = `${nodeType} ${typeCounts.current[nodeType]}`;
      const config = getDefaultConfig(nodeType, typeCounts.current[nodeType]);
      const safePosition = {
        x: Number.isFinite(position?.x) ? position.x : 40,
        y: Number.isFinite(position?.y) ? position.y : 40,
      };
      const newNode = {
        id,
        type: 'workflow',
        position: safePosition,
        data: { nodeType, name, config },
      };
      setNodes((current) => current.concat(newNode));
    },
    [setNodes]
  );

  const handleDrop = useCallback(
    (event) => {
      event.preventDefault();
      const nodeType =
        event.dataTransfer.getData('application/node-type') ||
        event.dataTransfer.getData('text/plain');
      if (!nodeType || !reactFlowWrapper.current || !reactFlowInstance) {
        return;
      }
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const screenPosition = { x: event.clientX, y: event.clientY };
      const position = reactFlowInstance.screenToFlowPosition
        ? reactFlowInstance.screenToFlowPosition(screenPosition)
        : reactFlowInstance.project({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          });
      addNode(nodeType, position);
    },
    [addNode, reactFlowInstance]
  );

  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const createsCycle = useCallback(
    (source, target) => {
      const adjacency = {};
      nodes.forEach((node) => {
        adjacency[node.id] = [];
      });
      edges.forEach((edge) => {
        if (!adjacency[edge.source]) {
          adjacency[edge.source] = [];
        }
        adjacency[edge.source].push(edge.target);
      });
      if (!adjacency[source]) {
        adjacency[source] = [];
      }
      adjacency[source].push(target);

      const stack = [target];
      const visited = new Set();
      while (stack.length) {
        const current = stack.pop();
        if (current === source) {
          return true;
        }
        if (visited.has(current)) {
          continue;
        }
        visited.add(current);
        (adjacency[current] || []).forEach((next) => stack.push(next));
      }
      return false;
    },
    [edges, nodes]
  );

  const isValidConnection = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) {
        return false;
      }
      if (connection.source === connection.target) {
        return false;
      }
      return !createsCycle(connection.source, connection.target);
    },
    [createsCycle]
  );

  const handleConnect = useCallback(
    (connection) => {
      if (!isValidConnection(connection)) {
        setError('Connecting these nodes would create a cycle.');
        return;
      }
      setError('');
      setEdges((current) =>
        addEdge(
          {
            ...connection,
            type: 'deletable',
            data: { onDelete: removeEdge },
            markerEnd: DEFAULT_EDGE_OPTIONS.markerEnd,
          },
          current
        )
      );
    },
    [isValidConnection, removeEdge, setEdges]
  );

  const buildPayload = useCallback(() => {
    return {
      name: workflowName || 'Untitled Workflow',
      description: workflowDescription || null,
      nodes: nodes.map((node) => ({
        id: Number(node.id),
        type: node.data.nodeType,
        name: node.data.name,
        config: node.data.config || {},
      })),
      edges: edges.map((edge) => ({
        from_node_id: Number(edge.source),
        to_node_id: Number(edge.target),
        from_port: edge.sourceHandle || null,
        to_port: edge.targetHandle || null,
      })),
    };
  }, [edges, nodes, workflowDescription, workflowName]);

  const handleGenerate = () => {
    const payload = buildPayload();
    setGeneratedJson(JSON.stringify(payload, null, 2));
    setShowJsonPanel(true);
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
      toast({ title: 'Workflow saved', description: payload.name });
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
    const text = JSON.stringify(derivedRunInput, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Run input copied to clipboard.');
      toast({ title: 'Run input copied', description: 'Ready to paste into a run.' });
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
      toast({ title: 'Workflow JSON copied', description: payload.name || 'Untitled workflow' });
    } catch (err) {
      setMessage('JSON generated. Copy it manually.');
    }
  };

  const loadWorkflowPayload = (payload, options = {}) => {
    if (!payload || !payload.nodes || !payload.edges) {
      throw new Error('Invalid workflow JSON. Expected nodes and edges.');
    }
    const { ignorePositions = false } = options;

    const normalizedNodes = payload.nodes.map((node, index) => {
      const rawId = Number(node.id);
      const nodeId = Number.isFinite(rawId) ? rawId : index + 1;
      const useStoredPosition =
        !ignorePositions && typeof node.x === 'number' && typeof node.y === 'number';
      const position = useStoredPosition
        ? { x: node.x, y: node.y }
        : getGridPosition(index, payload.nodes.length);
      return {
        id: String(nodeId),
        type: 'workflow',
        position,
        data: {
          nodeType: node.type,
          name: node.name || `${node.type} ${index + 1}`,
          config: node.config || {},
        },
      };
    });

    const normalizedEdges = payload.edges.map((edge, index) => {
      const from = edge.from ?? edge.from_node_id;
      const to = edge.to ?? edge.to_node_id;
      return {
        id: edge.id ? String(edge.id) : `e-${from}-${to}-${index}`,
        source: String(from),
        target: String(to),
        sourceHandle: edge.fromPort || edge.from_port || null,
        targetHandle: edge.toPort || edge.to_port || null,
        type: 'deletable',
        data: { onDelete: removeEdge },
        markerEnd: DEFAULT_EDGE_OPTIONS.markerEnd,
      };
    });

    const maxNodeId = normalizedNodes.reduce(
      (max, node) => Math.max(max, Number(node.id)),
      0
    );
    const counts = normalizedNodes.reduce(
      (acc, node) => {
        acc[node.data.nodeType] = (acc[node.data.nodeType] || 0) + 1;
        return acc;
      },
      {
        INPUT: 0,
        TRANSFORM: 0,
        HTTP: 0,
        LLM: 0,
        CONDITION: 0,
        MERGE: 0,
        DELAY: 0,
        OUTPUT: 0,
      }
    );

    nextNodeId.current = maxNodeId + 1;
    typeCounts.current = counts;

    setNodes(normalizedNodes);
    setEdges(normalizedEdges);
    setWorkflowName(payload.name || 'Imported Workflow');
    setWorkflowDescription(payload.description || '');
    setMessage('Workflow loaded.');
    setError('');
  };

  const handleImport = () => {
    setImportError('');
    setMessage('');
    try {
      const parsed = JSON.parse(importJson);
      loadWorkflowPayload(parsed);
      setShowImportPanel(false);
    } catch (err) {
      setImportError('Invalid JSON. Please paste a full workflow payload.');
    }
  };

  const handleLoadSample = (sample) => {
    setImportJson('');
    setImportError('');
    loadWorkflowPayload(sample.payload);
    setShowHelp(false);
  };

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
      loadWorkflowPayload(payload, { ignorePositions: true });
      setGeneratedJson(JSON.stringify(payload, null, 2));
      setShowPromptPanel(false);
      setShowJsonPanel(true);
      setMessage('Workflow generated from prompt.');
      toast({ title: 'Workflow generated', description: payload.name || 'Draft loaded.' });
    } catch (err) {
      setPromptError(err.message || 'Unable to generate workflow.');
    } finally {
      setPromptLoading(false);
    }
  };

  const connectHint = 'Drag from a node handle to connect steps.';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Back" title="Back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="mt-3 text-2xl font-semibold">Workflow Builder</h2>
          <p className="text-sm text-slate-400">
            Drag nodes, connect handles, then save or export JSON.
          </p>
        </div>
        <Dialog open={showHelp} onOpenChange={setShowHelp}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Help
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Builder help</DialogTitle>
              <DialogDescription>
                Keep flows simple: drag nodes, wire handles, and generate JSON.
              </DialogDescription>
            </DialogHeader>
            <ol className="mt-4 list-decimal space-y-2 pl-4 text-sm text-slate-300">
              <li>Drag a node from the bar onto the canvas.</li>
              <li>Drag from an output handle to an input handle.</li>
              <li>Edit node fields directly inside each node card.</li>
              <li>Use {'{{variable}}'} placeholders in TRANSFORM/LLM.</li>
              <li>Set INPUT node keys to build run input JSON.</li>
              <li>Use the x on an edge to remove it.</li>
            </ol>
            <div className="mt-4 rounded-[4px] border border-slate-800 bg-slate-950/60 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Example
              </div>
              <pre className="mt-2 text-xs text-slate-300">
{`TRANSFORM template: Hello {{text}}!

Run input JSON:
{ "text": "world" }`}
              </pre>
            </div>
            <div className="mt-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                Sample workflows
              </div>
              <div className="mt-2 grid gap-2">
                {SAMPLE_WORKFLOWS.map((sample) => (
                  <div key={sample.id} className="rounded-[4px] border border-slate-800 p-3">
                    <div className="text-sm font-semibold">{sample.title}</div>
                    <div className="text-xs text-slate-500">{sample.description}</div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2"
                      onClick={() => handleLoadSample(sample)}
                    >
                      Load
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        <div className="flex flex-col gap-6">
          <Panel className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Node Types
                </h3>
                <p className="text-xs text-slate-500">{connectHint}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {NODE_TYPES.map((node) => (
                <div
                  key={node.type}
                  className="cursor-grab rounded-[4px] border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-slate-600"
                  draggable
                  onDragStart={(event) => handleDragStart(event, node.type)}
                >
                  {node.label}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-0 md:p-0">
            <div
              className="reactflow-wrapper"
              ref={reactFlowWrapper}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <ReactFlow
                nodes={nodesWithHandlers}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                isValidConnection={isValidConnection}
                defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
                connectionLineType={ConnectionLineType.SmoothStep}
                connectionLineStyle={CONNECTION_LINE_STYLE}
                zoomOnScroll={false}
                zoomOnPinch
                panOnScroll={false}
                panOnDrag={!isLocked}
                nodesDraggable={!isLocked}
                nodesConnectable={!isLocked}
                elementsSelectable={!isLocked}
                style={{ width: '100%', height: '100%' }}
                minZoom={0.5}
                maxZoom={1.6}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                onInit={setReactFlowInstance}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
                <Controls showFitView={false} />
                <FlowPanel position="top-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLocked((prev) => !prev)}
                  >
                    {isLocked ? 'Unlock canvas' : 'Lock canvas'}
                  </Button>
                </FlowPanel>
              </ReactFlow>
            </div>
          </Panel>

          <Panel className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Workflow Setup
              </h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={workflowName}
                onChange={(event) => setWorkflowName(event.target.value)}
                placeholder="Workflow name"
              />
              <Textarea
                rows={2}
                value={workflowDescription}
                onChange={(event) => setWorkflowDescription(event.target.value)}
                placeholder="Short description"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save workflow'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPromptError('');
                  setShowPromptPanel((prev) => !prev);
                }}
              >
                Build from prompt
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowImportPanel((prev) => !prev)}
              >
                Import JSON
              </Button>
              <Button variant="ghost" size="sm" onClick={handleGenerate}>
                Generate JSON
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRunInputPanel((prev) => !prev)}
              >
                Run input
              </Button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-emerald-400">{message}</p>}

            {showPromptPanel && (
              <div className="rounded-[4px] border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">Describe your goal</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowPromptPanel(false)}>
                    Close
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  value={promptDraft}
                  onChange={(event) => setPromptDraft(event.target.value)}
                  placeholder="Build a pipeline for a chatbot that responds with context."
                  className="mt-3"
                />
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleGenerateFromPrompt}
                    disabled={promptLoading}
                  >
                    {promptLoading ? 'Generating...' : 'Generate workflow'}
                  </Button>
                  {promptError && <p className="text-sm text-red-400">{promptError}</p>}
                </div>
              </div>
            )}

            {showImportPanel && (
              <div className="rounded-[4px] border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">Import JSON</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowImportPanel(false)}>
                    Close
                  </Button>
                </div>
                <Textarea
                  rows={6}
                  value={importJson}
                  onChange={(event) => setImportJson(event.target.value)}
                  placeholder="Paste workflow JSON here"
                  className="mt-3 font-mono text-xs"
                />
                <div className="mt-3 flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={handleImport}>
                    Import
                  </Button>
                  {importError && <p className="text-sm text-red-400">{importError}</p>}
                </div>
              </div>
            )}

            {showJsonPanel && (
              <div className="rounded-[4px] border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">Workflow JSON</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowJsonPanel(false)}>
                    Close
                  </Button>
                </div>
                <Textarea
                  rows={8}
                  value={generatedJson}
                  readOnly
                  className="mt-3 font-mono text-xs"
                />
                <div className="mt-3">
                  <Button variant="secondary" size="sm" onClick={handleCopyJson}>
                    Copy JSON
                  </Button>
                </div>
              </div>
            )}

            {showRunInputPanel && (
              <div className="rounded-[4px] border border-slate-800 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-200">Run Input JSON</h4>
                  <Button variant="ghost" size="sm" onClick={() => setShowRunInputPanel(false)}>
                    Close
                  </Button>
                </div>
                <Textarea
                  rows={6}
                  value={runInputPreview}
                  readOnly
                  className="mt-3 font-mono text-xs"
                />
                <div className="mt-3">
                  <Button variant="secondary" size="sm" onClick={handleCopyRunInput}>
                    Copy Run Input
                  </Button>
                </div>
              </div>
            )}
          </Panel>
          <Panel className="flex flex-col gap-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Flow summary
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Click handles to connect. Use the x to delete an edge.
              </p>
            </div>
            {nodes.length === 0 ? (
              <p className="text-sm text-slate-500">Drop nodes onto the canvas to begin.</p>
            ) : !flowSummary.isDag ? (
              <p className="text-sm text-red-400">Cycle detected. Remove a link to continue.</p>
            ) : (
              <ol className="grid gap-3 md:grid-cols-2">
                {flowSummary.steps.map((step) => (
                  <li key={step.id} className="rounded-[4px] border border-slate-800 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      {step.type}
                    </div>
                    <div className="text-sm font-semibold">{step.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{step.summary}</div>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default BuilderPage;
