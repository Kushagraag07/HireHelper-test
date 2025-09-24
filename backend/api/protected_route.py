from fastapi import APIRouter, Request, HTTPException
from config import settings
from db.user_crud import get_user_by_email
from jose import jwt, JWTError
from models.login import UserResponse

router = APIRouter()

def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="No authentication token provided")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@router.get("/protected")
async def protected_route(request: Request):
    user = get_current_user(request)
    return {"message": f"Hello {user['name']}, this is a protected route!"}
