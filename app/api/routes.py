from fastapi import APIRouter

from app.core.openai_client import generate_sql
from app.schemas.query import ErrorResponse, QueryRequest, QueryResponse
from app.services.db_errors import sanitize_db_error
from app.services.query_service import execute_query
from app.services.sql_prepare import prepare_sql

router = APIRouter()


@router.post("/query")
async def query(request: QueryRequest):
    print(f"[DEBUG] Question: {request.question}")
    try:
        raw_sql = generate_sql(request.question)
        print(f"[DEBUG] Generated SQL: {raw_sql}")
    except ValueError as e:
        print(f"[DEBUG] Generate SQL Error: {e}")
        return ErrorResponse(error=str(e), sql="")

    sql, prep_error = prepare_sql(raw_sql)
    print(f"[DEBUG] Prepared SQL: {sql}, Error: {prep_error}")
    if prep_error:
        return ErrorResponse(error=prep_error, sql=sql)

    try:
        rows = execute_query(sql)
        print(f"[DEBUG] Query Success. Rows: {len(rows) if rows else 0}")
        return QueryResponse(sql=sql, rows=rows)
    except Exception as e:
        print(f"[DEBUG] Execute Error: {type(e).__name__}: {e}")
        return ErrorResponse(error=sanitize_db_error(e), sql=sql)
