from datetime import datetime, timedelta
from jose import jwt
import secrets
from config import settings
from db.database import tokens_collection

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_refresh_token(email: str):
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    tokens_collection.insert_one({
        "token": token,
        "email": email,
        "expires_at": expires_at,
        "created_at": datetime.utcnow()
    })
    return token
