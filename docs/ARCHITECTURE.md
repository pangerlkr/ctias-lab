# CTIAS Lab Architecture

## Overview

CTIAS Lab is a multi-language, modular architecture designed for extensibility and scalability. The system uses a gateway-and-modules pattern, allowing new threat analysis capabilities to be added without modifying core infrastructure.

## System Components

### 1. Frontend (User Interface)
- **Technology**: React/Vue, HTML5, CSS3
- **Purpose**: Web-based dashboard for analysts
- **Port**: 3000
- **Features**:
  - IOC submission and analysis
  - Attack surface visualization
  - Rule editor and testing
  - Event and detection dashboard
  - Training scenarios

### 2. Gateway API (Orchestration)
- **Technology**: Python FastAPI
- **Purpose**: Central API, job orchestration, authentication
- **Port**: 8000
- **Key Responsibilities**:
  - REST/GraphQL endpoints
  - Job queue management (Redis)
  - Database interactions
  - User authentication & RBAC
  - Module invocation

### 3. Module System

#### Python Modules
- **Location**: `modules-python/`
- **Purpose**: ML, data enrichment, analysis
- **Examples**:
  - IOC enrichment (IP reputation, geoIP, threat feeds)
  - ML anomaly detection (Isolation Forest, LOF)
  - PCAP analysis and packet parsing
  - Log correlation

#### Java Modules
- **Location**: `modules-java/`
- **Purpose**: High-throughput processing, rule engines
- **Examples**:
  - Log normalization (Apache, Nginx, Windows, syslog)
  - Rule engine (Sigma-like rules)
  - Protocol parsers
  - Event aggregation

#### JavaScript Modules
- **Location**: `modules-js/`
- **Purpose**: Browser-based analysis, client-side tools
- **Examples**:
  - URL parsing and analysis
  - Phishing detection
  - JavaScript deobfuscation
  - Cryptographic demonstrations

### 4. Data Storage
- **PostgreSQL**: Events, rules, users, configurations
- **Redis**: Job queue, session cache, rate limiting

## Data Flow

### IOC Analysis Workflow
```
1. User submits IOC (IP/domain/URL/hash) via Frontend
2. Gateway receives request, stores in job queue
3. Gateway spawns tasks:
   - Python module: IP reputation lookup
   - Java module: Protocol analysis
   - JS module: URL parsing
4. Modules process in parallel, return results
5. Gateway aggregates results
6. Frontend displays unified findings
```

### Log Processing Workflow
```
1. User uploads logfile to Gateway
2. Java log-normalizer parses and normalizes events
3. Events stored in PostgreSQL
4. Python anomaly detector runs ML models
5. Java rule engine applies detection rules
6. Detections highlighted in Frontend dashboard
```

## Module Contract

All modules expose a standardized interface:

```json
{
  "/health": {
    "status": "healthy"
  },
  "/meta": {
    "name": "ioc-enrichment",
    "version": "1.0.0",
    "inputs": {"ioc": "string", "ioc_type": "enum"},
    "outputs": {"reputation": "object", "confidence": "float"}
  },
  "/run": {
    "POST": "Execute module task"
  }
}
```

## Deployment Architecture

### Docker Compose (Local Dev)
- Frontend: Port 3000
- Gateway: Port 8000
- Python modules: Port 5001+
- Java modules: Port 8080+
- PostgreSQL: Port 5432
- Redis: Port 6379

### Kubernetes (Production)
- Frontend Deployment (N replicas)
- Gateway Deployment (N replicas)
- Module Services (auto-scaling)
- StatefulSet: PostgreSQL, Redis
- Ingress: Load balancing

## Security Architecture

- **Authentication**: JWT tokens with expiration
- **Authorization**: Role-based access control (RBAC)
- **Encryption**: TLS for all communication
- **Input Validation**: All API inputs sanitized
- **Audit Logging**: All actions logged for forensics

## Extension Points

### Adding New Python Module
1. Create `modules-python/new-module/`
2. Implement `/health`, `/meta`, `/run` endpoints
3. Register in Gateway config
4. Gateway auto-discovers and exposes

### Adding New Detection Rule
1. Create `rules/sigma/new-rule.yml`
2. Submit PR for community review
3. Once merged, rule available in rule engine

## Performance Considerations

- **Parallel Processing**: Modules run in parallel for IOC analysis
- **Caching**: Results cached in Redis to avoid re-processing
- **Load Balancing**: Gateway load-balanced across N instances
- **Database Indexes**: Optimized queries on Events, Rules, Users tables
- **Module Timeouts**: 30-second timeout per module to prevent hanging

## Monitoring & Observability

- **Logging**: Structured JSON logs to stdout
- **Metrics**: Prometheus endpoints on all services
- **Tracing**: OpenTelemetry integration for distributed tracing
- **Health Checks**: Kubernetes liveness/readiness probes

## Development Workflow

1. Clone repo
2. `docker-compose up` for local stack
3. Frontend at http://localhost:3000
4. API at http://localhost:8000/docs
5. Logs via `docker-compose logs -f`
