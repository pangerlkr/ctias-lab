"""Comprehensive tests for CTIAS Lab Gateway API"""

import sys
from pathlib import Path

import pytest

# Add gateway to path
sys.path.insert(0, str(Path(__file__).parent.parent / "gateway"))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


class TestHealthCheck:
    """Test health check endpoints"""

    def test_root_endpoint(self):
        """Test root endpoint returns correct information"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert data["version"] == "1.0.0"
        assert "endpoints" in data

    def test_health_endpoint(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "services" in data
        assert "timestamp" in data


class TestIOCAnalysis:
    """Test IOC analysis endpoints"""

    def test_analyze_valid_ip(self):
        """Test analyzing a valid IP address"""
        payload = {"ioc_value": "192.168.1.1", "ioc_type": "ip", "tags": ["test"]}
        response = client.post("/api/v1/ioc/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "ioc_id" in data
        assert data["ioc_value"] == "192.168.1.1"
        assert data["ioc_type"] == "ip"
        assert data["risk_score"] >= 0

    def test_analyze_valid_domain(self):
        """Test analyzing a valid domain"""
        payload = {"ioc_value": "example.com", "ioc_type": "domain", "tags": []}
        response = client.post("/api/v1/ioc/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["ioc_type"] == "domain"

    def test_analyze_valid_hash(self):
        """Test analyzing a valid hash"""
        payload = {
            "ioc_value": "d41d8cd98f00b204e9800998ecf8427e",
            "ioc_type": "md5",
            "tags": [],
        }
        response = client.post("/api/v1/ioc/analyze", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["ioc_type"] == "md5"

    def test_analyze_invalid_ioc_type(self):
        """Test that invalid IOC type is rejected"""
        payload = {"ioc_value": "test", "ioc_type": "invalid_type", "tags": []}
        response = client.post("/api/v1/ioc/analyze", json=payload)
        assert response.status_code == 422  # Validation error

    def test_analyze_empty_ioc_value(self):
        """Test that empty IOC value is rejected"""
        payload = {"ioc_value": "", "ioc_type": "ip", "tags": []}
        response = client.post("/api/v1/ioc/analyze", json=payload)
        assert response.status_code == 422  # Validation error

    def test_analyze_missing_fields(self):
        """Test that missing required fields are rejected"""
        payload = {"ioc_value": "test"}
        response = client.post("/api/v1/ioc/analyze", json=payload)
        assert response.status_code == 422  # Validation error


class TestReconnaissance:
    """Test reconnaissance endpoints"""

    def test_start_recon_valid_target(self):
        """Test starting reconnaissance on a valid target"""
        payload = {"target": "example.com", "modules": ["dns", "whois"]}
        response = client.post("/api/v1/recon", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "recon_id" in data
        assert data["target"] == "example.com"
        assert data["modules"] == ["dns", "whois"]
        assert data["status"] == "queued"

    def test_start_recon_default_modules(self):
        """Test starting reconnaissance with default modules"""
        payload = {"target": "example.com"}
        response = client.post("/api/v1/recon", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "modules" in data
        assert len(data["modules"]) > 0

    def test_start_recon_invalid_module(self):
        """Test that invalid modules are rejected"""
        payload = {"target": "example.com", "modules": ["invalid_module"]}
        response = client.post("/api/v1/recon", json=payload)
        assert response.status_code == 422  # Validation error

    def test_start_recon_empty_target(self):
        """Test that empty target is rejected"""
        payload = {"target": "", "modules": ["dns"]}
        response = client.post("/api/v1/recon", json=payload)
        assert response.status_code == 422  # Validation error


class TestTaskStatus:
    """Test task status endpoints"""

    def test_get_task_status_valid_id(self):
        """Test getting status for a valid task ID"""
        response = client.get("/api/v1/status/recon_abc123")
        assert response.status_code == 200
        data = response.json()
        assert data["task_id"] == "recon_abc123"
        assert "status" in data
        assert "progress" in data

    def test_get_task_status_invalid_id(self):
        """Test that invalid task ID is rejected"""
        response = client.get("/api/v1/status/ab")
        assert response.status_code == 400


class TestAPIDocumentation:
    """Test API documentation endpoints"""

    def test_openapi_docs_accessible(self):
        """Test that OpenAPI docs are accessible"""
        response = client.get("/docs")
        assert response.status_code == 200

    def test_redoc_accessible(self):
        """Test that ReDoc is accessible"""
        response = client.get("/redoc")
        assert response.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
