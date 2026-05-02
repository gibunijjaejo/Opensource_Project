from datetime import date, datetime
from typing import Optional, Literal
from pydantic import BaseModel


PortfolioKind = Literal["campus_activity", "external_activity", "certificate", "award", "project"]


class PortfolioEntryCreate(BaseModel):
    kind: PortfolioKind
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[date] = None
    order_index: Optional[int] = 0


class PortfolioEntryUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[date] = None
    order_index: Optional[int] = None


class PortfolioEntryResponse(BaseModel):
    id: int
    kind: PortfolioKind
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[date] = None
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioBulkSaveItem(BaseModel):
    id: Optional[int] = None
    title: Optional[str] = None
    content: Optional[str] = None
    entry_date: Optional[date] = None
    order_index: Optional[int] = 0


class PortfolioBulkSaveRequest(BaseModel):
    campus_activity: list[PortfolioBulkSaveItem] = []
    external_activity: list[PortfolioBulkSaveItem] = []
    certificate: list[PortfolioBulkSaveItem] = []
    award: list[PortfolioBulkSaveItem] = []
    project: list[PortfolioBulkSaveItem] = []


EvaluationStatus = Literal["pending", "running", "completed", "failed"]


class PortfolioEvaluationResponse(BaseModel):
    id: int
    status: EvaluationStatus
    error_message: Optional[str] = None
    alignment_score: Optional[int] = None
    summary: Optional[str] = None
    strengths: list[str] = []
    weaknesses: list[str] = []
    suggestions: list[str] = []
    by_section: dict[str, str] = {}
    model_name: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}
