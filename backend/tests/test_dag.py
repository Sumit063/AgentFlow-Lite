from app.services.dag import topological_sort, validate_dag


def test_validate_dag_detects_cycle():
    nodes = [{"id": 1}, {"id": 2}]
    edges = [
        {"from_node_id": 1, "to_node_id": 2},
        {"from_node_id": 2, "to_node_id": 1},
    ]
    errors = validate_dag(nodes, edges)
    assert errors
    assert any("cycle" in error.lower() for error in errors)


def test_validate_dag_detects_missing_nodes():
    nodes = [{"id": 1}]
    edges = [{"from_node_id": 1, "to_node_id": 99}]
    errors = validate_dag(nodes, edges)
    assert errors
    assert any("missing" in error.lower() for error in errors)


def test_topological_sort_orders_nodes():
    nodes = [{"id": 1}, {"id": 2}, {"id": 3}]
    edges = [
        {"from_node_id": 1, "to_node_id": 2},
        {"from_node_id": 1, "to_node_id": 3},
    ]
    order = topological_sort(nodes, edges)
    assert order[0] == 1
    assert set(order) == {1, 2, 3}
