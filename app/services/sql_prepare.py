import re
from typing import Optional, Tuple

FORBIDDEN_KEYWORDS = (
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
)

MAX_LIMIT_DEFAULT = 100


def clean_sql(sql: str) -> str:
    if not sql:
        return ""
    sql = sql.replace("```sql", "").replace("```SQL", "").replace("```", "")
    return sql.strip()


def validate_sql(sql: str) -> Optional[str]:
    """
    Return an error message if SQL is not allowed, else None.
    Only a single SELECT (or WITH ... SELECT) statement; no writes or DDL.
    """
    sql_one = sql.strip().rstrip(";").strip()
    if not sql_one:
        return "Empty SQL query"

    if ";" in sql_one:
        return "Multiple SQL statements are not allowed"

    upper = sql_one.upper()
    for kw in FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{kw}\b", upper):
            return "Query contains forbidden SQL keywords"

    if not re.match(r"^\s*(SELECT|WITH)\b", sql_one, re.IGNORECASE):
        return "Only SELECT queries are allowed"

    return None


def ensure_limit(sql: str, max_rows: int = MAX_LIMIT_DEFAULT) -> str:
    s = sql.strip().rstrip(";").strip()
    if re.search(r"\blimit\s+\d+", s, re.IGNORECASE):
        return s
    
    upper = s.upper()
    has_aggregate = any(kw in upper for kw in ("COUNT(", "SUM(", "AVG(", "MAX(", "MIN("))
    has_group_by = re.search(r"\bGROUP\s+BY\b", upper)
    
    if has_aggregate and not has_group_by:
        return s
    
    return f"{s} LIMIT {max_rows}"


def prepare_sql(raw_sql: str) -> Tuple[str, Optional[str]]:
    """
    Clean, validate, and enforce LIMIT. Returns (sql, error_message).
    If error_message is set, sql is still the cleaned string for the response payload.
    """
    sql = clean_sql(raw_sql)
    err = validate_sql(sql)
    if err:
        return sql, err
    sql = ensure_limit(sql, MAX_LIMIT_DEFAULT)
    return sql, None
