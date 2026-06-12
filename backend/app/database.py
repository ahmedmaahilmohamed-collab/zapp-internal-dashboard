from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


def sqlalchemy_url(database_url: str | None) -> str | None:
    if not database_url:
        return None
    if database_url.startswith("postgresql://"):
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def build_engine():
    settings = get_settings()
    url = sqlalchemy_url(settings.database_url)
    if not url:
        return None

    return create_engine(url, pool_pre_ping=True, connect_args={"sslmode": "require"})


engine = build_engine()
SessionLocal = (
    sessionmaker(bind=engine, autoflush=False, autocommit=False)
    if engine is not None
    else None
)


def get_db() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise RuntimeError("DATABASE_URL is not configured.")

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
