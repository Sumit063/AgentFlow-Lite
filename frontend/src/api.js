const API_BASE = process.env.REACT_APP_API_URL || '';

const buildUrl = (path) => (API_BASE ? `${API_BASE}${path}` : path);

const parseError = async (response) => {
  try {
    const data = await response.json();
    if (data && data.detail) {
      return Array.isArray(data.detail) ? data.detail.join(' | ') : data.detail;
    }
    return JSON.stringify(data);
  } catch (error) {
    return response.statusText || 'Request failed';
  }
};

export const request = async (path, options = {}, token) => {
  const headers = {
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const loginDemo = (token) =>
  request('/auth/demo-login', { method: 'POST' }, token);

export const listWorkflows = (token) => request('/workflows', {}, token);

export const createWorkflow = (payload, token) =>
  request('/workflows', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

export const generateWorkflow = (prompt, token) =>
  request('/workflows/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  }, token);

export const getWorkflow = (workflowId, token) =>
  request(`/workflows/${workflowId}`, {}, token);

export const updateWorkflow = (workflowId, payload, token) =>
  request(`/workflows/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, token);

export const validateWorkflow = (workflowId, token) =>
  request(`/workflows/${workflowId}/validate`, { method: 'POST' }, token);

export const runWorkflow = (workflowId, payload, token) =>
  request(`/workflows/${workflowId}/run`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

export const getRun = (runId, token) => request(`/runs/${runId}`, {}, token);

export const getRunLogs = (runId, token) =>
  request(`/runs/${runId}/logs`, {}, token);
