from __future__ import annotations
import os, time
from typing import Any, Dict, Optional

import httpx
from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
from dotenv import load_dotenv
load_dotenv()

REGION = os.getenv("COGNITO_REGION")
USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID")
APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID")
JWKS_URL = os.getenv("COGNITO_JWKS_URL") or f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}/.well-known/jwks.json"
ISSUER = f"https://cognito-idp.{REGION}.amazonaws.com/{USER_POOL_ID}"

_JWKS: Dict[str, Any] | None = None
_JWKS_EXP: float = 0
_JWKS_TTL = 3600

async def _get_jwks() -> Dict[str, Any]:
    global _JWKS, _JWKS_EXP
    now = time.time()
    if _JWKS and now < _JWKS_EXP:
        return _JWKS
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(JWKS_URL)
        resp.raise_for_status()
        _JWKS = resp.json()
        _JWKS_EXP = now + _JWKS_TTL
        return _JWKS

def _find_key(jwks: Dict[str, Any], kid: str) -> Optional[Dict[str, Any]]:
    for k in jwks.get("keys", []):
        if k.get("kid") == kid:
            return k
    return None

async def cognito_user(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization header")

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header")

    token = parts[1]
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token header")

    jwks = await _get_jwks()
    key = _find_key(jwks, unverified_header.get("kid", ""))
    if not key:
        # force refresh once in case of rotation
        global _JWKS_EXP
        _JWKS_EXP = 0
        jwks = await _get_jwks()
        key = _find_key(jwks, unverified_header.get("kid", ""))
        if not key:
            raise HTTPException(status_code=401, detail="Signing key not found")

    try:
        claims = jwt.decode(
            token,
            key,
            algorithms=[unverified_header.get("alg", "RS256")],
            audience=APP_CLIENT_ID,
            issuer=ISSUER,
            options={"verify_at_hash": False},
        )
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

    if claims.get("token_use") not in {"id", "access"}:
        raise HTTPException(status_code=401, detail="Unsupported token type")

    return {
        "sub": claims.get("sub"),
        "email": claims.get("email"),
        "phone_number": claims.get("phone_number"),
        "username": claims.get("cognito:username"),
        "groups": claims.get("cognito:groups", []),
        "token_use": claims.get("token_use"),
    }
