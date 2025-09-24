# models/jobs.py
from pydantic import BaseModel
from datetime import datetime
from typing import List,Optional

class ResumeSummary(BaseModel):
    resumeId: str
    filename: str
    name: str
    email: str
    score: float
    interviewDone: bool = False
    sessionId:     Optional[str] = None

class JobSummary(BaseModel):
    jobId: str
    description: str
    createdAt: datetime
    scoredResumes: List[ResumeSummary]
