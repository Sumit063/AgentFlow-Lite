from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class NodeInput(BaseModel):
    id: int
    type: str
    name: str
    config: Dict[str, Any] = Field(default_factory=dict)


class EdgeInput(BaseModel):
    id: Optional[int] = None
    from_node_id: int
    to_node_id: int


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: List[NodeInput]
    edges: List[EdgeInput]


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    nodes: Optional[List[NodeInput]] = None
    edges: Optional[List[EdgeInput]] = None


class NodeOut(NodeInput):
    class Config:
        orm_mode = True


class EdgeOut(EdgeInput):
    class Config:
        orm_mode = True


class WorkflowSummary(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        orm_mode = True


class WorkflowOut(WorkflowSummary):
    nodes: List[NodeOut]
    edges: List[EdgeOut]


class WorkflowGenerateRequest(BaseModel):
    prompt: str


class WorkflowGenerateResponse(BaseModel):
    name: str
    description: Optional[str] = None
    nodes: List[NodeInput]
    edges: List[EdgeInput]
