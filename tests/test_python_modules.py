"""Tests for Python modules (IOC Analyzer and Threat Feed)"""

import sys
from pathlib import Path

import pytest

# Add modules-python to path
sys.path.insert(0, str(Path(__file__).parent.parent / "modules-python"))

from ioc_analyzer import IOCAnalyzer  # noqa: E402
from threat_feed import ThreatFeed  # noqa: E402


class TestIOCAnalyzer:
    """Test IOC Analyzer module"""

    def setup_method(self):
        """Setup test fixtures"""
        self.analyzer = IOCAnalyzer()

    def test_identify_ipv4(self):
        """Test IPv4 address identification"""
        result = self.analyzer.identify_ioc_type("192.168.1.1")
        assert result == "ip"

    def test_identify_domain(self):
        """Test domain identification"""
        result = self.analyzer.identify_ioc_type("example.com")
        assert result == "domain"

    def test_identify_url(self):
        """Test URL identification"""
        result = self.analyzer.identify_ioc_type("https://example.com/path")
        assert result == "url"

    def test_identify_md5_hash(self):
        """Test MD5 hash identification"""
        result = self.analyzer.identify_ioc_type("d41d8cd98f00b204e9800998ecf8427e")
        assert result == "md5"

    def test_identify_sha1_hash(self):
        """Test SHA1 hash identification"""
        result = self.analyzer.identify_ioc_type(
            "da39a3ee5e6b4b0d3255bfef95601890afd80709"
        )
        assert result == "sha1"

    def test_identify_sha256_hash(self):
        """Test SHA256 hash identification"""
        result = self.analyzer.identify_ioc_type(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )
        assert result == "sha256"

    def test_identify_unknown(self):
        """Test unknown IOC type"""
        result = self.analyzer.identify_ioc_type("invalid_ioc")
        assert result == "unknown"

    def test_analyze_ip(self):
        """Test analyzing an IP address"""
        result = self.analyzer.analyze("8.8.8.8")
        assert result["ioc"] == "8.8.8.8"
        assert result["type"] == "ip"
        assert "risk_score" in result
        assert "metadata" in result

    def test_analyze_domain(self):
        """Test analyzing a domain"""
        result = self.analyzer.analyze("google.com")
        assert result["ioc"] == "google.com"
        assert result["type"] == "domain"
        assert result["risk_score"] >= 0

    def test_analyze_hash(self):
        """Test analyzing a file hash"""
        result = self.analyzer.analyze("d41d8cd98f00b204e9800998ecf8427e")
        assert result["type"] == "md5"
        assert result["risk_score"] > 50  # Hashes have higher base score

    def test_batch_analyze(self):
        """Test batch analysis"""
        iocs = ["8.8.8.8", "example.com", "d41d8cd98f00b204e9800998ecf8427e"]
        results = self.analyzer.batch_analyze(iocs)
        assert len(results) == 3
        assert all("type" in r for r in results)

    def test_risk_score_range(self):
        """Test that risk scores are within valid range"""
        result = self.analyzer.analyze("8.8.8.8")
        assert 0 <= result["risk_score"] <= 100


class TestThreatFeed:
    """Test Threat Feed module"""

    def setup_method(self):
        """Setup test fixtures"""
        self.feed = ThreatFeed()

    def test_add_feed(self):
        """Test adding a threat feed"""
        feed = self.feed.add_feed("test_feed", "https://example.com/feed", "generic")
        assert feed["name"] == "test_feed"
        assert feed["url"] == "https://example.com/feed"
        assert feed["type"] == "generic"
        assert feed["status"] == "active"

    def test_get_feeds(self):
        """Test getting all feeds"""
        self.feed.add_feed("feed1", "https://example.com/feed1")
        self.feed.add_feed("feed2", "https://example.com/feed2")
        feeds = self.feed.get_feeds()
        assert len(feeds) == 2

    def test_update_feed(self):
        """Test updating feed data"""
        self.feed.add_feed("test_feed", "https://example.com/feed")
        data = {"threats": [{"ip": "1.2.3.4", "type": "malicious"}]}
        self.feed.update_feed("test_feed", data)
        cached = self.feed.get_cached_data("test_feed")
        assert "data" in cached
        assert cached["data"] == data

    def test_get_cached_data_nonexistent(self):
        """Test getting cached data for nonexistent feed"""
        cached = self.feed.get_cached_data("nonexistent")
        assert cached == {}

    def test_aggregate_threats(self):
        """Test aggregating threats from multiple feeds"""
        self.feed.add_feed("feed1", "https://example.com/feed1")
        self.feed.add_feed("feed2", "https://example.com/feed2")

        self.feed.update_feed(
            "feed1", {"threats": [{"ip": "1.2.3.4", "severity": "high"}]}
        )
        self.feed.update_feed(
            "feed2", {"threats": [{"domain": "evil.com", "severity": "medium"}]}
        )

        threats = self.feed.aggregate_threats()
        assert len(threats) == 2
        assert any(t.get("source") == "feed1" for t in threats)
        assert any(t.get("source") == "feed2" for t in threats)

    def test_clear_cache(self):
        """Test clearing cache"""
        self.feed.add_feed("test_feed", "https://example.com/feed")
        self.feed.update_feed("test_feed", {"data": "test"})
        self.feed.clear_cache()
        cached = self.feed.get_cached_data("test_feed")
        assert cached == {}

    def test_remove_feed(self):
        """Test removing a feed"""
        self.feed.add_feed("test_feed", "https://example.com/feed")
        result = self.feed.remove_feed("test_feed")
        assert result is True
        assert len(self.feed.get_feeds()) == 0

    def test_remove_nonexistent_feed(self):
        """Test removing a nonexistent feed"""
        result = self.feed.remove_feed("nonexistent")
        assert result is False

    def test_fetch_indicators(self):
        """Test fetching indicators"""
        self.feed.add_feed("test_feed", "https://example.com/feed")
        self.feed.update_feed(
            "test_feed", {"threats": [{"ip": "1.2.3.4", "severity": "high"}]}
        )
        indicators = self.feed.fetch_indicators()
        assert len(indicators) == 1
        assert indicators[0]["ip"] == "1.2.3.4"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
