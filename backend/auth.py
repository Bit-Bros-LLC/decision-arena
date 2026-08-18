from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import get_backend_config
from database import UserRow, get_db

EXTERNAL_AUTH_PASSWORD_SENTINEL = "__zitadel_managed__"

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class AuthIdentity:
    subject: str
    issuer: str
    email: str | None
    display_name: str | None
    roles: list[str]
    claims: dict[str, Any]


class ZitadelTokenValidator:
    def __init__(self):
        config = get_backend_config()
        self.issuer = config.zitadel_issuer
        self.audience = config.zitadel_audience
        self.discovery_url = config.zitadel_discovery_url
        self.algorithms = config.zitadel_allowed_algorithms
        self.roles_claim = config.zitadel_roles_claim
        self.jwks_cache_ttl_seconds = config.zitadel_jwks_cache_ttl_seconds
        self._jwks: dict[str, Any] | None = None
        self._jwks_fetched_at = 0.0
        self._discovery_document: dict[str, Any] | None = None

    def validate_access_token(self, token: str) -> AuthIdentity:
        if not self.issuer or not self.audience or not self.discovery_url:
            raise HTTPException(
                status_code=500,
                detail="ZITADEL authentication is not fully configured",
            )

        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if not kid:
                raise credentials_exception
            key = self._get_signing_key(kid)
            payload = jwt.decode(
                token,
                key,
                algorithms=self.algorithms,
                audience=self.audience,
                issuer=self.issuer,
            )
        except JWTError:
            raise credentials_exception

        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            raise credentials_exception

        merged_claims = dict(payload)
        if not _claims_have_identity_profile(merged_claims) or not _claims_have_roles(
            merged_claims, self.roles_claim
        ):
            userinfo = self._get_userinfo(token)
            merged_claims.update(userinfo)

        return AuthIdentity(
            subject=subject,
            issuer=self.issuer,
            email=merged_claims.get("email"),
            display_name=_extract_display_name(merged_claims),
            roles=_extract_roles(merged_claims, self.roles_claim),
            claims=merged_claims,
        )

    def _get_signing_key(self, kid: str) -> dict[str, Any]:
        jwks = self._get_jwks()
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                return key
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    def _get_jwks(self) -> dict[str, Any]:
        now = time.time()
        if self._jwks and (now - self._jwks_fetched_at) < self.jwks_cache_ttl_seconds:
            return self._jwks

        try:
            discovery = self._get_discovery_document()
            jwks_uri = discovery.get("jwks_uri")
            if not jwks_uri:
                raise RuntimeError("ZITADEL discovery document missing jwks_uri")
            with urlopen(jwks_uri, timeout=5) as response:
                self._jwks = json.load(response)
            self._jwks_fetched_at = now
        except (OSError, URLError, ValueError, RuntimeError):
            raise HTTPException(
                status_code=503,
                detail="Authentication provider metadata is unavailable",
            )

        return self._jwks or {"keys": []}

    def _get_discovery_document(self) -> dict[str, Any]:
        if self._discovery_document is not None:
            return self._discovery_document

        with urlopen(self.discovery_url, timeout=5) as response:
            self._discovery_document = json.load(response)
        return self._discovery_document

    def _get_userinfo(self, token: str) -> dict[str, Any]:
        credentials_exception = HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

        try:
            discovery = self._get_discovery_document()
            userinfo_endpoint = discovery.get("userinfo_endpoint")
            if not userinfo_endpoint:
                raise RuntimeError("ZITADEL discovery document missing userinfo_endpoint")
            request = Request(
                userinfo_endpoint,
                headers={"Authorization": f"Bearer {token}"},
            )
            with urlopen(request, timeout=5) as response:
                return json.load(response)
        except (OSError, URLError, ValueError, RuntimeError):
            raise credentials_exception


