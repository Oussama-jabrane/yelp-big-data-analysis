from fastapi import APIRouter

from app.core.openai_client import generate_sql
from app.schemas.query import ErrorResponse, QueryRequest, QueryResponse
from app.services.db_errors import sanitize_db_error
from app.services.query_service import execute_query
from app.services.sql_prepare import prepare_sql

router = APIRouter()


@router.post("/query")
async def query(request: QueryRequest):
    try:
        raw_sql = generate_sql(request.question)
    except ValueError as e:
        return ErrorResponse(error=str(e), sql="")

    sql, prep_error = prepare_sql(raw_sql)
    if prep_error:
        return ErrorResponse(error=prep_error, sql=sql)

    try:
        rows = execute_query(sql)
        return QueryResponse(sql=sql, rows=rows)
    except Exception as e:
        return ErrorResponse(error=sanitize_db_error(e), sql=sql)
