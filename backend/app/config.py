from functools import lru_cache
from typing import Annotated

from pydantic import AliasChoices, Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ZAPP Internal Dashboard API"
    app_env: str = "development"
    api_cors_origins: str = Field(
        default="",
        validation_alias=AliasChoices("CORS_ORIGINS", "API_CORS_ORIGINS"),
    )
    frontend_origin: str | None = Field(default=None, validation_alias="FRONTEND_ORIGIN")

    database_url: str | None = None

    zapp_api_base_url: str | None = None
    zapp_api_token: str | None = None
    zapp_api_timeout_seconds: Annotated[float, Field(gt=0)] = 10.0
    jwt_secret_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("JWT_SECRET", "JWT_SECRET_KEY"),
    )
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: Annotated[int, Field(gt=0)] = 1440
    refresh_token_expire_days: Annotated[int, Field(gt=0)] = 30
    auth_rate_limit_requests: Annotated[int, Field(gt=0)] = 8
    auth_rate_limit_window_seconds: Annotated[int, Field(gt=0)] = 300
    diagnostics_rate_limit_requests: Annotated[int, Field(gt=0)] = 20
    diagnostics_rate_limit_window_seconds: Annotated[int, Field(gt=0)] = 300

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        origins: list[str] = []
        for value in (self.frontend_origin, self.api_cors_origins):
            for origin in (value or "").split(","):
                normalized = origin.strip()
                if normalized and normalized not in origins:
                    origins.append(normalized)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
