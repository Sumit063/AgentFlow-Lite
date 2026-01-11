import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getRun, getRunLogs } from '../api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Panel } from '../components/ui/panel';
import { Table } from '../components/ui/table';

const statusVariant = (status) => {
  if (!status) return 'default';
  if (status === 'SUCCESS') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'RUNNING') return 'warning';
  return 'default';
};

const formatLogMessage = (message) => {
  if (!message) return '';
  try {
    const data = JSON.parse(message);
    if (data && typeof data === 'object') {
      if (typeof data.text === 'string') {
        return data.provider ? `${data.text} (provider: ${data.provider})` : data.text;
      }
      const values = Object.values(data);
      if (values.length === 1 && values[0] && typeof values[0] === 'object') {
        const nested = values[0];
        if (typeof nested.text === 'string') {
          return nested.provider ? `${nested.text} (provider: ${nested.provider})` : nested.text;
        }
      }
    }
  } catch (err) {
    // Ignore JSON parse errors, fall back to raw message.
  }
  return message;
};

const RunDetailPage = ({ token, runId, onBack }) => {
  const [run, setRun] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const failedLogs = useMemo(
    () => logs.filter((log) => log.status && log.status.toUpperCase() === 'FAILED'),
    [logs]
  );

  const loadRun = useCallback(async () => {
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
  }, [runId, token]);

  useEffect(() => {
    loadRun();
  }, [loadRun]);

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
            Back to workflow
          </Button>
          <h2 className="mt-3 text-2xl font-semibold">Run #{run.id}</h2>
          <p className="text-sm text-slate-400">Workflow {run.workflow_id}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadRun}>
            Refresh
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" size="sm">
                Explain
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Run summary</DialogTitle>
                <DialogDescription>
                  This run executed each node in topological order. Failures stop the run and
                  surface the error in the logs.
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 grid gap-2 text-sm text-slate-300">
                <div>Status: {run.status}</div>
                <div>Total steps: {run.total_steps}</div>
                <div>Failures: {run.failed_steps}</div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</div>
          <div className="mt-2">
            <Badge variant={statusVariant(run.status)}>{run.status}</Badge>
          </div>
        </Panel>
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Total steps</div>
          <div className="mt-2 text-xl font-semibold">{run.total_steps}</div>
        </Panel>
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Success</div>
          <div className="mt-2 text-xl font-semibold">{run.success_steps}</div>
        </Panel>
        <Panel>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Failed</div>
          <div className="mt-2 text-xl font-semibold">{run.failed_steps}</div>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2.2fr_1fr]">
        <Panel className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Step timeline
          </h3>
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">No logs yet.</p>
          ) : (
            <Table>
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
                    <td className="font-semibold text-slate-100">
                      {log.node_name || log.node_id || 'Workflow'}
                    </td>
                    <td>
                      <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                    </td>
                    <td className="text-slate-300 font-mono text-xs">
                      {formatLogMessage(log.message)}
                    </td>
                    <td className="text-slate-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
            Issues
          </h3>
          {failedLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No failures detected.</p>
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {failedLogs.map((log) => (
                <div key={log.id} className="rounded-[4px] border border-red-900/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-red-300">
                      {log.node_name || `Node ${log.node_id}`}
                    </div>
                    <Badge variant="high">High</Badge>
                  </div>
                  <p className="mt-2 text-red-200">{log.message}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};

export default RunDetailPage;
