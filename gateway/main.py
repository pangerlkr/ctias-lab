"""CTIAS Lab Gateway API - Main FastAPI Application"""

import logging
import uuid
from datetime import datetime
from typing import List

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="CTIAS Lab Gateway API",
    description="Central gateway for Cyber Threat Intelligence & Attack Surface Lab",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure properly for production
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
    ioc_type: str  # ip, domain, url, hash, email
    tags: List[str] = Field(default_factory=list)

    @field_validator("ioc_type")
    @classmethod
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


class ReconRequest(BaseModel):
    target: str = Field(..., min_length=1, max_length=512)
    modules: List[str] = Field(default=["dns", "whois", "ssl"])

    @field_validator("modules")
    @classmethod
    def validate_modules(cls, v):
        allowed_modules = ["dns", "whois", "ssl", "ports", "headers", "certificates"]
        invalid = [m for m in v if m not in allowed_modules]
        if invalid:
            raise ValueError(f"Invalid modules: {', '.join(invalid)}")
        return v


# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": "internal_error"},
    )


# Routes
@app.get("/")
async def root():
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
    return HealthCheckResponse(
        status="healthy",
        version="1.0.0",
        timestamp=datetime.utcnow().isoformat(),
        services={"database": "not_configured", "redis": "not_configured"},
    )


@app.post("/api/v1/ioc/analyze")
async def analyze_ioc(submission: IOCSubmission):
    """Analyze an Indicator of Compromise (IOC)"""
    try:
        logger.info(f"Analyzing IOC: {submission.ioc_value} ({submission.ioc_type})")
        ioc_id = f"ioc_{uuid.uuid4().hex[:12]}"

        return {
            "ioc_id": ioc_id,
            "ioc_value": submission.ioc_value,
            "ioc_type": submission.ioc_type,
            "risk_score": 50,
            "tags": submission.tags,
            "status": "queued for analysis",
            "timestamp": datetime.utcnow().isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"IOC analysis error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to analyze IOC")


@app.post("/api/v1/recon")
async def start_reconnaissance(recon_req: ReconRequest):
    """Start reconnaissance on a target"""
    try:
        logger.info(f"Starting recon on target: {recon_req.target}")
        recon_id = f"recon_{uuid.uuid4().hex[:12]}"

        return {
            "recon_id": recon_id,
            "target": recon_req.target,
            "modules": recon_req.modules,
            "status": "queued",
            "progress": 0,
            "timestamp": datetime.utcnow().isoformat(),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Recon error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to start reconnaissance")


@app.get("/api/v1/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a task"""
    if not task_id or len(task_id) < 3:
        raise HTTPException(status_code=400, detail="Invalid task ID")

    return {
        "task_id": task_id,
        "status": "processing",
        "progress": 50,
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
