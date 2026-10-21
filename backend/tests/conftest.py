import os
from uuid import uuid4

import psycopg
import pytest
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict, make_conninfo


@pytest.fixture(scope="session")
def database_url():
    url = os.environ.get("DATABASE_URL", "postgresql://planer@localhost:5433/planer")
    name = "test_" + uuid4().hex
    with psycopg.connect(url, autocommit=True) as connection:
        connection.execute(sql.SQL("CREATE DATABASE {} ").format(sql.Identifier(name)))
    parameters = conninfo_to_dict(url)
    parameters["dbname"] = name
    yield make_conninfo(**parameters)
    with psycopg.connect(url, autocommit=True) as connection:
        connection.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))


@pytest.fixture
def clean_database(database_url):
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute("DROP SCHEMA public CASCADE")
        connection.execute("CREATE SCHEMA public")
    yield database_url
