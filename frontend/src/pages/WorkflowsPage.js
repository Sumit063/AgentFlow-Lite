import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

import { createWorkflow, deleteWorkflow, listWorkflows } from '../api';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Panel } from '../components/ui/panel';
import { Table } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { useToast } from '../components/ui/use-toast';

const defaultNodes = [
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
];

const defaultEdges = [
  { from_node_id: 1, to_node_id: 2 },
  { from_node_id: 2, to_node_id: 3 },
];

const WorkflowsPage = ({ token, onSelectWorkflow, search, setSearch }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodesJson, setNodesJson] = useState(
    JSON.stringify(defaultNodes, null, 2)
  );
  const [edgesJson, setEdgesJson] = useState(
    JSON.stringify(defaultEdges, null, 2)
  );
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { toast } = useToast();

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listWorkflows(token);
      setWorkflows(data);
    } catch (err) {
      setError(err.message || 'Unable to load workflows');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadWorkflows();
  }, [loadWorkflows]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreateError('');
    setCreating(true);

    try {
      const nodes = JSON.parse(nodesJson);
      const edges = JSON.parse(edgesJson);
      const payload = {
        name: name || 'Untitled Workflow',
        description: description || null,
        nodes,
        edges,
      };
      const created = await createWorkflow(payload, token);
      setName('');
      setDescription('');
      setNodesJson(JSON.stringify(defaultNodes, null, 2));
      setEdgesJson(JSON.stringify(defaultEdges, null, 2));
      toast({
        title: 'Workflow created',
        description: `Saved "${payload.name}"`,
      });
      await loadWorkflows();
      onSelectWorkflow(created.id);
    } catch (err) {
      setCreateError(err.message || 'Unable to create workflow');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (workflowId) => {
    setCreateError('');
    try {
      await deleteWorkflow(workflowId, token);
      toast({ title: 'Workflow deleted', description: `ID ${workflowId}` });
      await loadWorkflows();
    } catch (err) {
      setCreateError(err.message || 'Unable to delete workflow');
    } finally {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteClick = (workflow) => {
    setDeleteTarget(workflow);
    setDeleteOpen(true);
  };

  const filteredWorkflows = useMemo(() => {
    if (!search) {
      return workflows;
    }
    const term = search.toLowerCase();
    return workflows.filter((workflow) => {
      return (
        workflow.name.toLowerCase().includes(term) ||
        (workflow.description || '').toLowerCase().includes(term)
      );
    });
  }, [search, workflows]);

  const handleFile = (file) => {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed.nodes && parsed.edges) {
          setNodesJson(JSON.stringify(parsed.nodes, null, 2));
          setEdgesJson(JSON.stringify(parsed.edges, null, 2));
          if (parsed.name) setName(parsed.name);
          if (parsed.description) setDescription(parsed.description);
          setUploadError('');
          toast({ title: 'Workflow loaded', description: 'JSON imported into the editor.' });
          return;
        }
        if (Array.isArray(parsed)) {
          setNodesJson(JSON.stringify(parsed, null, 2));
          setUploadError('');
          return;
        }
        setUploadError('Upload must be a workflow JSON with nodes and edges.');
      } catch (err) {
        setUploadError('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files && event.dataTransfer.files[0];
    handleFile(file);
  };

  const ListPanel = (
    <Panel className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Workflows</h2>
          <p className="text-sm text-slate-400">
            Search and open saved workflow graphs.
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={loadWorkflows}
          aria-label="Refresh workflows"
          title="Refresh workflows"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <Input
        placeholder="Filter by name or description"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 w-2/3 rounded bg-slate-800" />
          <div className="h-3 w-1/2 rounded bg-slate-800" />
          <div className="h-24 rounded bg-slate-900" />
        </div>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && filteredWorkflows.length === 0 && (
        <p className="text-sm text-slate-500">No workflows match your search.</p>
      )}
      {filteredWorkflows.length > 0 && (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filteredWorkflows.map((workflow) => (
              <tr
                key={workflow.id}
                className="cursor-pointer"
                onClick={() => onSelectWorkflow(workflow.id)}
              >
                <td className="font-semibold text-slate-100">{workflow.name}</td>
                <td className="text-slate-400">{workflow.description || '—'}</td>
                <td className="text-slate-500">
                  {workflow.created_at ? new Date(workflow.created_at).toLocaleString() : '—'}
                </td>
                <td className="text-right">
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteClick(workflow);
                    }}
                    aria-label="Delete workflow"
                    title="Delete workflow"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workflow</DialogTitle>
            <DialogDescription>
              This permanently removes the workflow and its nodes/edges. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-[4px] border border-slate-800 bg-slate-950/60 p-3 text-sm">
            {deleteTarget ? (
              <>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Target</div>
                <div className="mt-2 font-semibold text-slate-100">{deleteTarget.name}</div>
                <div className="text-xs text-slate-500">
                  {deleteTarget.description || 'No description'}
                </div>
              </>
            ) : (
              <div className="text-slate-500">No workflow selected.</div>
            )}
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => deleteTarget && handleDelete(deleteTarget.id)}
              aria-label="Confirm delete workflow"
              title="Confirm delete workflow"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Panel>
  );

  const CreatePanel = (
    <Panel className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Create workflow</h2>
        <p className="text-sm text-slate-400">
          Paste JSON or drop a file to start a new runbook.
        </p>
      </div>
      <div
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[4px] border border-dashed border-slate-700 bg-slate-950/60 px-4 py-6 text-xs text-slate-400"
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
      >
        <span className="uppercase tracking-[0.2em]">Drop workflow JSON here</span>
        <label className="cursor-pointer text-slate-300 underline">
          Upload file
          <input
            type="file"
            className="hidden"
            accept=".json"
            onChange={(event) => handleFile(event.target.files[0])}
          />
        </label>
        {uploadError && <span className="text-red-400">{uploadError}</span>}
      </div>
      <form className="flex flex-col gap-3" onSubmit={handleCreate}>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Workflow name"
        />
        <Input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Short description"
        />
        <div className="grid gap-3">
          <Textarea
            rows={8}
            value={nodesJson}
            onChange={(event) => setNodesJson(event.target.value)}
            placeholder="Nodes JSON"
            className="font-mono text-xs"
          />
          <Textarea
            rows={6}
            value={edgesJson}
            onChange={(event) => setEdgesJson(event.target.value)}
            placeholder="Edges JSON"
            className="font-mono text-xs"
          />
        </div>
        {createError && <p className="text-sm text-red-400">{createError}</p>}
        <Button type="submit" disabled={creating}>
          {creating ? 'Creating...' : 'Create workflow'}
        </Button>
      </form>
    </Panel>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">AgentFlow Workbench</h1>
          <p className="text-sm text-slate-400">
            Build, validate, and execute workflow graphs with full run logs.
          </p>
        </div>
      </div>

      <Tabs defaultValue="saved" className="lg:hidden">
        <TabsList className="w-full justify-between">
          <TabsTrigger value="saved" className="flex-1">
            Saved
          </TabsTrigger>
          <TabsTrigger value="create" className="flex-1">
            Create
          </TabsTrigger>
        </TabsList>
        <TabsContent value="saved">{ListPanel}</TabsContent>
        <TabsContent value="create">{CreatePanel}</TabsContent>
      </Tabs>

      <div className="hidden gap-6 lg:grid lg:grid-cols-[1.6fr_1fr]">
        {ListPanel}
        {CreatePanel}
      </div>
    </div>
  );
};

export default WorkflowsPage;
