from fastapi import APIRouter, Depends
from api.deps.auth import cognito_user

router = APIRouter()

@router.get("/")
async def me(user = Depends(cognito_user)):
    return {"user": user}
