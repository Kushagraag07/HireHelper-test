# db/database.py

from pymongo import MongoClient
from gridfs import GridFS
from config import settings

_client           = MongoClient(settings.MONGODB_URL)
auth_db           = _client[settings.AUTH_DB_NAME]
app_db            = _client[settings.APP_DB_NAME]

# Auth collections
users_collection  = auth_db["users"]
tokens_collection = auth_db["refresh_tokens"]

# Domain collections
job_profiles      = app_db["job_profiles"]        # ← add this
resume_coll       = app_db["resume_submissions"]
fs                = GridFS(app_db)
interview_scores  = app_db["interview_scores"] 
interview_sessions = app_db["interview_sessions"]
