"""Database connectivity check for the operational health endpoint."""

import os

import psycopg


class DatabaseNotConfigured(Exception):
    """Required connection settings are missing."""


class DatabaseUnavailable(Exception):
    """The configured database could not be reached."""


def check_database() -> None:
    if not all(os.environ.get(key) for key in ("PGHOST", "PGDATABASE", "PGUSER", "PGPASSWORD")):
        raise DatabaseNotConfigured
    try:
        with psycopg.connect(connect_timeout=3) as connection:
            connection.execute("SELECT 1")
    except psycopg.Error:
        raise DatabaseUnavailable from None
