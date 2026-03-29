from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    sql: str
    rows: Optional[List[Dict[str, Any]]] = None


class ErrorResponse(BaseModel):
    error: str
    sql: str
