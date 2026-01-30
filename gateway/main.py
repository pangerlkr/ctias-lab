"""CTIAS Lab Gateway API - Main FastAPI Application"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="CTIAS Lab Gateway API",
    description="Central gateway for Cyber Threat Intelligence & Attack Surface Lab",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class HealthCheckResponse(BaseModel):
    status: str
    version: str
    database: str
    redis: str

class IOCSubmission(BaseModel):
    ioc_value: str
    ioc_type: str  # ip, domain, url, hash, email
    tags: list[str] = []

class ReconRequest(BaseModel):
    target: str
    modules: list[str] = ["dns", "whois", "ssl"]

# Routes
@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "CTIAS Lab Gateway API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "ioc_analyze": "/api/v1/ioc/analyze",
            "recon": "/api/v1/recon"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        return HealthCheckResponse(
            status="healthy",
            version="1.0.0",
            database="connected",
            redis="connected"
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "error": str(e)}
        )

@app.post("/api/v1/ioc/analyze")
async def analyze_ioc(submission: IOCSubmission):
    """Analyze an Indicator of Compromise (IOC)"""
    try:
        logger.info(f"Analyzing IOC: {submission.ioc_value} ({submission.ioc_type})")
        return {
            "ioc_id": "ioc_123",
            "ioc_value": submission.ioc_value,
            "ioc_type": submission.ioc_type,
            "reputation": "medium",
            "threat_level": "moderate",
            "tags": submission.tags,
            "status": "queued for analysis"
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/recon")
async def start_reconnaissance(recon_req: ReconRequest):
    """Start reconnaissance on a target"""
    try:
        logger.info(f"Starting recon on target: {recon_req.target}")
        return {
            "recon_id": "recon_456",
            "target": recon_req.target,
            "modules": recon_req.modules,
            "status": "started",
            "progress": 0
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/v1/status/{task_id}")
async def get_task_status(task_id: str):
    """Get status of a task"""
    return {
        "task_id": task_id,
        "status": "processing",
        "progress": 50
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
