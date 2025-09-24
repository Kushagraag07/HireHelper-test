# api/jobs_route.py

import re
import fitz                      # PyMuPDF
from typing        import Dict, Any, List, Tuple, Optional
from datetime      import datetime
from fastapi       import APIRouter, Depends, Form, File, UploadFile, HTTPException, status, Response
from models.jobs     import JobSummary, ResumeSummary
from utils.pdf_parser import extract_pdf_text
from utils.getuser    import get_current_user
from utils.llm        import llm_score
from db.vector_db     import index_resume_chunks, index_job_description_chunks
from db.database      import fs, job_profiles
from bson import ObjectId
import io

router = APIRouter()

# plain-text email regex
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

async def read_and_parse(file: UploadFile) -> Tuple[str, str, bytes, Optional[str]]:
    """
    Returns:
      filename:         the original filename
      text:             visible text from the PDF
      raw:              raw PDF bytes
      embedded_email:   email from link annotation OR from visible-text OR None
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{file.filename}' is empty")

    # 1) Try to grab mailto: from any link annotation via PyMuPDF
    embedded_email: Optional[str] = None
    try:
        doc = fitz.open(stream=raw, filetype="pdf")
        for page in doc:
            for link in page.get_links():
                uri = link.get("uri", "")
                if uri.lower().startswith("mailto:"):
                    embedded_email = uri.split("mailto:", 1)[1]
                    break
            if embedded_email:
                break
    except Exception:
        embedded_email = None

    # 2) Extract visible text
    text = await extract_pdf_text(raw, file.filename)

    # 3) If no annotation email, scan the text itself
    if not embedded_email:
        m = EMAIL_RE.search(text)
        if m:
            embedded_email = m.group(0)

    return file.filename, text, raw, embedded_email

@router.post("/jobs", status_code=status.HTTP_201_CREATED)
async def create_job(
    description: str              = Form(...),
    files:       List[UploadFile] = File(...),
    current_user: dict            = Depends(get_current_user),
) -> Dict[str, Any]:
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "At least one file must be uploaded")

    recruiter_id = current_user["_id"]

    # A) Insert minimal job to get its ID
    job_doc = {
        "recruiterId":   recruiter_id,
        "description":   description,
        "files":         [],
        "scoredResumes": [],
        "createdAt":     datetime.utcnow(),
    }
    job_insert = job_profiles.insert_one(job_doc)
    job_id      = str(job_insert.inserted_id)

    # B) Index JD in Qdrant
    index_job_description_chunks(job_id, description)

    stored_files   = []
    scored_resumes = []

    for file in files:
        filename, text, raw, embedded_email = await read_and_parse(file)

        # 1) Store PDF in GridFS
        try:
            file_id = fs.put(
                raw,
                filename=filename,
                content_type=file.content_type,
                uploadDate=datetime.utcnow()
            )
        except Exception as e:
            raise HTTPException(
                status.HTTP_500_INTERNAL_SERVER_ERROR,
                f"GridFS error for '{filename}': {e}"
            )

        resume_id = str(file_id)
        stored_files.append({
            "fileId":   file_id,
            "filename": filename,
            "fileType": file.content_type,
        })

        # 2) Vector‐index the resume text
        index_resume_chunks(resume_id, text)

        # 3) Score + extract name/email (using embedded_email as override)
        score_result = await llm_score(
            resume_id=resume_id,
            filename=filename,
            resume_text=text,
            job_desc=description,
            override_email=embedded_email
        )

        # 4) Build out the scoredResumes entry
        scored_resumes.append({
            "resumeId":  resume_id,
            "filename":  filename,
            "name":      score_result["name"],
            "email":     score_result["email"],
            "score":     score_result["score"],
            "reasoning": score_result["reasoning"],
            "text":      text,
            "interviewDone": False,
            "sessionId":     None,
        })

    # D) Patch the full arrays back into MongoDB
    job_profiles.update_one(
        {"_id": job_insert.inserted_id},
        {"$set": {
            "files":         stored_files,
            "scoredResumes": scored_resumes,
        }}
    )

    # E) Return the enriched response
    return {
        "jobId":         job_id,
        "scoredResumes": scored_resumes,
        "createdAt":     job_doc["createdAt"].isoformat(),
    }

@router.get(
    "/jobs",
    response_model=List[JobSummary],
    summary="List all jobs created by the current user"
)
async def list_my_jobs(current_user: dict = Depends(get_current_user)):
    """
    Returns all job profiles where recruiterId == current_user['_id'].
    """
    user_id = current_user["_id"]
    # Fetch all matching jobs
    jobs_cursor = job_profiles.find({"recruiterId": user_id})
    jobs = []
    for job in jobs_cursor:
        jobs.append(
            JobSummary(
                jobId=str(job["_id"]),
                description=job["description"],
                createdAt=job["createdAt"],
                scoredResumes=[
                    ResumeSummary(
                        resumeId=r["resumeId"],
                        filename=r["filename"],
                        name=r["name"],
                        email=r["email"],
                        score=r["score"],
                        interviewDone= r.get("interviewDone", False),
                        sessionId    = str(r["sessionId"]) if r.get("sessionId") else None,
                    )
                    for r in job.get("scoredResumes", [])
                ],
            )
        )
    return jobs



@router.patch("/jobs/{job_id}", status_code=status.HTTP_200_OK)
async def update_job(
    job_id: str,
    description: Optional[str] = Form(None),
    files: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    PATCH endpoint to update job description and/or add more resumes to an existing job.
    """
    try:
        job_obj_id = ObjectId(job_id)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid job ID")

    job = job_profiles.find_one({"_id": job_obj_id})
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found")

    if job["recruiterId"] != current_user["_id"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Not authorized to update this job")

    update_fields = {}

    # Update the description if provided
    if description:
        update_fields["description"] = description
        index_job_description_chunks(job_id, description)

    new_files = []
    new_scored_resumes = []

    if files:
        for file in files:
            filename, text, raw, embedded_email = await read_and_parse(file)

            # Store PDF in GridFS
            try:
                file_id = fs.put(
                    raw,
                    filename=filename,
                    content_type=file.content_type,
                    uploadDate=datetime.utcnow()
                )
            except Exception as e:
                raise HTTPException(
                    status.HTTP_500_INTERNAL_SERVER_ERROR,
                    f"GridFS error for '{filename}': {e}"
                )

            resume_id = str(file_id)

            # Index resume and score
            index_resume_chunks(resume_id, text)
            score_result = await llm_score(
                resume_id=resume_id,
                filename=filename,
                resume_text=text,
                job_desc=description or job["description"],
                override_email=embedded_email
            )

            new_files.append({
                "fileId":   file_id,
                "filename": filename,
                "fileType": file.content_type,
            })

            new_scored_resumes.append({
                "resumeId":  resume_id,
                "filename":  filename,
                "name":      score_result["name"],
                "email":     score_result["email"],
                "score":     score_result["score"],
                "reasoning": score_result["reasoning"],
                "text":      text,
                "interviewDone":False,
                "sessionId"    :None
            })

    # Combine existing and new files/resumes
    if new_files:
        update_fields["files"] = job.get("files", []) + new_files
    if new_scored_resumes:
        update_fields["scoredResumes"] = job.get("scoredResumes", []) + new_scored_resumes

    # Apply update
    if update_fields:
        job_profiles.update_one({"_id": job_obj_id}, {"$set": update_fields})

    return {
        "message": "Job updated successfully",
        "updatedFields": list(update_fields.keys()),
        "newScoredResumes": new_scored_resumes,
    }


@router.get("/resume/{resume_id}")
async def view_resume(
    resume_id: str,
    current_user: dict = Depends(get_current_user)
) -> Response:
    """
    View a resume file from GridFS.
    Returns the PDF file for viewing in browser.
    """
    try:
        # Convert string ID to ObjectId
        file_id = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid resume ID")

    try:
        # Get the file from GridFS
        grid_out = fs.get(file_id)
        
        # Read the file content
        file_content = grid_out.read()
        
        # Get filename for content disposition
        filename = grid_out.filename or "resume.pdf"
        
        # Return the file with appropriate headers for viewing
        return Response(
            content=file_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename={filename}",
                "Cache-Control": "no-cache"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, 
            f"Resume not found: {str(e)}"
        )


@router.get("/resume/{resume_id}/download")
async def download_resume(
    resume_id: str,
    current_user: dict = Depends(get_current_user)
) -> Response:
    """
    Download a resume file from GridFS.
    Returns the PDF file for download.
    """
    try:
        # Convert string ID to ObjectId
        file_id = ObjectId(resume_id)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid resume ID")

    try:
        # Get the file from GridFS
        grid_out = fs.get(file_id)
        
        # Read the file content
        file_content = grid_out.read()
        
        # Get filename for content disposition
        filename = grid_out.filename or "resume.pdf"
        
        # Return the file with appropriate headers for download
        return Response(
            content=file_content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Cache-Control": "no-cache"
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, 
            f"Resume not found: {str(e)}"
        )
