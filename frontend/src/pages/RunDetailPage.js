import React, { useEffect, useState } from 'react';

import { getRun, getRunLogs } from '../api';

const statusClass = (status) => {
  if (!status) return '';
  return `status-${status.toLowerCase()}`;
};

const RunDetailPage = ({ token, runId, onBack }) => {
  const [run, setRun] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRun = async () => {
    setLoading(true);
    setError('');
    try {
      const [runData, logData] = await Promise.all([
        getRun(runId, token),
        getRunLogs(runId, token),
      ]);
      setRun(runData);
      setLogs(logData);
    } catch (err) {
      setError(err.message || 'Unable to load run');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRun();
  }, [runId]);

  if (loading) {
    return (
      <div className="page">
        <button className="btn btn-ghost" type="button" onClick={onBack}>
          Back
        </button>
        <p className="muted">Loading run details...</p>
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
            Back to workflow
          </button>
          <h2>Run #{run.id}</h2>
          <p className="muted">Workflow {run.workflow_id}</p>
        </div>
        <div className="actions">
          <button className="btn btn-secondary" type="button" onClick={loadRun}>
            Refresh
          </button>
        </div>
      </div>

      <div className="panel grid-summary">
        <div>
          <div className="label">Status</div>
          <div className={`status-pill ${statusClass(run.status)}`}>{run.status}</div>
        </div>
        <div>
          <div className="label">Total steps</div>
          <div className="value">{run.total_steps}</div>
        </div>
        <div>
          <div className="label">Success</div>
          <div className="value">{run.success_steps}</div>
        </div>
        <div>
          <div className="label">Failed</div>
          <div className="value">{run.failed_steps}</div>
        </div>
      </div>

      <section className="panel">
        <h3>Step logs</h3>
        {logs.length === 0 ? (
          <p className="muted">No logs yet.</p>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Node</th>
                <th>Status</th>
                <th>Message</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{log.node_name || log.node_id || 'Workflow'}</td>
                  <td>
                    <span className={`status-pill ${statusClass(log.status)}`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="log-message">{log.message}</td>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default RunDetailPage;
