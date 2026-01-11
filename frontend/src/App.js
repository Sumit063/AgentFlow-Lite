import React, { useEffect, useMemo, useState } from 'react';
import { GitBranch, LayoutGrid, LogOut, Menu, Moon, Sun } from 'lucide-react';

import { Input } from './components/ui/input';
import { Button } from './components/ui/button';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from './components/ui/tooltip';
import { ToastContextProvider } from './components/ui/use-toast';
import { Toaster } from './components/ui/toaster';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogin = (newToken) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setRoute({ page: 'workflows' });
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken('');
    setSearch('');
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
        search={search}
        setSearch={setSearch}
      />
    );
  }

  const navItems = useMemo(
    () => [
      { id: 'workflows', label: 'Workflows', icon: GitBranch },
      { id: 'builder', label: 'Builder', icon: LayoutGrid },
    ],
    []
  );

  return (
    <ToastContextProvider>
      <TooltipProvider>
        <div className="min-h-screen bg-neutral-950 text-neutral-100">
          {!token || route.page === 'login' ? (
            <div className="flex min-h-screen items-center justify-center px-4 py-10">
              {content}
            </div>
          ) : (
            <div className="flex min-h-screen">
              <aside
                className={`fixed inset-y-0 left-0 z-40 flex w-52 flex-col border-r border-neutral-800 bg-neutral-950/95 px-4 py-6 transition-transform duration-200 md:static md:translate-x-0 ${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
              >
                <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                  <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                    <span className="flex h-8 w-8 items-center justify-center border border-slate-700 text-xs">
                      AF
                    </span>
                    AgentFlow
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                </div>
                <nav className="mt-6 flex flex-col gap-2">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = route.page === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setRoute({ page: item.id });
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-3 rounded-[4px] border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          isActive
                            ? 'border-slate-600 bg-slate-900 text-white'
                            : 'border-transparent text-slate-400 hover:border-slate-800 hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
                <div className="mt-auto flex flex-col gap-3 border-t border-neutral-800 pt-4 text-xs text-slate-500">
                  <div>Demo mode</div>
                  <button
                    type="button"
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400 hover:text-white"
                    onClick={handleLogout}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </aside>
              {sidebarOpen && (
                <div
                  className="fixed inset-0 z-30 bg-black/60 md:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
              )}
              <div className="flex flex-1 flex-col">
                <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 bg-neutral-950/95 px-4 py-3 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setSidebarOpen(true)}
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                    <div className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      Command
                    </div>
                  </div>
                  <div className="flex w-full items-center gap-2 md:w-auto md:min-w-[320px]">
                    <Input
                      placeholder="Search workflows"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                        >
                          {theme === 'dark' ? (
                            <Sun className="h-4 w-4" />
                          ) : (
                            <Moon className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Toggle theme</TooltipContent>
                    </Tooltip>
                  </div>
                </header>
                <main className="flex-1 px-4 py-6 md:px-8">{content}</main>
              </div>
            </div>
          )}
          <Toaster />
        </div>
      </TooltipProvider>
    </ToastContextProvider>
  );
};

export default App;
