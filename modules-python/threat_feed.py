"""Threat Feed Module for CTIAS Lab"""

from datetime import datetime
from typing import Any, Dict, List


class ThreatFeed:
    """Manage and aggregate threat intelligence feeds"""

    def __init__(self):
        self.feeds = []
        self.cache = {}
        self.last_update = None

    def add_feed(self, feed_name: str, feed_url: str, feed_type: str = "generic"):
        """Add a new threat feed source"""
        feed = {
            "name": feed_name,
            "url": feed_url,
            "type": feed_type,
            "added": datetime.now().isoformat(),
            "status": "active",
        }
        self.feeds.append(feed)
        return feed

    def get_feeds(self) -> List[Dict[str, Any]]:
        """Get all configured threat feeds"""
        return self.feeds

    def update_feed(self, feed_name: str, data: Dict[str, Any]):
        """Update threat feed data"""
        self.cache[feed_name] = {"data": data, "updated": datetime.now().isoformat()}
        self.last_update = datetime.now()

    def get_cached_data(self, feed_name: str) -> Dict[str, Any]:
        """Retrieve cached feed data"""
        return self.cache.get(feed_name, {})

    def aggregate_threats(self) -> List[Dict[str, Any]]:
        """Aggregate threat data from all feeds"""
        threats = []
        for feed_name, feed_data in self.cache.items():
            if "data" in feed_data:
                for threat in feed_data["data"].get("threats", []):
                    threat["source"] = feed_name
                    threats.append(threat)
        return threats

    def clear_cache(self):
        """Clear all cached feed data"""
        self.cache = {}
        self.last_update = None

    def remove_feed(self, feed_name: str) -> bool:
        """Remove a threat feed"""
        for i, feed in enumerate(self.feeds):
            if feed["name"] == feed_name:
                self.feeds.pop(i)
                if feed_name in self.cache:
                    del self.cache[feed_name]
                return True
        return False
