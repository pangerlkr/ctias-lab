# Contributing to CTIAS Lab

Thank you for your interest in contributing to the Cyber Threat Intelligence & Attack Surface Lab! This document provides guidelines and instructions for contributing.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please treat all community members with respect and professionalism.

## How to Contribute

### Reporting Issues

- Check existing issues to avoid duplicates
- Provide a clear, descriptive title
- Include steps to reproduce for bugs
- Include expected vs. actual behavior
- Add relevant logs or error messages

### Suggesting Enhancements

- Use the issue tracker with "enhancement" label
- Explain the motivation and use case
- Describe the proposed solution
- List any alternative approaches

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following the code standards below
4. Add tests if applicable
5. Commit with clear messages: `git commit -m "feat: Add new detection rule"`
6. Push to your fork: `git push origin feature/your-feature`
7. Submit a PR with a clear description

## Adding New Modules

### Python Modules (modules-python/)

**Structure:**
```
modules-python/your-module/
  src/
    your_module.py
    __init__.py
  requirements.txt
  README.md
  tests/
    test_your_module.py
```

**Requirements:**
- Use Python 3.9+
- Include docstrings for all functions
- Add type hints
- Include unit tests with `pytest`
- Use `black` for code formatting
- Use `isort` for import sorting

**Example Module:**
```python
"""IOC enrichment module for CTIAS Lab."""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def enrich_ioc(ioc: str, ioc_type: str) -> Dict[str, Any]:
    """Enrich an IOC with threat intelligence.
    
    Args:
        ioc: The indicator of compromise
        ioc_type: Type (ip, domain, url, hash)
        
    Returns:
        Dictionary with enrichment data
    """
    # Implementation here
    pass
```

### Java Modules (modules-java/)

**Structure:**
```
modules-java/your-module/
  src/main/java/com/ctias/
  src/test/java/com/ctias/
  pom.xml
  README.md
```

**Requirements:**
- Use Java 11+
- Maven for dependency management
- Include JavaDoc for public classes
- Add unit tests with JUnit 5
- Follow Google Java Style Guide
- Include integration tests

### JavaScript/TypeScript Modules (modules-js/)

**Structure:**
```
modules-js/your-module/
  src/
    index.ts
    your-analyzer.ts
  tests/
    your-analyzer.test.ts
  package.json
  README.md
```

**Requirements:**
- Use TypeScript
- Use ES6+ syntax
- Include JSDoc comments
- Add tests with Jest
- Use ESLint configuration
- Format with Prettier

## Detection Rules

### Adding Rules (rules/ directory)

1. Create a file: `rules/sigma/your-rule.yml`
2. Use Sigma format:

```yaml
title: Suspicious Process Creation
description: Detects suspicious process creation patterns
logsource:
  product: windows
  service: sysmon
detection:
  process_creation:
    EventID: 1
    Image|endswith: '\\cmd.exe'
    CommandLine|contains:
      - 'whoami'
      - 'ipconfig'
  condition: process_creation
level: medium
status: test
references:
  - https://example.com/reference
author: Your Name
date: 2025-01-28
```

3. Submit PR to `rules/` with clear description

## Code Standards

### Python
```bash
# Install dev tools
pip install black isort pytest flake8

# Format code
black modules-python/
isort modules-python/

# Run tests
pytest modules-python/ -v

# Lint
flake8 modules-python/
```

### Java
```bash
# Build and test
cd modules-java/your-module
mvn clean test
mvn checkstyle:check
```

### JavaScript/TypeScript
```bash
# Install dependencies
npm install

# Format
npm run format

# Lint
npm run lint

# Test
npm test
```

## Documentation

- Update README.md if adding new features
- Include examples for new modules
- Add docstrings to all functions/methods
- Update API_REFERENCE.md for API changes
- Create or update scenario documentation

## Commit Message Convention

Follow Conventional Commits:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions/changes
- `chore`: Build, dependencies

**Examples:**
```
feat(ioc-enrichment): Add VirusTotal integration

Implements IP reputation lookup via VirusTotal API.
Includes caching for performance.

Closes #123
```

## Review Process

1. A maintainer will review your PR
2. Provide feedback or request changes
3. Update code based on feedback
4. Re-request review when ready
5. Maintainer merges when approved

## Becoming a Maintainer

Active contributors who consistently submit high-quality contributions may be invited to become maintainers. Maintainers have commit access and help review PRs.

## Questions?

- Check existing issues and discussions
- Email: contact@nexuscipherguard.in
- Twitter: @panger_lkr

**Thank you for contributing to make CTIAS Lab better!**
