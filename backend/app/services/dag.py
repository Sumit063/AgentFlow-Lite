from collections import deque
from typing import List, Sequence


def _get_value(item, name):
    if isinstance(item, dict):
        return item.get(name)
    return getattr(item, name)


def validate_dag(nodes: Sequence, edges: Sequence) -> List[str]:
    errors: List[str] = []
    node_ids = []
    seen = set()
    duplicates = set()

    for node in nodes:
        node_id = _get_value(node, "id")
        if node_id in seen:
            duplicates.add(node_id)
        else:
            seen.add(node_id)
            node_ids.append(node_id)

    if duplicates:
        errors.append(f"Duplicate node ids: {sorted(duplicates)}")

    node_id_set = set(node_ids)
    for edge in edges:
        source = _get_value(edge, "from_node_id")
        target = _get_value(edge, "to_node_id")
        if source not in node_id_set or target not in node_id_set:
            errors.append(
                f"Edge refers to missing node(s): {source} -> {target}"
            )

    if errors:
        return errors

    try:
        topological_sort(nodes, edges)
    except ValueError as exc:
        errors.append(str(exc))

    return errors


def topological_sort(nodes: Sequence, edges: Sequence) -> List[int]:
    node_ids = [_get_value(node, "id") for node in nodes]
    adjacency = {node_id: set() for node_id in node_ids}
    indegree = {node_id: 0 for node_id in node_ids}

    for edge in edges:
        source = _get_value(edge, "from_node_id")
        target = _get_value(edge, "to_node_id")
        if source in adjacency and target in adjacency:
            if target not in adjacency[source]:
                adjacency[source].add(target)
                indegree[target] += 1

    queue = deque([node_id for node_id, degree in indegree.items() if degree == 0])
    order: List[int] = []

    while queue:
        node_id = queue.popleft()
        order.append(node_id)
        for neighbor in adjacency[node_id]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)

    if len(order) != len(node_ids):
        raise ValueError("Cycle detected in workflow DAG")

    return order
