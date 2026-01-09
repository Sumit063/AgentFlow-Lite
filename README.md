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
  {"id": 2, "type": "TRANSFORM", "name": "Greeting", "config": {"template": "Hello {{text}}!"}},
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
copy .env.example .env
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

- INPUT: returns the provided run input, a specific key, or a preset value.
- TRANSFORM: formats a template string using prior outputs.
- HTTP: performs a GET request and stores the JSON response.
- LLM: uses Gemini when `GEMINI_API_KEY` is set, otherwise a stub provider.
- CONDITION: evaluates a simple comparison and returns true/false.
- MERGE: combines selected outputs into one object.
- DELAY: waits for a number of seconds (capped at 30).
- OUTPUT: aggregates selected node outputs.

Templates can reference run input values with `{{variable}}` placeholders.
LLM nodes can optionally read images by setting `image_key` and uploading an image in Run Inputs.
In the Builder, INPUT nodes can store text/file/image values and generate Run Input JSON automatically.

## Configuration

Environment variables (optional):

- `DATABASE_URL` (default: `sqlite:///./agentflow.db`)
- `CORS_ORIGINS` (comma-separated, default: `http://localhost:3000`)
- `DEMO_TOKEN` (default: `agentflow-demo-token`)
- `GEMINI_API_KEY` (optional, enables live LLM calls)
- `GEMINI_MODEL` (default: `gemini-1.5-flash`)

## Live example with LLM + variables

1) Set `GEMINI_API_KEY` in `backend/.env`.
2) In the Builder, add INPUT -> LLM -> OUTPUT.
3) In LLM prompt, use variables like `Summarize this: {{text}}`.
4) In the Run Inputs panel, set `text` to a value.

Example workflow JSON:
```json
{
  "name": "LLM Summary",
  "description": "Summarize user input with Gemini.",
  "nodes": [
    { "id": 1, "type": "INPUT", "name": "User Input", "config": {} },
    { "id": 2, "type": "LLM", "name": "Summarize", "config": { "prompt": "Summarize this: {{text}}" } },
    { "id": 3, "type": "OUTPUT", "name": "Result", "config": { "select": [2] } }
  ],
  "edges": [
    { "from_node_id": 1, "to_node_id": 2 },
    { "from_node_id": 2, "to_node_id": 3 }
  ]
}
```

Run input JSON:
```json
{ "text": "AgentFlow Lite lets teams test small workflows quickly." }
```

## Prompt-to-Workflow (LLM generated)

You can generate a workflow draft from a high-level goal. You do not need to specify node types.

1) Open the Builder and find the "Describe your goal" box.
2) Enter a prompt like:
   "Build a pipeline for creating a chatbot that responds to user messages."
3) Click "Generate Workflow". The draft loads onto the canvas (not auto-saved).

The response must be strict JSON. If the model returns extra text, refine the prompt and try again.
