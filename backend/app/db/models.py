from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from app.db.base import Base


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    nodes = relationship("Node", back_populates="workflow", cascade="all, delete-orphan")
    edges = relationship("Edge", back_populates="workflow", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="workflow", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), primary_key=True)
    type = Column(String(50), nullable=False)
    config = Column(JSON, nullable=False, default=dict)
    name = Column(String(200), nullable=False)

    workflow = relationship("Workflow", back_populates="nodes")


class Edge(Base):
    __tablename__ = "edges"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    from_node_id = Column(Integer, nullable=False)
    to_node_id = Column(Integer, nullable=False)

    workflow = relationship("Workflow", back_populates="edges")


class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)

    workflow = relationship("Workflow", back_populates="runs")
    logs = relationship("StepLog", back_populates="run", cascade="all, delete-orphan")


class StepLog(Base):
    __tablename__ = "step_logs"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    node_id = Column(Integer, nullable=True)
    status = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)

    run = relationship("Run", back_populates="logs")
