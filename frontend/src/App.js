import React, { useState } from 'react';

import BuilderPage from './pages/BuilderPage';
import LoginPage from './pages/LoginPage';
import RunDetailPage from './pages/RunDetailPage';
import WorkflowDetailPage from './pages/WorkflowDetailPage';
import WorkflowsPage from './pages/WorkflowsPage';

const TOKEN_KEY = 'agentflow_token';

const getInitialRoute = (token) => {
  if (token) {
    return { page: 'workflows' };
  }
  return { page: 'login' };
};

const App = () => {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '');
  const [route, setRoute] = useState(getInitialRoute(token));

  const handleLogin = (newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setRoute({ page: 'workflows' });
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setRoute({ page: 'login' });
  };

  const handleSelectWorkflow = (workflowId) => {
    setRoute({ page: 'workflow', workflowId });
  };

  const handleRun = (runId) => {
    setRoute((prev) => ({ page: 'run', runId, workflowId: prev.workflowId }));
  };

  let content = null;

  if (!token || route.page === 'login') {
    content = <LoginPage onLogin={handleLogin} />;
  } else if (route.page === 'builder') {
    content = (
      <BuilderPage
        token={token}
        onBack={() => setRoute({ page: 'workflows' })}
        onOpenWorkflow={handleSelectWorkflow}
      />
    );
  } else if (route.page === 'workflow') {
    content = (
      <WorkflowDetailPage
        token={token}
        workflowId={route.workflowId}
        onBack={() => setRoute({ page: 'workflows' })}
        onRun={handleRun}
      />
    );
  } else if (route.page === 'run') {
    content = (
      <RunDetailPage
        token={token}
        runId={route.runId}
        onBack={() => setRoute({ page: 'workflow', workflowId: route.workflowId })}
      />
    );
  } else {
    content = (
      <WorkflowsPage
        token={token}
        onSelectWorkflow={handleSelectWorkflow}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">AF</span>
          <span>AgentFlow Lite</span>
        </div>
        {token && route.page !== 'login' && (
          <nav className="nav">
            <button className="link" type="button" onClick={() => setRoute({ page: 'workflows' })}>
              Workflows
            </button>
            <button className="link" type="button" onClick={() => setRoute({ page: 'builder' })}>
              Builder
            </button>
          </nav>
        )}
      </header>
      <main className="app-main">{content}</main>
    </div>
  );
};

export default App;
