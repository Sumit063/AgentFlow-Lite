import React, { useEffect, useState } from 'react';

import { getWorkflow, runWorkflow, updateWorkflow, validateWorkflow } from '../api';

const WorkflowDetailPage = ({ token, workflowId, onBack, onRun }) => {
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nodesJson, setNodesJson] = useState('');
  const [edgesJson, setEdgesJson] = useState('');
  const [runInput, setRunInput] = useState('{"text": "world"}');
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [working, setWorking] = useState(false);

  const loadWorkflow = async () => {
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
  };

  useEffect(() => {
    loadWorkflow();
  }, [workflowId]);

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
      onRun(run.id);
    } catch (err) {
      setActionError(err.message || 'Unable to run workflow');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <button className="btn btn-ghost" type="button" onClick={onBack}>
          Back
        </button>
        <p className="muted">Loading workflow...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <button className="btn btn-ghost" type="button" onClick={onBack}>
          Back
        </button>
        <p className="error">{error}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" type="button" onClick={onBack}>
            Back to list
          </button>
          <h2>{workflow.name}</h2>
          <p className="muted">{workflow.description || 'No description'}</p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" type="button" onClick={loadWorkflow}>
            Reload
          </button>
        </div>
      </div>

      <div className="grid-two">
        <section className="panel">
          <h3>Workflow JSON</h3>
          <label className="field">
            <span>Nodes</span>
            <textarea
              rows={12}
              value={nodesJson}
              onChange={(event) => setNodesJson(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Edges</span>
            <textarea
              rows={8}
              value={edgesJson}
              onChange={(event) => setEdgesJson(event.target.value)}
            />
          </label>
        </section>

        <section className="panel">
          <h3>Actions</h3>
          <div className="button-stack">
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={working}>
              Save changes
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleValidate} disabled={working}>
              Validate DAG
            </button>
          </div>
          <label className="field">
            <span>Run input JSON</span>
            <textarea
              rows={6}
              value={runInput}
              onChange={(event) => setRunInput(event.target.value)}
            />
          </label>
          <button className="btn btn-primary" type="button" onClick={handleRun} disabled={working}>
            Run workflow
          </button>
          {actionMessage && <p className="success">{actionMessage}</p>}
          {actionError && <p className="error">{actionError}</p>}
          <div className="helper">
            <p className="muted">Run results appear in the run details screen.</p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default WorkflowDetailPage;
