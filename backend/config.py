import os
import secrets
from dotenv import load_dotenv
from langchain_google_genai import GoogleGenerativeAIEmbeddings


load_dotenv()
class Settings:

    SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_urlsafe(32))
    ALGORITHM = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES = 30
    REFRESH_TOKEN_EXPIRE_DAYS = 7
    MONGODB_URL= os.getenv("MONGODB_URL")
    FRONTEND_URL= os.getenv("FRONTEND_URL", "http://localhost:3000")
    AUTH_DB_NAME= os.getenv("AUTH_DB_NAME", "auth_db")
    APP_DB_NAME= os.getenv("APP_DB_NAME", "app_db")
    QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_API_KEY= os.getenv("QDRANT_API_KEY", None)
    GOOGLE_API_KEY= os.getenv("GOOGLE_API_KEY") 
    embeddings = GoogleGenerativeAIEmbeddings(
        model="models/embedding-001",
    
        
    )
    
    MAILJET_SENDER_EMAIL = "akshatsrivastav38@gmail.com"
    MAILJET_API_KEY    = os.getenv("MAILJET_API_KEY")    # e.g. "3c4792e776a3f20faae21f3845045a97"
    MAILJET_SECRET_KEY = os.getenv("MAILJET_SECRET_KEY")
    DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY",)
    OPENAI_API_KEY=os.getenv("OPENAI_API_KEY")
    QDRANT_COLLECTION="resumes"
    # Cookie config: default safe for local dev (HTTP). For production set COOKIE_SECURE=true and COOKIE_SAMESITE=None
    COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
    COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "Lax")

settings = Settings()
