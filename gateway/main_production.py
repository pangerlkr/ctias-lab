"""CTIAS Lab Gateway API - Production-Ready FastAPI Application"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

import redis
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import get_settings
from database import DatabaseManager, IOCRecord, ReconTask

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Global variables
db_manager: Optional[DatabaseManager] = None
redis_client: Optional[redis.Redis] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager"""
    global db_manager, redis_client
    settings = get_settings()

    # Initialize database
    try:
        db_manager = DatabaseManager(settings.database_url)
        db_manager.create_tables()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        db_manager = None

    # Initialize Redis
    try:
        redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        redis_client.ping()
        logger.info("Redis initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Redis: {e}")
        redis_client = None

    yield

    # Cleanup
    if db_manager:
        db_manager.close()
    if redis_client:
        redis_client.close()


# Initialize rate limiter
limiter = Limiter(key_func=get_remote_address)

# Create FastAPI app
app = FastAPI(
    title="CTIAS Lab Gateway API",
    description="Production-ready gateway for Cyber Threat Intelligence & Attack Surface Lab",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Add CORS middleware
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Request/Response models
class HealthCheckResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    services: dict


class IOCSubmission(BaseModel):
    ioc_value: str = Field(..., min_length=1, max_length=512)
    ioc_type: str = Field(...)  # ip, domain, url, hash, email
    tags: List[str] = Field(default_factory=list)

    @validator("ioc_type")
    def validate_ioc_type(cls, v):
        allowed_types = [
            "ip",
            "domain",
            "url",
            "hash",
            "email",
            "md5",
            "sha1",
            "sha256",
        ]
        if v.lower() not in allowed_types:
            raise ValueError(f"IOC type must be one of: {', '.join(allowed_types)}")
        return v.lower()

    @validator("ioc_value")
    def validate_ioc_value(cls, v):
        if not v or not v.strip():
            raise ValueError("IOC value cannot be empty")
        return v.strip()


class IOCResponse(BaseModel):
    ioc_id: str
    ioc_value: str
    ioc_type: str
    risk_score: int
    tags: List[str]
    status: str
    timestamp: str


class ReconRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=512)
    modules: List[str] = Field(default=["dns", "whois", "ssl"])

    @validator("target")
    def validate_target(cls, v):
        if not v or not v.strip():
            raise ValueError("Target cannot be empty")
        return v.strip()

    @validator("modules")
    def validate_modules(cls, v):
        allowed_modules = ["dns", "whois", "ssl", "ports", "headers", "certificates"]
        invalid = [m for m in v if m not in allowed_modules]
        if invalid:
            raise ValueError(f"Invalid modules: {', '.join(invalid)}")
        return v


class ReconResponse(BaseModel):
    recon_id: str
    target: str
    modules: List[str]
    status: str
    progress: int
    timestamp: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    progress: int
    results: Optional[dict] = None
    error: Optional[str] = None


# Exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error", "type": "internal_error"},
    )


# Routes
@app.get("/")
@limiter.limit("100/minute")
async def root(request: Request):
    """Root endpoint"""
    return {
        "message": "CTIAS Lab Gateway API",
        "version": "1.0.0",
        "status": "operational",
        "documentation": "/docs",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "ioc_analyze": "/api/v1/ioc/analyze",
            "recon": "/api/v1/recon",
            "task_status": "/api/v1/status/{task_id}",
        },
    }


