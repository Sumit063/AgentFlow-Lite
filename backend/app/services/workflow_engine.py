import json
import string
from datetime import datetime
from typing import Any, Dict

import httpx
from sqlalchemy.orm import Session

from app.db.models import StepLog
from app.services.dag import topological_sort


class LLMProvider:
    def generate(self, prompt: str, context: Dict[str, Any]) -> Any:
        raise NotImplementedError


class DummyLLMProvider(LLMProvider):
    def generate(self, prompt: str, context: Dict[str, Any]) -> Any:
        return {"prompt": prompt, "context": context, "provider": "dummy"}


class TemplateFormatter(string.Formatter):
    def get_value(self, key, args, kwargs):
        if isinstance(key, int):
            key = str(key)
        if isinstance(key, str) and key not in kwargs:
            raise KeyError(key)
        return super().get_value(key, args, kwargs)


def _stringify(value: Any) -> str:
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value)
    except TypeError:
        return str(value)


def format_template(template: str, context: Dict[str, Any]) -> str:
    formatter = TemplateFormatter()
    string_context = {key: _stringify(value) for key, value in context.items()}
    try:
        return formatter.vformat(template, args=(), kwargs=string_context)
    except KeyError as exc:
        missing = exc.args[0]
        raise ValueError(f"Missing template variable: {missing}") from exc


def summarize_output(output: Any, max_len: int = 200) -> str:
    text = _stringify(output)
    if len(text) > max_len:
        return f"{text[:max_len]}...(truncated)"
    return text


def build_context(node_lookup: Dict[int, Any], outputs: Dict[int, Any], run_input: Dict[str, Any]) -> Dict[str, Any]:
    context: Dict[str, Any] = {"run_input": run_input}
    for node_id, output in outputs.items():
        node = node_lookup.get(node_id)
        context[str(node_id)] = output
        if node is not None:
            context[node.name] = output
    return context


def resolve_output_selection(selection: Any, name_to_id: Dict[str, int], outputs: Dict[int, Any]) -> Any:
    if isinstance(selection, int):
        if selection not in outputs:
            raise ValueError(f"Unknown node id in OUTPUT selection: {selection}")
        return outputs[selection]
    if isinstance(selection, str):
        if selection.isdigit():
            return resolve_output_selection(int(selection), name_to_id, outputs)
        if selection not in name_to_id:
            raise ValueError(f"Unknown node name in OUTPUT selection: {selection}")
        return outputs[name_to_id[selection]]
    raise ValueError(f"Unsupported OUTPUT selection type: {selection}")


def execute_node(node, outputs: Dict[int, Any], node_lookup: Dict[int, Any], run_input: Dict[str, Any], llm_provider: LLMProvider) -> Any:
    node_type = node.type.upper()
    config = node.config or {}

    if node_type == "INPUT":
        return run_input

    if node_type == "TRANSFORM":
        template = config.get("template")
        if not template:
            raise ValueError("TRANSFORM node requires a template")
        context = build_context(node_lookup, outputs, run_input)
        return format_template(template, context)

    if node_type == "HTTP":
        url = config.get("url")
        if not url:
            raise ValueError("HTTP node requires a url")
        response = httpx.get(url, timeout=10.0)
        response.raise_for_status()
        return response.json()

    if node_type == "LLM":
        prompt = config.get("prompt")
        if not prompt:
            raise ValueError("LLM node requires a prompt")
        context = build_context(node_lookup, outputs, run_input)
        return llm_provider.generate(prompt, context)

    if node_type == "OUTPUT":
        select = config.get("select")
        if not select:
            return outputs
        name_to_id = {node.name: node.id for node in node_lookup.values()}
        aggregated: Dict[str, Any] = {}
        for item in select:
            if isinstance(item, int) or (isinstance(item, str) and item.isdigit()):
                key = str(item)
            else:
                key = str(item)
            aggregated[key] = resolve_output_selection(item, name_to_id, outputs)
        return aggregated

    raise ValueError(f"Unsupported node type: {node.type}")


def execute_workflow(db: Session, workflow, run_id: int, run_input: Dict[str, Any]) -> Dict[int, Any]:
    nodes = workflow.nodes
    edges = workflow.edges
    node_lookup = {node.id: node for node in nodes}
    order = topological_sort(nodes, edges)
    outputs: Dict[int, Any] = {}
    llm_provider = DummyLLMProvider()

    for node_id in order:
        node = node_lookup[node_id]
        try:
            output = execute_node(node, outputs, node_lookup, run_input, llm_provider)
            outputs[node_id] = output
            log = StepLog(
                run_id=run_id,
                node_id=node_id,
                status="SUCCESS",
                message=summarize_output(output),
                timestamp=datetime.utcnow(),
            )
            db.add(log)
            db.commit()
        except Exception as exc:
            log = StepLog(
                run_id=run_id,
                node_id=node_id,
                status="FAILED",
                message=str(exc),
                timestamp=datetime.utcnow(),
            )
            db.add(log)
            db.commit()
            raise

    return outputs
