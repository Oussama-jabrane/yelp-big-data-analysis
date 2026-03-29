from typing import Any, Dict, List

from app.db.database import get_connection, release_connection

MAX_ROWS = 100


def execute_query(sql: str) -> List[Dict[str, Any]]:
    """
    Run a prepared SELECT against MySQL using the shared pool.
    Caller must pass SQL that already passed validation and LIMIT enforcement.
    """
    conn = None
    cursor = None
    try:
        print(f"[QUERY SERVICE] Connecting to DB...")
        conn = get_connection()
        print(f"[QUERY SERVICE] Executing: {sql}")
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql)
        rows = cursor.fetchall() or []
        print(f"[QUERY SERVICE] Fetched {len(rows)} rows")
        return list(rows[:MAX_ROWS])
    except Exception as e:
        print(f"[QUERY SERVICE] Exception: {type(e).__name__}: {e}")
        raise
    finally:
        if cursor is not None:
            cursor.close()
        release_connection(conn)
