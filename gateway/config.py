"""Configuration management for CTIAS Lab"""

import os
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Database
    database_url: str = Field(
        default="postgresql://ctias:ctias@postgres:5432/ctias_lab",
        env="DATABASE_URL",
    )

    # Redis
    redis_url: str = Field(default="redis://redis:6379/0", env="REDIS_URL")

    # JWT
    jwt_secret: str = Field(
        default="change_me_in_production_minimum_32_characters", env="JWT_SECRET"
    )
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    jwt_expiration_minutes: int = Field(default=60, env="JWT_EXPIRATION_MINUTES")

    # API
    api_host: str = Field(default="0.0.0.0", env="API_HOST")
    api_port: int = Field(default=8000, env="API_PORT")
    api_workers: int = Field(default=4, env="API_WORKERS")

    # CORS
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:8000", env="CORS_ORIGINS"
    )

    # Rate Limiting
    rate_limit_enabled: bool = Field(default=True, env="RATE_LIMIT_ENABLED")
    rate_limit_per_minute: int = Field(default=60, env="RATE_LIMIT_PER_MINUTE")

    # Environment
    environment: str = Field(default="development", env="ENVIRONMENT")
    log_level: str = Field(default="info", env="LOG_LEVEL")

    # Module Timeouts
    module_timeout: int = Field(default=30, env="MODULE_TIMEOUT")

    # External API Keys
    virustotal_api_key: Optional[str] = Field(default=None, env="VIRUSTOTAL_API_KEY")
    abuseipdb_api_key: Optional[str] = Field(default=None, env="ABUSEIPDB_API_KEY")
    shodan_api_key: Optional[str] = Field(default=None, env="SHODAN_API_KEY")

    # Sentry
    sentry_dsn: Optional[str] = Field(default=None, env="SENTRY_DSN")

    class Config:
        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    """Get application settings"""
    return Settings()
