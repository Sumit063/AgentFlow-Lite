# AgentFlow Lite

AgentFlow Lite is a minimal, production-style AI workflow runner. It lets you define a workflow as a JSON DAG, validate the structure, execute each node in topological order, and review per-step logs.

## How DAG execution works

- Nodes and edges are validated to ensure every edge references existing nodes and there are no cycles.
- The engine runs nodes in topological order, storing outputs in-memory for the current run.
- Each step writes a log entry with SUCCESS or FAILED, plus a short output or error message.
- Runs are marked PENDING, RUNNING, then SUCCESS or FAILED.

## Example workflow JSON

Nodes:
```json
[
  {"id": 1, "type": "INPUT", "name": "User Input", "config": {}},
  {"id": 2, "type": "TRANSFORM", "name": "Greeting", "config": {"template": "Hello {1}!"}},
  {"id": 3, "type": "OUTPUT", "name": "Result", "config": {"select": [2]}}
]
```

Edges:
```json
[
  {"from_node_id": 1, "to_node_id": 2},
  {"from_node_id": 2, "to_node_id": 3}
]
```

Run input:
```json
{"text": "world"}
```

## Running locally

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The backend runs on `http://localhost:8000` by default.

### Frontend (React)

```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:3000` and uses a CRA proxy to talk to the backend.
You can also set `REACT_APP_API_URL` to a full backend URL if you prefer direct calls.

## Tests

```bash
cd backend
pytest
```

## Node types

- INPUT: returns the provided run input.
- TRANSFORM: formats a template string using prior outputs.
- HTTP: performs a GET request and stores the JSON response.
- LLM: uses a stubbed provider that echoes prompt and context.
- OUTPUT: aggregates selected node outputs.

## Configuration

Environment variables (optional):

- `DATABASE_URL` (default: `sqlite:///./agentflow.db`)
- `CORS_ORIGINS` (comma-separated, default: `http://localhost:3000`)
- `DEMO_TOKEN` (default: `agentflow-demo-token`)
