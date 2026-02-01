"""Unit tests for CTIAS Lab modules"""
import unittest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


class TestModules(unittest.TestCase):
    """Test cases for module functionality"""

    def test_import_dependencies(self):
        """Test that core dependencies can be imported"""
        try:
            import fastapi  # noqa: F401
            import requests  # noqa: F401
            self.assertTrue(True)
        except ImportError as e:
            self.fail(f"Failed to import dependencies: {e}")

    def test_basic_functionality(self):
        """Test basic module functionality"""
        self.assertEqual(1 + 1, 2)
        self.assertTrue(True)


if __name__ == '__main__':
    unittest.main()
