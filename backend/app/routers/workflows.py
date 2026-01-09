from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.db.models import Edge, Node, Run, StepLog, Workflow
from app.db.session import get_db
from app.schemas.run import RunCreate, RunOut
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowGenerateRequest,
    WorkflowGenerateResponse,
    WorkflowOut,
    WorkflowSummary,
    WorkflowUpdate,
)
from app.services.dag import validate_dag
from app.services.workflow_generator import generate_workflow_from_prompt
from app.services.workflow_engine import execute_workflow

router = APIRouter(prefix="/workflows", tags=["workflows"])


def get_workflow_or_404(db: Session, workflow_id: int) -> Workflow:
    workflow = (
        db.query(Workflow)
        .options(selectinload(Workflow.nodes), selectinload(Workflow.edges))
        .filter(Workflow.id == workflow_id)
        .first()
    )
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.get("", response_model=List[WorkflowSummary])
def list_workflows(db: Session = Depends(get_db)):
    return db.query(Workflow).order_by(Workflow.created_at.desc()).all()


@router.post("", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
def create_workflow(payload: WorkflowCreate, db: Session = Depends(get_db)):
    errors = validate_dag(payload.nodes, payload.edges)
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    workflow = Workflow(name=payload.name, description=payload.description)
    db.add(workflow)
    db.flush()

    for node in payload.nodes:
        db.add(
            Node(
                id=node.id,
                workflow_id=workflow.id,
                type=node.type,
                config=node.config,
                name=node.name,
            )
        )

    for edge in payload.edges:
        db.add(
            Edge(
                workflow_id=workflow.id,
                from_node_id=edge.from_node_id,
                to_node_id=edge.to_node_id,
            )
        )

    db.commit()
    return get_workflow_or_404(db, workflow.id)


@router.post("/generate", response_model=WorkflowGenerateResponse)
def generate_workflow(payload: WorkflowGenerateRequest):
    try:
        return generate_workflow_from_prompt(payload.prompt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{workflow_id}", response_model=WorkflowOut)
def get_workflow(workflow_id: int, db: Session = Depends(get_db)):
    return get_workflow_or_404(db, workflow_id)


@router.put("/{workflow_id}", response_model=WorkflowOut)
def update_workflow(workflow_id: int, payload: WorkflowUpdate, db: Session = Depends(get_db)):
    workflow = get_workflow_or_404(db, workflow_id)

    if payload.nodes is None and payload.edges is None:
        if payload.name is not None:
            workflow.name = payload.name
        if payload.description is not None:
            workflow.description = payload.description
        db.commit()
        return get_workflow_or_404(db, workflow_id)

    if payload.nodes is None or payload.edges is None:
        raise HTTPException(status_code=400, detail="Both nodes and edges are required when updating graph")

    errors = validate_dag(payload.nodes, payload.edges)
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    workflow.name = payload.name or workflow.name
    workflow.description = payload.description if payload.description is not None else workflow.description

    db.query(Edge).filter(Edge.workflow_id == workflow_id).delete(synchronize_session=False)
    db.query(Node).filter(Node.workflow_id == workflow_id).delete(synchronize_session=False)

    for node in payload.nodes:
        db.add(
            Node(
                id=node.id,
                workflow_id=workflow_id,
                type=node.type,
                config=node.config,
                name=node.name,
            )
        )

    for edge in payload.edges:
        db.add(
            Edge(
                workflow_id=workflow_id,
                from_node_id=edge.from_node_id,
                to_node_id=edge.to_node_id,
            )
        )

    db.commit()
    return get_workflow_or_404(db, workflow_id)


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(workflow_id: int, db: Session = Depends(get_db)):
    workflow = get_workflow_or_404(db, workflow_id)
    db.delete(workflow)
    db.commit()
    return None


@router.post("/{workflow_id}/validate")
def validate_workflow(workflow_id: int, db: Session = Depends(get_db)):
    workflow = get_workflow_or_404(db, workflow_id)
    errors = validate_dag(workflow.nodes, workflow.edges)
    return {"valid": not errors, "errors": errors}


@router.post("/{workflow_id}/run", response_model=RunOut)
def run_workflow(workflow_id: int, payload: RunCreate, db: Session = Depends(get_db)):
    workflow = get_workflow_or_404(db, workflow_id)
    run = Run(workflow_id=workflow.id, status="PENDING", started_at=datetime.utcnow())
    db.add(run)
    db.commit()
    db.refresh(run)

    errors = validate_dag(workflow.nodes, workflow.edges)
    if errors:
        run.status = "FAILED"
        run.finished_at = datetime.utcnow()
        db.add(
            StepLog(
                run_id=run.id,
                node_id=None,
                status="FAILED",
                message="Validation failed: " + "; ".join(errors),
                timestamp=datetime.utcnow(),
            )
        )
        db.commit()
        return run

    run.status = "RUNNING"
    db.commit()

    try:
        execute_workflow(db, workflow, run.id, payload.run_input)
        run.status = "SUCCESS"
    except Exception:
        run.status = "FAILED"
    run.finished_at = datetime.utcnow()
    db.commit()
    return run
