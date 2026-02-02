"""FastAPI Gateway for CTIAS Lab"""

import os
import sys
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add modules to path
sys.path.insert(
    0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "modules-python"))
)

try:
    from ioc_analyzer import IOCAnalyzer
    from threat_feed import ThreatFeed
except ImportError:
    # Fallback if modules aren't available
    IOCAnalyzer = None
    ThreatFeed = None

app = FastAPI(
    title="CTIAS Lab API",
    description="Cyber Threat Intelligence & Attack Surface Lab API Gateway",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
ioc_analyzer = IOCAnalyzer() if IOCAnalyzer else None
threat_feed = ThreatFeed() if ThreatFeed else None


class IOCRequest(BaseModel):
    ioc: str


class BatchIOCRequest(BaseModel):
    iocs: List[str]


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "CTIAS Lab API",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": [
            "/health",
            "/api/ioc/analyze",
            "/api/ioc/batch",
            "/api/threats/feeds",
            "/api/threats/indicators",
        ],
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "services": {
            "ioc_analyzer": "available" if ioc_analyzer else "unavailable",
            "threat_feed": "available" if threat_feed else "unavailable",
        },
    }


@app.post("/api/ioc/analyze")
async def analyze_ioc(request: IOCRequest):
    """Analyze a single IOC"""
    if not ioc_analyzer:
        raise HTTPException(status_code=503, detail="IOC Analyzer service unavailable")

    result = ioc_analyzer.analyze(request.ioc)
    return result


@app.post("/api/ioc/batch")
async def batch_analyze_ioc(request: BatchIOCRequest):
    """Analyze multiple IOCs"""
    if not ioc_analyzer:
        raise HTTPException(status_code=503, detail="IOC Analyzer service unavailable")

    results = ioc_analyzer.batch_analyze(request.iocs)
    return {"results": results, "count": len(results)}


@app.get("/api/threats/feeds")
async def get_threat_feeds():
    """Get configured threat feeds"""
    if not threat_feed:
        raise HTTPException(status_code=503, detail="Threat Feed service unavailable")

    feeds = threat_feed.get_feeds()
    return {"feeds": feeds, "count": len(feeds)}


@app.get("/api/threats/indicators")
async def get_threat_indicators():
    """Get threat indicators from feeds"""
    if not threat_feed:
        raise HTTPException(status_code=503, detail="Threat Feed service unavailable")

    indicators = threat_feed.fetch_indicators()
    return {"indicators": indicators, "count": len(indicators)}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