@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Health check endpoint"""
    db_status = "connected" if db_manager else "unavailable"
    redis_status = "connected" if redis_client else "unavailable"

    try:
        if redis_client:
            redis_client.ping()
    except Exception:
        redis_status = "error"

    overall_status = "healthy" if db_status == "connected" else "degraded"

    return HealthCheckResponse(
        status=overall_status,
        version="1.0.0",
        timestamp=datetime.utcnow().isoformat(),
        services={"database": db_status, "redis": redis_status},
    )


@app.post("/api/v1/ioc/analyze", response_model=IOCResponse)
@limiter.limit("60/minute")
async def analyze_ioc(request: Request, submission: IOCSubmission):
    """Analyze an Indicator of Compromise (IOC)"""
    try:
        logger.info(f"Analyzing IOC: {submission.ioc_value} ({submission.ioc_type})")

        # Generate unique IOC ID
        import uuid

        ioc_id = f"ioc_{uuid.uuid4().hex[:12]}"

        # Store in database if available
        if db_manager:
            try:
                session = db_manager.get_session()
                ioc_record = IOCRecord(
                    ioc_value=submission.ioc_value,
                    ioc_type=submission.ioc_type,
                    tags=submission.tags,
                    risk_score=50,  # Placeholder
                    metadata={"status": "queued"},
                )
                session.add(ioc_record)
                session.commit()
                ioc_id = f"ioc_{ioc_record.id}"
                session.close()
            except Exception as e:
                logger.error(f"Failed to store IOC in database: {e}")

        # Queue for analysis if Redis available
        if redis_client:
            try:
                redis_client.setex(
                    f"ioc:{ioc_id}",
                    3600,
                    str(
                        {
                            "value": submission.ioc_value,
                            "type": submission.ioc_type,
                            "status": "queued",
                        }
                    ),
                )
            except Exception as e:
                logger.error(f"Failed to queue IOC in Redis: {e}")

        return IOCResponse(
            ioc_id=ioc_id,
            ioc_value=submission.ioc_value,
            ioc_type=submission.ioc_type,
            risk_score=50,
            tags=submission.tags,
            status="queued for analysis",
            timestamp=datetime.utcnow().isoformat(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"IOC analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to analyze IOC")


@app.post("/api/v1/recon", response_model=ReconResponse)
@limiter.limit("30/minute")
async def start_reconnaissance(request: Request, recon_req: ReconRequest):
    """Start reconnaissance on a target"""
    try:
        logger.info(f"Starting recon on target: {recon_req.target}")

        # Generate unique recon ID
        import uuid

        recon_id = f"recon_{uuid.uuid4().hex[:12]}"

        # Store in database if available
        if db_manager:
            try:
                session = db_manager.get_session()
                recon_task = ReconTask(
                    task_id=recon_id,
                    target=recon_req.target,
                    modules=recon_req.modules,
                    status="queued",
                    progress=0,
                )
                session.add(recon_task)
                session.commit()
                session.close()
            except Exception as e:
                logger.error(f"Failed to store recon task in database: {e}")

        # Queue for processing if Redis available
        if redis_client:
            try:
                redis_client.setex(
                    f"recon:{recon_id}",
                    3600,
                    str(
                        {
                            "target": recon_req.target,
                            "modules": recon_req.modules,
                            "status": "queued",
                        }
                    ),
                )
            except Exception as e:
                logger.error(f"Failed to queue recon task in Redis: {e}")

        return ReconResponse(
            recon_id=recon_id,
            target=recon_req.target,
            modules=recon_req.modules,
            status="queued",
            progress=0,
            timestamp=datetime.utcnow().isoformat(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Recon error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start reconnaissance")


@app.get("/api/v1/status/{task_id}", response_model=TaskStatusResponse)
@limiter.limit("120/minute")
async def get_task_status(request: Request, task_id: str):
    """Get status of a task"""
    try:
        # Check Redis cache first
        if redis_client:
            try:
                cached = redis_client.get(f"recon:{task_id}")
                if cached:
                    return TaskStatusResponse(
                        task_id=task_id, status="processing", progress=50, results=None
                    )
            except Exception as e:
                logger.error(f"Redis lookup error: {e}")

        # Check database
        if db_manager:
            try:
                session = db_manager.get_session()
                task = (
                    session.query(ReconTask)
                    .filter(ReconTask.task_id == task_id)
                    .first()
                )
                if task:
                    session.close()
                    return TaskStatusResponse(
                        task_id=task_id,
                        status=task.status,
                        progress=task.progress,
                        results=task.results,
                        error=task.error,
                    )
                session.close()
            except Exception as e:
                logger.error(f"Database lookup error: {e}")

        raise HTTPException(status_code=404, detail="Task not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Status check error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to check task status")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
