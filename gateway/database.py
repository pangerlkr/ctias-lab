"""Database models for CTIAS Lab"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, sessionmaker

Base = declarative_base()


class IOCRecord(Base):
    """IOC Analysis Records"""

    __tablename__ = "ioc_records"

    id = Column(Integer, primary_key=True, index=True)
    ioc_value = Column(String(512), nullable=False, index=True)
    ioc_type = Column(String(50), nullable=False, index=True)
    risk_score = Column(Integer, default=0)
    metadata = Column(JSON, default={})
    tags = Column(JSON, default=[])
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ThreatIntelligence(Base):
    """Threat Intelligence Feed Data"""

    __tablename__ = "threat_intelligence"

    id = Column(Integer, primary_key=True, index=True)
    feed_name = Column(String(255), nullable=False, index=True)
    indicator_value = Column(String(512), nullable=False)
    indicator_type = Column(String(50), nullable=False)
    threat_type = Column(String(100))
    confidence = Column(Integer, default=50)
    description = Column(Text)
    metadata = Column(JSON, default={})
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)


class ReconTask(Base):
    """Reconnaissance Task Records"""

    __tablename__ = "recon_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(100), unique=True, nullable=False, index=True)
    target = Column(String(512), nullable=False)
    modules = Column(JSON, default=[])
    status = Column(String(50), default="queued")
    progress = Column(Integer, default=0)
    results = Column(JSON, default={})
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class User(Base):
    """User accounts"""

    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)


class DatabaseManager:
    """Database connection manager"""

    def __init__(self, database_url: str):
        self.engine = create_engine(database_url, pool_pre_ping=True)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)

    def create_tables(self):
        """Create all database tables"""
        Base.metadata.create_all(bind=self.engine)

    def get_session(self) -> Session:
        """Get database session"""
        return self.SessionLocal()

    def close(self):
        """Close database connections"""
        self.engine.dispose()
