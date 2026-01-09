import React, { useEffect, useState } from 'react';

import { createWorkflow, listWorkflows } from '../api';

const defaultNodes = [
  { id: 1, type: 'INPUT', name: 'User Input', config: {} },
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

const WorkflowsPage = ({ token, onSelectWorkflow, onLogout }) => {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nodesJson, setNodesJson] = useState(
    JSON.stringify(defaultNodes, null, 2)
  );
  const [edgesJson, setEdgesJson] = useState(
    JSON.stringify(defaultEdges, null, 2)
  );
  const [creating, setCreating] = useState(false);

  const loadWorkflows = async () => {
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
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

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
      await loadWorkflows();
      onSelectWorkflow(created.id);
    } catch (err) {
      setCreateError(err.message || 'Unable to create workflow');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Your Workflows</h2>
          <p className="muted">Create or open a workflow to validate and run it.</p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" type="button" onClick={loadWorkflows}>
            Refresh
          </button>
          <button className="btn btn-ghost" type="button" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>

      <div className="grid-two">
        <section className="panel">
          <h3>Saved workflows</h3>
          {loading && <p className="muted">Loading workflows...</p>}
          {error && <p className="error">{error}</p>}
          {!loading && workflows.length === 0 && (
            <p className="muted">No workflows yet. Create one to get started.</p>
          )}
          <ul className="workflow-list">
            {workflows.map((workflow) => (
              <li key={workflow.id}>
                <button
                  type="button"
                  className="link-card"
                  onClick={() => onSelectWorkflow(workflow.id)}
                >
                  <div className="link-card-title">{workflow.name}</div>
                  <div className="link-card-meta">
                    {workflow.description || 'No description'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h3>Create workflow</h3>
          <form className="form" onSubmit={handleCreate}>
            <label className="field">
              <span>Name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="AgentFlow demo"
              />
            </label>
            <label className="field">
              <span>Description</span>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Greeting workflow"
              />
            </label>
            <label className="field">
              <span>Nodes JSON</span>
              <textarea
                rows={10}
                value={nodesJson}
                onChange={(event) => setNodesJson(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Edges JSON</span>
              <textarea
                rows={6}
                value={edgesJson}
                onChange={(event) => setEdgesJson(event.target.value)}
              />
            </label>
            {createError && <p className="error">{createError}</p>}
            <button className="btn btn-primary" type="submit" disabled={creating}>
              {creating ? 'Creating...' : 'Create workflow'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default WorkflowsPage;
