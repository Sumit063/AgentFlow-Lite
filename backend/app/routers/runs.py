from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.models import Node, Run, StepLog
from app.db.session import get_db
from app.schemas.run import RunSummary, StepLogOut

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("/{run_id}", response_model=RunSummary)
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    logs = db.query(StepLog).filter(StepLog.run_id == run_id).all()
    total_steps = len(logs)
    success_steps = len([log for log in logs if log.status == "SUCCESS"])
    failed_steps = len([log for log in logs if log.status == "FAILED"])

    return RunSummary(
        id=run.id,
        workflow_id=run.workflow_id,
        status=run.status,
        started_at=run.started_at,
        finished_at=run.finished_at,
        total_steps=total_steps,
        success_steps=success_steps,
        failed_steps=failed_steps,
    )


@router.get("/{run_id}/logs", response_model=List[StepLogOut])
def get_run_logs(run_id: int, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    logs = (
        db.query(StepLog)
        .filter(StepLog.run_id == run_id)
        .order_by(StepLog.timestamp.asc())
        .all()
    )

    node_ids = {log.node_id for log in logs if log.node_id is not None}
    node_map = {}
    if node_ids:
        nodes = (
            db.query(Node)
            .filter(Node.workflow_id == run.workflow_id, Node.id.in_(node_ids))
            .all()
        )
        node_map = {node.id: node.name for node in nodes}

    results = []
    for log in logs:
        results.append(
            StepLogOut(
                id=log.id,
                node_id=log.node_id,
                node_name=node_map.get(log.node_id),
                status=log.status,
                message=log.message,
                timestamp=log.timestamp,
            )
        )

    return results
