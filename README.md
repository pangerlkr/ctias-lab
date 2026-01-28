# Cyber Threat Intelligence & Attack Surface Lab (CTIAS Lab)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/Python-3.9%2B-blue)](https://www.python.org/downloads/)
[![Java 11+](https://img.shields.io/badge/Java-11%2B-red)](https://www.oracle.com/java/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue)](https://www.docker.com/)

A **multi-language, extensible cybersecurity platform** for threat analysis, IOC enrichment, attack surface reconnaissance, and collaborative threat detection. Built with **Python, Java, JavaScript, HTML, and CSS** for enterprise-grade threat intelligence and detection operations.

---

## Project Goals

CTIAS Lab empowers security analysts, students, and researchers to:

- **Run collaborative threat analysis** in a controlled, sandboxed environment
- **Analyze Indicators of Compromise (IOCs)** using ML and rule-based detection
- **Perform attack surface reconnaissance** with visual mapping and recon modules
- **Build custom detection rules** and contribute them back to the community
- **Learn cybersecurity** through guided labs and real-world attack scenarios
- **Integrate multiple languages** seamlessly into a single threat intel platform

---

## Key Features

### 1. Attack Surface Mapping
- Discover and map target infrastructure (domains, IPs, services)
- Visual graph representation of hosts, ports, and vulnerabilities
- Multi-stage recon modules: DNS, WHOIS, SSL/TLS fingerprinting, port scanning

### 2. IOC Analyzer
- Submit IPs, domains, URLs, file hashes for analysis
- Parallel processing with Python, Java, and JS modules
- Reputation checks, malware correlation, and threat feeds

### 3. Event & Log Processing
- Upload logs (Apache, Nginx, Windows, syslog, etc.)
- Parse and normalize events with Java-based engines
- Real-time detection with ML anomaly detectors and rule engines

### 4. Rule & Playbook Studio
- YAML/JSON rule editor with live validation
- Sigma-like rule format for portability
- Test rules against sample data before deployment

### 5. Training Lab
- Guided cybersecurity exercises with real attack traces
- Interactive scenarios demonstrating detection and response
- Sample datasets, playbooks, and best practices

### 6. Multi-Language Architecture
- **Python**: ML models, PCAP analysis, IOC enrichment, anomaly detection
- **Java**: Log normalization, rule engines, high-throughput processing
- **JavaScript**: Browser-based analyzers, URL deobfuscation, client-side crypto
- **Go/Rust (Optional)**: Fast scanners, OSINT collectors, performance-critical tasks

---

## Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- OR: Python 3.9+, Java 11+, Node.js 16+, PostgreSQL 13+
- Git

### Clone & Deploy

```bash
git clone https://github.com/pangerlkr/ctias-lab.git
cd ctias-lab
docker-compose up -d
```

Then open: **http://localhost:3000** (Frontend) and **http://localhost:8000** (API)

---

## Project Structure

```
ctias-lab/
  frontend/                 # React/Vue SPA + UI components
  gateway/                  # Python FastAPI backend
  modules-java/             # Java microservices
  modules-python/           # Python analysis modules
  modules-js/               # JavaScript/TypeScript analyzers
  rules/                    # Community-contributed detection rules
  scenarios/                # Training labs & sample datasets
  docs/                     # Architecture, operations, contributing
  docker/                   # Docker Compose & Dockerfiles
  tests/                    # Integration & unit tests
  CONTRIBUTING.md
  SECURITY.md
  LICENSE (MIT)
```

See [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for detailed system design.

---

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|----------|
| **Frontend** | React/Vue, HTML5, CSS3, Chart.js | Web UI for analysts |
| **Gateway API** | Python FastAPI | REST/GraphQL API, job orchestration |
| **Backend Services** | Java, Spring Boot | High-performance processing |
| **ML/Analysis** | Python, scikit-learn, pandas | Anomaly detection, enrichment |
| **Web Tools** | JavaScript, TypeScript | Browser-based analyzers |
| **Database** | PostgreSQL | Events, rules, users |
| **Cache/Queue** | Redis | Job queue, session cache |
| **Containerization** | Docker, Docker Compose | Reproducible deployments |
| **CI/CD** | GitHub Actions | Automated testing & releases |

---

## Contributing

We welcome contributions from security professionals, data scientists, and developers. See [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- How to add new detection modules in Java, Python, or JavaScript
- Language-specific style guides
- Testing & CI/CD requirements
- Pull request workflow

### Quick Contribution Paths

**For Security Engineers**: Add detection rules, log parsers, and playbooks  
**For Data Scientists**: Implement ML models and anomaly detectors  
**For Full-Stack Developers**: Enhance UI, add API endpoints, optimize performance  
**For DevOps Engineers**: Create Kubernetes manifests and CI/CD pipelines  

---

## Documentation

- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design, module contracts, data flow
- **[THREAT_MODELS.md](./docs/THREAT_MODELS.md)** - Security assumptions, threat scenarios
- **[OPERATIONS.md](./docs/OPERATIONS.md)** - Deploy, monitor, scale, troubleshoot
- **[API_REFERENCE.md](./docs/API_REFERENCE.md)** - Gateway endpoints and schemas
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Developer onboarding guide

---

## Security & Ethics

**CTIAS Lab is designed for defensive and educational purposes only.**

- All reconnaissance and testing occurs in a **controlled lab environment**
- Do **NOT** use this platform for unauthorized testing
- Always obtain proper authorization before running any attack simulations
- Comply with local laws and regulations
- See **[SECURITY.md](./SECURITY.md)** for responsible disclosure

---

## Contact

**Project Maintainer**: Graceme Kamei (@pangerlkr)  
**Organization**: NEXUSCIPHERGUARD INDIA  
**Contact**: contact@pangerlkr.link  
**Location**: Kohima, Nagaland, India  

---

## License

CTIAS Lab is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

**Star this repo and contribute to make it better!**
