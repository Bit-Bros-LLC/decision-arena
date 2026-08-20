from __future__ import annotations

import os
from dataclasses import dataclass


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class BackendConfig:
    database_url: str
    zitadel_issuer: str
    zitadel_audience: str
    zitadel_discovery_url: str
    zitadel_allowed_algorithms: list[str]
    zitadel_roles_claim: str
    zitadel_jwks_cache_ttl_seconds: int
    cors_origins: list[str]


def get_backend_config() -> BackendConfig:
    issuer = os.getenv("ZITADEL_ISSUER", "").strip()
    discovery_url = os.getenv("ZITADEL_DISCOVERY_URL", "").strip()
    if not discovery_url and issuer:
        discovery_url = f"{issuer.rstrip('/')}/.well-known/openid-configuration"

    return BackendConfig(
        database_url=os.getenv("DATABASE_URL", "sqlite:///./decision_arena.db").strip(),
        zitadel_issuer=issuer,
        zitadel_audience=os.getenv("ZITADEL_AUDIENCE", "").strip(),
        zitadel_discovery_url=discovery_url,
        zitadel_allowed_algorithms=_split_csv(
            os.getenv("ZITADEL_ALLOWED_ALGORITHMS", "RS256")
        ),
        zitadel_roles_claim=os.getenv("ZITADEL_ROLES_CLAIM", "role").strip(),
        zitadel_jwks_cache_ttl_seconds=int(
            os.getenv("ZITADEL_JWKS_CACHE_TTL_SECONDS", "300")
        ),
        cors_origins=_split_csv(os.getenv("BACKEND_CORS_ORIGINS", "")),
    )


def validate_backend_config(config: BackendConfig) -> None:
    missing = []
    if not config.zitadel_issuer:
        missing.append("ZITADEL_ISSUER")
    if not config.zitadel_audience:
        missing.append("ZITADEL_AUDIENCE")
    if not config.zitadel_discovery_url:
        missing.append("ZITADEL_DISCOVERY_URL or ZITADEL_ISSUER")
    if not config.cors_origins:
        missing.append("BACKEND_CORS_ORIGINS")
    if not config.zitadel_allowed_algorithms:
        missing.append("ZITADEL_ALLOWED_ALGORITHMS")
    if not config.zitadel_roles_claim:
        missing.append("ZITADEL_ROLES_CLAIM")

    if missing:
        joined = ", ".join(missing)
        raise RuntimeError(
            f"Backend authentication configuration is incomplete. Missing: {joined}"
        )
