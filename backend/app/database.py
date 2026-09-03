"""
Database configuration.

By default this project runs against a local SQLite file so the whole
pipeline (ingestion -> EDA -> training -> decision engine -> API) can be
demoed and tested with zero external services.

For the real Supabase/PostgreSQL deployment, set the environment variable:

    DATABASE_URL=postgresql+psycopg2://<user>:<password>@<host>:5432/<db>?sslmode=require

(Supabase gives you this connection string in Project Settings -> Database.)
The SQL in app/sql/schema.sql is written for PostgreSQL/Supabase and should
be run once via the Supabase SQL editor (or psql) to create the tables,
indexes and row-level-security policies. SQLAlchemy's ORM models in
app/models/ mirror that schema and are used for both SQLite (dev) and
Postgres (prod) — SQLAlchemy abstracts the dialect differences.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DEFAULT_SQLITE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "freight.db"
)

DATABASE_URL = os.environ.get("DATABASE_URL", f"sqlite:///{DEFAULT_SQLITE_PATH}")

IS_SQLITE = DATABASE_URL.startswith("sqlite")

connect_args = {"check_same_thread": False} if IS_SQLITE else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables if they don't exist (used for SQLite dev/demo)."""
    from app.models import freight  # noqa: F401  (ensures models are registered)
    Base.metadata.create_all(bind=engine)
