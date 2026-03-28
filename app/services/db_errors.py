def sanitize_db_error(exc: Exception) -> str:
    msg = str(exc).lower()
    raw = str(exc)

    if "unknown column" in msg or "1054" in raw:
        return "The query references an unknown column."

    if "syntax" in msg or "1064" in raw or "parse error" in msg:
        return "The SQL query has a syntax error."

    if "timeout" in msg or "timed out" in msg or "3024" in raw:
        return "The database query timed out."

    if "access denied" in msg or "1045" in raw:
        return "Database authentication failed."

    if "doesn't exist" in msg or "1146" in raw:
        return "The query references a table that does not exist."

    return "The query could not be executed."
