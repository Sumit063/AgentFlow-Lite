import React, { useState } from 'react';

import { loginDemo } from '../api';
import { Button } from '../components/ui/button';
import { Panel } from '../components/ui/panel';

const LoginPage = ({ onLogin }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await loginDemo();
      onLogin(data.token);
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel className="w-full max-w-3xl">
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <div className="text-xs uppercase tracking-[0.3em] text-slate-500">AgentFlow Lite</div>
          <h1 className="text-3xl font-semibold leading-tight text-slate-100">
            Minimal AI workflow runner for interview demos.
          </h1>
          <p className="text-sm text-slate-400">
            Build, validate, and execute DAG workflows with transparent step logs.
          </p>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing in...' : 'Demo sign in'}
            </Button>
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </div>
        <div className="rounded-[4px] border border-slate-800 bg-slate-950/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Quick Wins
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li>Define JSON DAGs with nodes and edges.</li>
            <li>Validate topology before running.</li>
            <li>Review per-step outputs and logs.</li>
          </ul>
        </div>
      </div>
    </Panel>
  );
};

export default LoginPage;
