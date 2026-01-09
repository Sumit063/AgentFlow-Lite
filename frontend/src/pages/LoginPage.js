import React, { useState } from 'react';

import { loginDemo } from '../api';

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
    <section className="panel panel-hero">
      <div className="panel-hero-content">
        <h1>AgentFlow Lite</h1>
        <p className="lede">
          Run lightweight AI workflows with transparent, per-step logs.
        </p>
        <button className="btn btn-primary" type="button" onClick={handleLogin} disabled={loading}>
          {loading ? 'Signing in...' : 'Demo Sign In'}
        </button>
        {error && <p className="error">{error}</p>}
      </div>
      <div className="panel-hero-card">
        <div className="card-title">What you can do</div>
        <ul className="checklist">
          <li>Paste a JSON DAG</li>
          <li>Validate topology instantly</li>
          <li>Run steps with real logs</li>
        </ul>
      </div>
    </section>
  );
};

export default LoginPage;
