"""
Database configuration.

Uses PostgreSQL/Supabase in production when DATABASE_URL is provided.
Falls back to SQLite for local development/demo.

SQLite is configured with a busy timeout and WAL mode so concurrent
FastAPI requests are much less likely to fail with:
    sqlite3.OperationalError: database is locked
"""

import os

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base


DEFAULT_SQLITE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "freight.db",
)

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"sqlite:///{DEFAULT_SQLITE_PATH}",
)

IS_SQLITE = DATABASE_URL.startswith("sqlite")


if IS_SQLITE:
    connect_args = {
        "check_same_thread": False,
        "timeout": 30,
    }

    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        future=True,
        pool_pre_ping=True,
    )

    @event.listens_for(engine, "connect")
    def configure_sqlite(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()

        # Enable WAL so reads can happen while another request writes.
        cursor.execute("PRAGMA journal_mode=WAL")

        # Wait instead of immediately failing when another transaction
        # temporarily owns the write lock.
        cursor.execute("PRAGMA busy_timeout=30000")

        # Reasonable durability/performance balance for this application.
        cursor.execute("PRAGMA synchronous=NORMAL")

        cursor.close()

else:
    engine = create_engine(
        DATABASE_URL,
        future=True,
        pool_pre_ping=True,
    )


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist."""
    from app.models import freight  # noqa: F401

    Base.metadata.create_all(bind=engine)