_token_validator: ZitadelTokenValidator | None = None


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_token_validator() -> ZitadelTokenValidator:
    global _token_validator
    if _token_validator is None:
        _token_validator = ZitadelTokenValidator()
    return _token_validator


def reset_token_validator_cache():
    global _token_validator
    _token_validator = None


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> UserRow:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    identity = get_token_validator().validate_access_token(credentials.credentials)
    user = _resolve_user_for_identity(identity, db)
    _attach_auth_context(user, identity)
    return user


def require_professor(user: UserRow = Depends(get_current_user)) -> UserRow:
    if not user_has_role(user, "professor"):
        raise HTTPException(status_code=403, detail="Professor access required")
    return user


def user_has_role(user: UserRow, role: str) -> bool:
    roles = getattr(user, "auth_roles", None)
    if isinstance(roles, list) and roles:
        return role in roles
    return user.role == role


def _attach_auth_context(user: UserRow, identity: AuthIdentity) -> None:
    setattr(user, "auth_provider_name", "zitadel")
    setattr(user, "auth_roles", identity.roles or ([user.role] if user.role else []))
    setattr(user, "auth_identity_subject", identity.subject)
    setattr(user, "auth_identity_issuer", identity.issuer)
    setattr(user, "auth_claims", identity.claims)


def _resolve_user_for_identity(identity: AuthIdentity, db: Session) -> UserRow:
    user = (
        db.query(UserRow)
        .filter(
            UserRow.auth_issuer == identity.issuer,
            UserRow.auth_subject == identity.subject,
        )
        .first()
    )

    normalized_email = normalize_email(identity.email) if identity.email else None
    if user is None and normalized_email:
        user = (
            db.query(UserRow)
            .filter(func.lower(UserRow.email) == normalized_email)
            .first()
        )

    if user is None:
        if not normalized_email:
            raise HTTPException(401, "Authenticated identity did not provide an email address")
        user = UserRow(
            email=normalized_email,
            password_hash=EXTERNAL_AUTH_PASSWORD_SENTINEL,
            display_name=identity.display_name or normalized_email.split("@", 1)[0],
            role=_primary_app_role(identity.roles),
            auth_provider="zitadel",
            auth_issuer=identity.issuer,
            auth_subject=identity.subject,
            account_status="active",
        )
        db.add(user)
        try:
            db.commit()
            db.refresh(user)
            return user
        except IntegrityError:
            # Concurrent first-login requests can race to provision the same local user.
            db.rollback()
            user = (
                db.query(UserRow)
                .filter(func.lower(UserRow.email) == normalized_email)
                .first()
            )
            if user is None:
                raise

    user.auth_provider = "zitadel"
    user.auth_issuer = identity.issuer
    user.auth_subject = identity.subject
    if identity.display_name and user.display_name != identity.display_name:
        user.display_name = identity.display_name
    derived_role = _primary_app_role(identity.roles)
    if user.role != derived_role:
        user.role = derived_role
    if user.account_status != "active":
        raise HTTPException(status_code=403, detail="Account is not active")
    db.commit()
    db.refresh(user)
    return user


def _extract_display_name(claims: dict[str, Any]) -> str | None:
    for key in ("name", "preferred_username", "given_name", "email"):
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def _extract_roles(claims: dict[str, Any], roles_claim: str) -> list[str]:
    raw = claims.get(roles_claim)
    if isinstance(raw, str):
        return [raw]
    if isinstance(raw, list):
        return [item for item in raw if isinstance(item, str) and item]
    return []


def _claims_have_identity_profile(claims: dict[str, Any]) -> bool:
    return any(
        isinstance(claims.get(key), str) and claims.get(key).strip()
        for key in ("email", "preferred_username", "name", "given_name")
    )


def _claims_have_roles(claims: dict[str, Any], roles_claim: str) -> bool:
    return bool(_extract_roles(claims, roles_claim))


def _primary_app_role(roles: list[str]) -> str:
    if "professor" in roles:
        return "professor"
    return "student"
