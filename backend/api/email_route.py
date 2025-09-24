import asyncio
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from fastapi.routing import APIRouter
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from typing import List
from bson import ObjectId
from db.database import job_profiles
import os
from datetime import datetime
from config import settings

# ─── Hard-coded mail & app settings ─────────────────────────────────────────────
MAIL_USERNAME = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")
MAIL_FROM     = os.getenv("MAIL_FROM")
MAIL_SERVER   = os.getenv("MAIL_SERVER")

# SSL-only: port 465, TLS disabled, SSL enabled
MAIL_PORT     = 465
MAIL_STARTTLS = False  # Changed from MAIL_TLS
MAIL_SSL_TLS  = True   # Changed from MAIL_SSL

FRONTEND_URL  =  settings.FRONTEND_URL


conf = ConnectionConfig(
    MAIL_USERNAME=MAIL_USERNAME,
    MAIL_PASSWORD=MAIL_PASSWORD,
    MAIL_FROM=MAIL_FROM,
    MAIL_SERVER=MAIL_SERVER,
    MAIL_PORT=MAIL_PORT,
    MAIL_STARTTLS=MAIL_STARTTLS,  # Required field
    MAIL_SSL_TLS=MAIL_SSL_TLS,    # Required field
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
)

fastmail = FastMail(conf)
app      = FastAPI()
router   = APIRouter()


@router.post("/send-invites")
async def send_invites(
    job_id:     str        = Body(..., embed=True),
    resume_ids: List[str] = Body(..., embed=True),
):
    job = job_profiles.find_one({"_id": ObjectId(job_id)})
    if not job:
        raise HTTPException(404, "Job not found")
    if not resume_ids:
        raise HTTPException(400, "No resume IDs provided")

    sent, failed, tasks = 0, [], []

    for r in job.get("scoredResumes", []):
        rid = str(r.get("resumeId"))
        if rid not in resume_ids:
            continue

        name  = r.get("name", "Candidate")
        email = r.get("email")
        if not email:
            failed.append(f"No email for {name}")
            continue

        interview_url = f"{FRONTEND_URL}/interview/{job_id}/{rid}"

        html_body = (
            f"<div style='font-family:Arial,sans-serif;max-width:600px;margin:auto;'>"
            f"<h2>Dear {name},</h2>"
            f"<p>Congratulations—you've been <strong>shortlisted</strong>!</p>"
            f"<p><a href='{interview_url}' "
            f"style='display:inline-block;padding:12px 24px;"
            f"background:#007bff;color:#fff;text-decoration:none;"
            f"border-radius:4px;'>Start Interview</a></p>"
            f"<ul>"
            f"<li>20–30 minutes to complete</li>"
            f"<li>Stable internet connection</li>"
            f"<li>Quiet environment</li>"
            f"</ul>"
            f"<p>Best regards,<br/>The Hiring Team</p>"
            f"</div>"
        )

        message = MessageSchema(
            subject="Interview Invitation – AI-Powered Interview",
            recipients=[email],
            body=html_body,
            subtype="html",
        )
        tasks.append(fastmail.send_message(message))

    results = await asyncio.gather(*tasks, return_exceptions=True)
    for r in results:
        if isinstance(r, Exception):
            failed.append(str(r))
        else:
            sent += 1

    return {
        "message":         "Invitation process completed",
        "invited":         sent,
        "failed":          len(failed),
        "errors":          failed,
        "total_requested": len(tasks),
    }
class ScheduleRequest(BaseModel):
    job_id:      str
    resume_ids:  List[str]
    start_time:  datetime
    end_time:    datetime

@router.post("/schedule-interview")
async def schedule_interview(req: ScheduleRequest):
    # 1. validate job exists
    job = job_profiles.find_one({"_id": ObjectId(req.job_id)})
    if not job:
        raise HTTPException(404, "Job not found")

    # 2. validate times
    if req.start_time >= req.end_time:
        raise HTTPException(400, "start_time must be before end_time")

    # 3. update each scoredResume entry with an interview_schedule sub-doc
    result = job_profiles.update_one(
        {"_id": ObjectId(req.job_id)},
        {
            "$set": {
                "scoredResumes.$[cand].interview_schedule": {
                    "start": req.start_time,
                    "end":   req.end_time
                }
            }
        },
        array_filters=[{"cand.resumeId": {"$in": req.resume_ids}}]
    )

    if result.matched_count == 0:
        raise HTTPException(404, "No matching resumes found in this job")

    return {
        "message":       "Interview(s) scheduled",
        "job_id":        req.job_id,
        "resume_ids":    req.resume_ids,
        "starts_at":     req.start_time,
        "ends_at":       req.end_time
    }
