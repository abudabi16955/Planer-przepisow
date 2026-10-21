from pathlib import Path

from psycopg_pool import ConnectionPool

MIGRATIONS = Path(__file__).parent / "migrations"


def migrate(pool: ConnectionPool, directory: Path = MIGRATIONS) -> None:
    # The transaction-scoped lock serializes startup across application instances.
    with pool.connection() as connection, connection.transaction():
        connection.execute("SELECT pg_advisory_xact_lock(73190521)")
        connection.execute(
            "CREATE TABLE IF NOT EXISTS schema_version "
            "(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        applied = {row[0] for row in connection.execute("SELECT version FROM schema_version")}
        for path in sorted(directory.glob("[0-9][0-9][0-9]_*.sql")):
            if path.name not in applied:
                connection.execute(path.read_text(encoding="utf-8"))
                connection.execute("INSERT INTO schema_version (version) VALUES (%s)", (path.name,))
