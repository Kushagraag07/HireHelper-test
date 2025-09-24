# api/auth_route.py

from fastapi import APIRouter, Response, Request, HTTPException, status
from models.login import UserSignup, UserLogin, UserResponse
from security import get_password_hash, verify_password
from auth_token import create_access_token, create_refresh_token
from db.user_crud import get_user_by_email, create_user
from db.database import tokens_collection
from utils.getuser import get_current_user
from config import settings
from datetime import datetime, timedelta

router = APIRouter()

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: UserSignup, response: Response):
    if get_user_by_email(user.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)
    user_doc = {
        "email":          user.email,
        "name":           user.name,
        "hashed_password": hashed_password,
        "created_at":     datetime.utcnow(),
        "is_active":      True
    }
    user_id = create_user(user_doc)

    access_token  = create_access_token(
        {"sub": user.email},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(user.email)

    # set cookies
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )

    return {
        "message": "User created",
        "user":    UserResponse(
            id=str(user_id),
            email=user.email,
            name=user.name,
            created_at=user_doc["created_at"]
        )
    }


@router.post("/login")
async def login(user: UserLogin, response: Response):
    db_user = get_user_by_email(user.email)
    if not db_user or not verify_password(user.password, db_user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access_token  = create_access_token(
        {"sub": user.email},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    refresh_token = create_refresh_token(user.email)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="None",
        secure=True,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        samesite="None",
        secure=True,
    )

    return {
        "message": "Login successful",
        "user":    UserResponse(
            id=str(db_user["_id"]),
            email=db_user["email"],
            name=db_user["name"],
            created_at=db_user["created_at"]
        )
    }


@router.post("/refresh")
async def refresh_token(response: Response, request: Request):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token_doc = tokens_collection.find_one({"token": refresh_token})
    if not token_doc or token_doc["expires_at"] < datetime.utcnow():
        # if expired you can also delete it here
        tokens_collection.delete_one({"token": refresh_token})
        raise HTTPException(status_code=401, detail="Refresh token invalid or expired")

    # issue new access token
    new_access = create_access_token(
        {"sub": token_doc["email"]},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    response.set_cookie(
        key="access_token",
        value=new_access,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
    )
    return {"access_token": new_access}


@router.post("/logout")
async def logout(response: Response, request: Request):
    # delete refresh token from database
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        tokens_collection.delete_one({"token": refresh_token})

    # clear cookies
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(request: Request):
    user = get_current_user(request)   # this will raise 401 if no/invalid access_token
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        created_at=user["created_at"]
    )
