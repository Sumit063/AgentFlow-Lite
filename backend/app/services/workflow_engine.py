import json
import re
import string
import time
from datetime import datetime
from typing import Any, Dict, Optional

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import StepLog
from app.services.dag import topological_sort


class LLMProvider:
    def generate(self, prompt: str, context: Dict[str, Any], image: Optional[Dict[str, str]] = None) -> Any:
        raise NotImplementedError


class DummyLLMProvider(LLMProvider):
    def generate(self, prompt: str, context: Dict[str, Any], image: Optional[Dict[str, str]] = None) -> Any:
        return {"prompt": prompt, "context": context, "provider": "dummy"}

class GeminiLLMProvider(LLMProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self.api_key = api_key
        self.model = model

    def generate(self, prompt: str, context: Dict[str, Any], image: Optional[Dict[str, str]] = None) -> Any:
        parts = [{"text": f"{prompt}\n\nContext:\n{json.dumps(context)}"}]
        if image:
            parts.append(
                {
                    "inlineData": {
                        "mimeType": image["mime_type"],
                        "data": image["data"],
                    }
                }
            )
        payload = {"contents": [{"role": "user", "parts": parts}]}
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        response = httpx.post(url, json=payload, timeout=20.0)
        response.raise_for_status()
        data = response.json()
        candidates = data.get("candidates") or []
        if not candidates:
            return {"provider": "gemini", "text": "", "raw": data}
        content = candidates[0].get("content", {})
        parts = content.get("parts") or []
        text = parts[0].get("text", "") if parts else ""
        return {"provider": "gemini", "text": text}


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


def _normalize_template(template: str) -> str:
    return re.sub(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}", r"{\1}", template)


def format_template(template: str, context: Dict[str, Any]) -> str:
    formatter = TemplateFormatter()
    string_context = {key: _stringify(value) for key, value in context.items()}
    try:
        normalized = _normalize_template(template)
        return formatter.vformat(normalized, args=(), kwargs=string_context)
    except KeyError as exc:
        missing = exc.args[0]
        raise ValueError(f"Missing template variable: {missing}") from exc


def summarize_output(output: Any, max_len: int = 200) -> str:
    text = _stringify(output)
    if len(text) > max_len:
        return f"{text[:max_len]}...(truncated)"
    return text


def build_context(node_lookup: Dict[int, Any], outputs: Dict[int, Any], run_input: Dict[str, Any]) -> Dict[str, Any]:
    context: Dict[str, Any] = dict(run_input)
    context["run_input"] = run_input
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


def parse_image_payload(value: Any) -> Optional[Dict[str, str]]:
    if not value:
        return None
    if isinstance(value, dict):
        if "data_url" in value:
            return parse_image_payload(value["data_url"])
        if "dataUrl" in value:
            return parse_image_payload(value["dataUrl"])
        if "mime_type" in value and "data" in value:
            return {"mime_type": value["mime_type"], "data": value["data"]}
        if "mime_type" in value and "base64" in value:
            return {"mime_type": value["mime_type"], "data": value["base64"]}
    if isinstance(value, str):
        if value.startswith("data:"):
            match = re.match(r"data:([^;]+);base64,(.+)", value)
            if match:
                return {"mime_type": match.group(1), "data": match.group(2)}
        return {"mime_type": "image/png", "data": value}
    return None


def resolve_value(value: Any, context: Dict[str, Any]) -> Any:
    if isinstance(value, str):
        if value in context:
            return context[value]
        if "{{" in value or "{" in value:
            return format_template(value, context)
    return value


def evaluate_condition(config: Dict[str, Any], context: Dict[str, Any]) -> bool:
    left = resolve_value(config.get("left"), context)
    right = resolve_value(config.get("right"), context)
    operator = (config.get("operator") or "equals").lower()

    if operator in {"equals", "=="}:
        return left == right
    if operator in {"not_equals", "!="}:
        return left != right
    if operator == "contains":
        return str(right) in str(left)
    if operator in {"greater_than", ">"}:
        return float(left) > float(right)
    if operator in {"less_than", "<"}:
        return float(left) < float(right)
    raise ValueError(f"Unsupported CONDITION operator: {operator}")


def execute_node(node, outputs: Dict[int, Any], node_lookup: Dict[int, Any], run_input: Dict[str, Any], llm_provider: LLMProvider) -> Any:
    node_type = node.type.upper()
    config = node.config or {}

    if node_type == "INPUT":
        key = config.get("key")
        has_value = "value" in config
        if key:
            if key in run_input:
                return run_input[key]
            if has_value:
                run_input[key] = config.get("value")
                return config.get("value")
            raise ValueError(f"INPUT key '{key}' not found in run input")
        if has_value:
            return config.get("value")
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
        method = (config.get("method") or "GET").upper()
        if method not in {"GET", "POST", "PUT", "DELETE", "PATCH"}:
            raise ValueError("HTTP method must be GET, POST, PUT, DELETE, or PATCH")
        body = config.get("body")
        json_body = None
        data_body = None
        if body is not None:
            if isinstance(body, (dict, list)):
                json_body = body
            elif isinstance(body, str):
                try:
                    json_body = json.loads(body)
                except json.JSONDecodeError:
                    data_body = body
        response = httpx.request(method, url, json=json_body, data=data_body, timeout=10.0)
        response.raise_for_status()
        return response.json()

    if node_type == "LLM":
        prompt = config.get("prompt")
        if not prompt:
            raise ValueError("LLM node requires a prompt")
        context = build_context(node_lookup, outputs, run_input)
        image_key = config.get("image_key")
        if image_key and image_key in context:
            context = {**context, image_key: "<image>"}
        rendered = format_template(prompt, context)
        image_payload = None
        if image_key:
            image_value = run_input.get(image_key)
            if image_value is None:
                image_value = context.get(image_key)
            image_payload = parse_image_payload(image_value)
            if not image_payload:
                raise ValueError(f"Image key '{image_key}' not found or invalid")
        return llm_provider.generate(rendered, context, image=image_payload)

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

    if node_type == "MERGE":
        sources = config.get("sources") or []
        key_by = config.get("key_by", "name")
        name_to_id = {node.name: node.id for node in node_lookup.values()}
        aggregated: Dict[str, Any] = {}
        if not sources:
            sources = list(outputs.keys())
        for item in sources:
            output = resolve_output_selection(item, name_to_id, outputs)
            key = str(item)
            if key_by == "name" and (isinstance(item, int) or (isinstance(item, str) and item.isdigit())):
                node = node_lookup.get(int(item))
                if node:
                    key = node.name
            aggregated[key] = output
        return aggregated

    if node_type == "DELAY":
        seconds = config.get("seconds", 1)
        try:
            delay = float(seconds)
        except (TypeError, ValueError):
            raise ValueError("DELAY seconds must be a number")
        if delay < 0:
            raise ValueError("DELAY seconds must be non-negative")
        time.sleep(min(delay, 30))
        return {"delayed_seconds": delay}

    if node_type == "CONDITION":
        context = build_context(node_lookup, outputs, run_input)
        return evaluate_condition(config, context)

    raise ValueError(f"Unsupported node type: {node.type}")


def execute_workflow(db: Session, workflow, run_id: int, run_input: Dict[str, Any]) -> Dict[int, Any]:
    nodes = workflow.nodes
    edges = workflow.edges
    node_lookup = {node.id: node for node in nodes}
    order = topological_sort(nodes, edges)
    outputs: Dict[int, Any] = {}
    if settings.gemini_api_key:
        llm_provider = GeminiLLMProvider(settings.gemini_api_key, settings.gemini_model)
    else:
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
