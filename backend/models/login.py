from typing import List ,Optional
from pydantic import BaseModel ,EmailStr
from datetime import datetime, timedelta


class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    created_at: datetime

class TokenData(BaseModel):
    email: Optional[str] = None