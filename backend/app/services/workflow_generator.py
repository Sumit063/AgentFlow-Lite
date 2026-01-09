import json
import re
from typing import Any, Dict, List

import httpx

from app.config import settings
from app.services.dag import validate_dag

ALLOWED_NODE_TYPES = {"INPUT", "TRANSFORM", "HTTP", "LLM", "OUTPUT", "CONDITION", "MERGE", "DELAY"}


def build_generation_prompt(user_prompt: str) -> str:
    return (
        "You are an assistant that creates workflow JSON for AgentFlow Lite.\n"
        "Return ONLY valid JSON (no markdown, no extra text).\n\n"
        "Schema:\n"
        "{\n"
        "  \"name\": string,\n"
        "  \"description\": string | null,\n"
        "  \"nodes\": [\n"
        "    {\"id\": int, \"type\": \"INPUT|TRANSFORM|HTTP|LLM|OUTPUT|CONDITION|MERGE|DELAY\", \"name\": string, \"config\": object}\n"
        "  ],\n"
        "  \"edges\": [\n"
        "    {\"from_node_id\": int, \"to_node_id\": int}\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "- Use only the node types listed above.\n"
        "- INPUT config should be {} or {\"key\": \"text\", \"input_type\": \"text|file|image\"}.\n"
        "- TRANSFORM config requires {\"template\": "
        "string} and may use {{variable}} placeholders.\n"
        "- HTTP config requires {\"url\": "
        "https://...}.\n"
        "- LLM config requires {\"prompt\": "
        "string} and may use {{variable}} placeholders. Optional {\"image_key\": \"image\"} for image tasks.\n"
        "- OUTPUT config requires {\"select\": [node_ids]} or {} to return all outputs.\n"
        "- CONDITION config requires {\"left\": value, \"operator\": \"equals|not_equals|contains|greater_than|less_than\", \"right\": value}.\n"
        "- MERGE config uses {\"sources\": [node_ids], \"key_by\": \"name|id\"}.\n"
        "- DELAY config uses {\"seconds\": number}.\n"
        "- IDs must be integers and edges must connect existing node IDs.\n\n"
        "- Infer missing details and use reasonable defaults when the user is high-level.\n"
        "- Keep the workflow minimal and easy to understand.\n\n"
        f"User request: {user_prompt}"
    )


def call_gemini(prompt: str) -> str:
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set")

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}],
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
        },
    }
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.gemini_model}:generateContent?key={settings.gemini_api_key}"
    )
    response = httpx.post(url, json=payload, timeout=30.0)
    response.raise_for_status()
    data = response.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise ValueError("No candidates returned from Gemini")
    content = candidates[0].get("content", {})
    parts = content.get("parts") or []
    if not parts:
        raise ValueError("Gemini response had no content parts")
    return parts[0].get("text", "")


def parse_json_response(text: str) -> Dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        match = re.search(r"```(?:json)?\s*(\{.*\})\s*```", cleaned, re.DOTALL)
        if match:
            cleaned = match.group(1)
    return json.loads(cleaned)


def validate_workflow_payload(payload: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    if not isinstance(payload, dict):
        return ["Response is not a JSON object"]

    nodes = payload.get("nodes")
    edges = payload.get("edges")

    if not isinstance(nodes, list) or not isinstance(edges, list):
        errors.append("Response must include nodes[] and edges[]")
        return errors

    node_ids = set()
    for node in nodes:
        if not isinstance(node, dict):
            errors.append("Node must be an object")
            continue
        node_id = node.get("id")
        node_type = node.get("type")
        name = node.get("name")
        config = node.get("config")

        if not isinstance(node_id, int):
            errors.append("Node id must be an integer")
        if node_id in node_ids:
            errors.append(f"Duplicate node id: {node_id}")
        node_ids.add(node_id)

        if node_type not in ALLOWED_NODE_TYPES:
            errors.append(f"Unsupported node type: {node_type}")
        if not isinstance(name, str) or not name:
            errors.append("Node name is required")
        if not isinstance(config, dict):
            errors.append(f"Node {node_id} config must be an object")
            continue

        if node_type == "TRANSFORM" and not isinstance(config.get("template"), str):
            errors.append(f"TRANSFORM node {node_id} requires template string")
        if node_type == "HTTP" and not isinstance(config.get("url"), str):
            errors.append(f"HTTP node {node_id} requires url string")
        if node_type == "LLM" and not isinstance(config.get("prompt"), str):
            errors.append(f"LLM node {node_id} requires prompt string")
        if node_type == "OUTPUT":
            select = config.get("select")
            if select is not None and not isinstance(select, list):
                errors.append(f"OUTPUT node {node_id} select must be a list")
        if node_type == "CONDITION":
            if "left" not in config or "right" not in config:
                errors.append(f"CONDITION node {node_id} requires left and right values")
            operator = config.get("operator")
            if not isinstance(operator, str):
                errors.append(f"CONDITION node {node_id} requires operator string")
        if node_type == "MERGE":
            sources = config.get("sources")
            if sources is not None and not isinstance(sources, list):
                errors.append(f"MERGE node {node_id} sources must be a list")
        if node_type == "DELAY":
            seconds = config.get("seconds")
            if seconds is None or not isinstance(seconds, (int, float)):
                errors.append(f"DELAY node {node_id} requires seconds number")

    if errors:
        return errors

    for edge in edges:
        if not isinstance(edge, dict):
            errors.append("Edge must be an object")
            continue
        from_id = edge.get("from_node_id")
        to_id = edge.get("to_node_id")
        if not isinstance(from_id, int) or not isinstance(to_id, int):
            errors.append("Edge from_node_id and to_node_id must be integers")

    dag_errors = validate_dag(nodes, edges)
    if dag_errors:
        errors.extend(dag_errors)

    return errors


def generate_workflow_from_prompt(prompt: str) -> Dict[str, Any]:
    response_text = call_gemini(build_generation_prompt(prompt))
    payload = parse_json_response(response_text)
    errors = validate_workflow_payload(payload)
    if errors:
        raise ValueError("; ".join(errors))
    return payload
