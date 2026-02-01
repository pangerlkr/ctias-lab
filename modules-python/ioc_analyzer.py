"""IOC Analyzer Module for CTIAS Lab"""
import re
import hashlib
from typing import Dict, List, Any


class IOCAnalyzer:
    """Analyze Indicators of Compromise (IOCs)"""

    def __init__(self):
        self.ioc_types = {
            'ip': r'^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$',
            'domain': r'^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\\.[a-zA-Z]{2,}$',
            'url': r'^https?://[^\\s]+$',
            'md5': r'^[a-fA-F0-9]{32}$',
            'sha1': r'^[a-fA-F0-9]{40}$',
            'sha256': r'^[a-fA-F0-9]{64}$',
        }

    def identify_ioc_type(self, ioc: str) -> str:
        """Identify the type of IOC"""
        for ioc_type, pattern in self.ioc_types.items():
            if re.match(pattern, ioc.strip()):
                return ioc_type
        return 'unknown'

    def analyze(self, ioc: str) -> Dict[str, Any]:
        """Analyze an IOC and return threat intelligence"""
        ioc_type = self.identify_ioc_type(ioc)
        
        result = {
            'ioc': ioc,
            'type': ioc_type,
            'risk_score': self._calculate_risk_score(ioc, ioc_type),
            'metadata': self._get_metadata(ioc, ioc_type)
        }
        
        return result

    def _calculate_risk_score(self, ioc: str, ioc_type: str) -> int:
        """Calculate risk score (0-100) based on IOC characteristics"""
        # Placeholder risk scoring logic
        base_score = 50
        
        if ioc_type == 'unknown':
            return 0
        
        # Add risk factors
        if ioc_type in ['md5', 'sha1', 'sha256']:
            base_score += 20  # File hashes are potentially malicious
        
        return min(base_score, 100)

    def _get_metadata(self, ioc: str, ioc_type: str) -> Dict[str, Any]:
        """Extract metadata from IOC"""
        metadata = {'analyzed': True}
        
        if ioc_type in ['md5', 'sha1', 'sha256']:
            metadata['hash_algorithm'] = ioc_type.upper()
        elif ioc_type == 'ip':
            metadata['ip_version'] = 'IPv4'
        
        return metadata

    def batch_analyze(self, iocs: List[str]) -> List[Dict[str, Any]]:
        """Analyze multiple IOCs"""
        return [self.analyze(ioc) for ioc in iocs]
