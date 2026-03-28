from mysql.connector import pooling

from app.core.config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT

connection_pool = None


def get_pool():
    global connection_pool
    if connection_pool is None:
        connection_pool = pooling.MySQLConnectionPool(
            pool_name="yelp_sql_pool",
            pool_size=5,
            pool_reset_session=True,
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
        )
    return connection_pool


def get_connection():
    return get_pool().get_connection()


def release_connection(conn):
    if conn is not None:
        conn.close()
