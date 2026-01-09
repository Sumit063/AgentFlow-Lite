from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    run_input: Dict[str, Any] = Field(default_factory=dict)


class RunOut(BaseModel):
    id: int
    workflow_id: int
    status: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class RunSummary(RunOut):
    total_steps: int
    success_steps: int
    failed_steps: int


class StepLogOut(BaseModel):
    id: int
    node_id: Optional[int] = None
    node_name: Optional[str] = None
    status: str
    message: str
    timestamp: datetime

    class Config:
        orm_mode = True
