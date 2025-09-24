# utils/llm.py

from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

llm = ChatGoogleGenerativeAI(model="gemini-2.0-flash")

async def llm_score(
    resume_id: str,
    filename: str,
    resume_text: str,
    job_desc: str,
    override_email: Optional[str] = None
) -> dict:
    """
    Uses Gemini to score a resume against a job description,
    plus extract name/email. If override_email is provided,
    it will be used instead of the LLM's extracted email.
    """

    prompt = ChatPromptTemplate.from_template(
        """
        You are an AI hiring assistant. Compare the following resume to the job description.

        Provide:
        - A match score from 0 to 100.
        - The candidate’s full name.
        - The candidate’s email address.
        - A brief explanation highlighting key matches and gaps.

        Job Description:
        {job_description}

        Resume:
        {resume_text}

        Output Format:
        Score: <number>
        Name: <full name>
        Email: <email>
        Reason: <short explanation>
        """
    )

    messages = prompt.format_messages(
        job_description=job_desc,
        resume_text=resume_text
    )

    try:
        response = await llm.ainvoke(messages)
        lines = [l.strip() for l in response.content.splitlines() if l.strip()]

        def get_field(prefix: str) -> str:
            return (next(l for l in lines if l.lower().startswith(prefix))
                    .split(":", 1)[1]
                    .strip())

        score = float(get_field("score"))
        name  = get_field("name")

        # use override if provided, otherwise ask LLM
        if override_email:
            email = override_email
        else:
            try:
                email = get_field("email")
            except StopIteration:
                email = ""

        reasoning = get_field("reason")

    except Exception as e:
        score     = 0.0
        name      = ""
        email     = override_email or ""
        reasoning = f"Unable to parse LLM response: {e}"

    return {
        "resumeId":  resume_id,
        "filename":  filename,
        "name":      name,
        "email":     email,
        "score":     score,
        "reasoning": reasoning,
    }
