"""
Reusable FastAPI dependencies — primarily auth guards.

`get_current_user` decodes the JWT and loads a lightweight identity dict.
`require_role` is a dependency factory for role-based access control (RBAC),
so endpoints declare their required role declaratively:　Depends(require_role("admin")).
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"id": payload.get("sub"), "role": payload.get("role")}


def require_role(*allowed_roles: str):
    """
    Usage: Depends(require_role("admin")) or Depends(require_role("admin", "faculty"))
    """

    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires one of roles: {allowed_roles}",
            )
        return current_user

    return role_checker
