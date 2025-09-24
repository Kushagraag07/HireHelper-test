from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api.auth_route import router as auth_router
from api.jobs_route import router as jobs_router
from api.email_route import router as email_router
from api.protected_route import router as protected_router
from api.interview_route import router as interview_router

from dotenv import load_dotenv


app = FastAPI(title="Secure Auth API")
load_dotenv() 
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router, prefix="/auth")
app.include_router(protected_router)
app.include_router(jobs_router)
app.include_router(email_router) 
app.include_router(interview_router) 


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
