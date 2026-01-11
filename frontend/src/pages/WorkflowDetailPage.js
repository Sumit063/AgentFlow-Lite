import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getWorkflow, runWorkflow, updateWorkflow, validateWorkflow } from '../api';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Panel } from '../components/ui/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../components/ui/use-toast';

const WorkflowDetailPage = ({ token, workflowId, onBack, onRun }) => {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nodesJson, setNodesJson] = useState('');
  const [edgesJson, setEdgesJson] = useState('');
  const [runInput, setRunInput] = useState('{}');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [working, setWorking] = useState(false);
  const [uploadKey, setUploadKey] = useState('input_file');
  const [uploadType, setUploadType] = useState('file');
  const [uploadError, setUploadError] = useState('');
  const { toast } = useToast();

  const parsedNodes = useMemo(() => {
    try {
      return JSON.parse(nodesJson);
    } catch (err) {
      return null;
    }
  }, [nodesJson]);

  const parsedEdges = useMemo(() => {
    try {
      return JSON.parse(edgesJson);
    } catch (err) {
      return null;
    }
  }, [edgesJson]);

  const topTalkers = useMemo(() => {
    if (!Array.isArray(parsedNodes) || !Array.isArray(parsedEdges)) {
      return [];
    }
    const outgoing = parsedEdges.reduce((acc, edge) => {
      const key = edge.from_node_id ?? edge.from;
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return parsedNodes
      .map((node) => ({
        id: node.id,
        name: node.name,
        count: outgoing[node.id] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [parsedEdges, parsedNodes]);

  const loadWorkflow = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getWorkflow(workflowId, token);
      setWorkflow(data);
      setNodesJson(JSON.stringify(data.nodes, null, 2));
      setEdgesJson(JSON.stringify(data.edges, null, 2));
    } catch (err) {
      setError(err.message || 'Unable to load workflow');
    } finally {
      setLoading(false);
    }
  }, [token, workflowId]);

  useEffect(() => {
    loadWorkflow();
  }, [loadWorkflow]);

  const handleSave = async () => {
    setWorking(true);
    setActionMessage('');
    setActionError('');
    try {
      const nodes = JSON.parse(nodesJson);
      const edges = JSON.parse(edgesJson);
      const payload = {
        name: workflow.name,
        description: workflow.description,
        nodes,
        edges,
      };
      const updated = await updateWorkflow(workflowId, payload, token);
      setWorkflow(updated);
      setActionMessage('Workflow saved');
      toast({ title: 'Workflow updated', description: workflow.name });
    } catch (err) {
      setActionError(err.message || 'Unable to save workflow');
    } finally {
      setWorking(false);
    }
  };

  const handleValidate = async () => {
    setWorking(true);
    setActionMessage('');
    setActionError('');
    try {
      const result = await validateWorkflow(workflowId, token);
      if (result.valid) {
        setActionMessage('Validation passed');
        toast({ title: 'Validation passed', description: 'DAG has no cycles.' });
      } else {
        setActionError(`Validation failed: ${result.errors.join(' | ')}`);
      }
    } catch (err) {
      setActionError(err.message || 'Unable to validate workflow');
    } finally {
      setWorking(false);
    }
  };

  const handleRun = async () => {
    setWorking(true);
    setActionMessage('');
    setActionError('');
    try {
      const runPayload = { run_input: JSON.parse(runInput) };
      const run = await runWorkflow(workflowId, runPayload, token);
      toast({ title: 'Run started', description: `Run #${run.id}` });
      onRun(run.id);
    } catch (err) {
      setActionError(err.message || 'Unable to run workflow');
    } finally {
      setWorking(false);
    }
  };

  const handleRunInputUpload = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }
    if (!uploadKey.trim()) {
      setUploadError('Provide a key for the uploaded input.');
      return;
    }
    let parsed = {};
    try {
      parsed = runInput ? JSON.parse(runInput) : {};
    } catch (err) {
      setUploadError('Run input must be valid JSON before uploading.');
      return;
    }
    setUploadError('');
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (uploadType === 'image') {
        parsed[uploadKey.trim()] = {
          data_url: result,
          mime_type: file.type || 'image/png',
          filename: file.name,
        };
      } else {
        parsed[uploadKey.trim()] = result;
      }
      setRunInput(JSON.stringify(parsed, null, 2));
      event.target.value = '';
    };
    if (uploadType === 'image') {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <Panel className="animate-pulse">
          <div className="h-4 w-48 rounded bg-slate-800" />
          <div className="mt-4 h-3 w-64 rounded bg-slate-800" />
          <div className="mt-4 h-32 rounded bg-slate-900" />
        </Panel>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
        <Panel>
          <p className="text-sm text-red-400">{error}</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to list
          </Button>
          <h2 className="mt-3 text-2xl font-semibold">{workflow.name}</h2>
          <p className="text-sm text-slate-400">{workflow.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadWorkflow}>
            Reload
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                Explain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Workflow overview</DialogTitle>
                <DialogDescription>
                  JSON in the editor is the source of truth. Validate before running to
                  confirm the DAG has no cycles.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid gap-2 text-sm text-slate-300">
                <div>Nodes: {Array.isArray(parsedNodes) ? parsedNodes.length : '—'}</div>
                <div>Edges: {Array.isArray(parsedEdges) ? parsedEdges.length : '—'}</div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Nodes</div>
          <div className="mt-2 text-xl font-semibold">
            {Array.isArray(parsedNodes) ? parsedNodes.length : '—'}
          </div>
        </Panel>
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Edges</div>
          <div className="mt-2 text-xl font-semibold">
            {Array.isArray(parsedEdges) ? parsedEdges.length : '—'}
          </div>
        </Panel>
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Top talkers</div>
          <div className="mt-2 space-y-1 text-sm text-slate-300">
            {topTalkers.length === 0 ? (
              <span className="text-slate-500">—</span>
            ) : (
              topTalkers.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.name || `Node ${item.id}`}</span>
                  <span className="text-slate-500">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Workflow JSON
          </h3>
          <Tabs defaultValue="nodes">
            <TabsList>
              <TabsTrigger value="nodes">Nodes</TabsTrigger>
              <TabsTrigger value="edges">Edges</TabsTrigger>
            </TabsList>
            <TabsContent value="nodes">
              <Textarea
                rows={12}
                value={nodesJson}
                onChange={(event) => setNodesJson(event.target.value)}
                className="font-mono text-xs"
              />
            </TabsContent>
            <TabsContent value="edges">
              <Textarea
                rows={8}
                value={edgesJson}
                onChange={(event) => setEdgesJson(event.target.value)}
                className="font-mono text-xs"
              />
            </TabsContent>
          </Tabs>
        </Panel>

        <Panel className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Actions
          </h3>
          <div className="flex flex-col gap-2">
            <Button onClick={handleSave} disabled={working}>
              Save changes
            </Button>
            <Button variant="secondary" onClick={handleValidate} disabled={working}>
              Validate DAG
            </Button>
          </div>
          <div className="border-t border-slate-800 pt-3 text-xs uppercase tracking-[0.2em] text-slate-500">
            Run input
          </div>
          <Textarea
            rows={6}
            value={runInput}
            onChange={(event) => setRunInput(event.target.value)}
            className="font-mono text-xs"
          />
          <div className="grid gap-2">
            <Input
              value={uploadKey}
              onChange={(event) => setUploadKey(event.target.value)}
              placeholder="input_file"
            />
            <Select value={uploadType} onValueChange={(value) => setUploadType(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Upload type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="file">File</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="file"
              onChange={handleRunInputUpload}
              accept={uploadType === 'image' ? 'image/*' : '.txt,.md,.csv,.json'}
            />
            {uploadError && <p className="text-sm text-red-400">{uploadError}</p>}
          </div>
          <Button onClick={handleRun} disabled={working}>
            Run workflow
          </Button>
          {actionMessage && <p className="text-sm text-emerald-400">{actionMessage}</p>}
          {actionError && <p className="text-sm text-red-400">{actionError}</p>}
          <p className="text-xs text-slate-500">Run results appear in the run details screen.</p>
        </Panel>
      </div>
    </div>
  );
};

export default WorkflowDetailPage;
