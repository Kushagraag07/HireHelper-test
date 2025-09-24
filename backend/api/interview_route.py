# app/api/interview.py
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from datetime import datetime
from bson import ObjectId
import asyncio
import logging

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.chat_models import ChatOpenAI

from db.database import job_profiles, interview_scores, interview_sessions

from utils.getuser import get_current_user

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_MESSAGE = SystemMessage(
    content=(
        "You are an experienced, empathetic technical interviewer conducting a conversational interview. "
        "Your goal is to assess the candidate's technical skills, cultural fit, and potential for growth "
        "through natural dialogue rather than rigid Q&A. "
        
        "INTERVIEW STYLE:"
        "- Be conversational and human-like, not robotic"
        "- Show genuine interest in their responses"
        "- Ask follow-up questions based on what they share"
        "- Be flexible and adapt to their communication style"
        "- If they ask for clarification, provide it naturally"
        "- Build on their previous answers to create a flowing conversation"
        "- Use their name and reference specific details they've mentioned"
        
        "RESPONSE HANDLING:"
        "- If they say they don't understand, rephrase your question clearly"
        "- If they give a brief answer, ask for more details"
        "- If they mention interesting experiences, explore them further"
        "- If they seem nervous, be encouraging and supportive"
        "- If they ask questions, answer them briefly then continue the interview"
        
        "Maintain a warm, professional tone while gathering meaningful insights through natural conversation."
    )
)

class InterviewSession:
    def __init__(self, job_description: str, resume_text: str, max_questions: int = 8):
        self.job_description = job_description
        self.resume_text = resume_text
        self.max_questions = max_questions
        self.conversation_history: list[dict] = []
        self.question_count = 0
        
        # More detailed stage definitions with specific purposes
        self.interview_stages = [
            {
                "name": "introduction",
                "purpose": "Build rapport and understand motivation",
                "question_style": "Open-ended, welcoming questions about background and interest"
            },
            {
                "name": "experience_deep_dive", 
                "purpose": "Explore relevant past experience with specific examples",
                "question_style": "STAR method questions focusing on specific situations and outcomes"
            },
            {
                "name": "technical_assessment",
                "purpose": "Evaluate technical competency and problem-solving approach", 
                "question_style": "Scenario-based questions requiring detailed technical explanations"
            },
            {
                "name": "role_specific_fit",
                "purpose": "Assess fit for specific job requirements and challenges",
                "question_style": "Job-specific scenarios and hypothetical situations"
            },
            {
                "name": "behavioral_insights",
                "purpose": "Understand work style, collaboration, and growth mindset",
                "question_style": "Behavioral questions using past examples to predict future performance"
            },
            {
                "name": "closing_exploration",
                "purpose": "Address questions and assess genuine interest",
                "question_style": "Open dialogue about expectations and mutual fit"
            }
        ]
        
        self.current_stage = 0
        # Use GPT-3.5-turbo for better reliability, with slight temperature for more natural responses
        self.llm = ChatOpenAI(model_name="gpt-3.5-turbo", temperature=0.3)

    def build_enhanced_prompt(self) -> list[HumanMessage | SystemMessage]:
        current_stage_info = self.interview_stages[self.current_stage]  
        stage_name = current_stage_info["name"]
        stage_purpose = current_stage_info["purpose"]
        question_style = current_stage_info["question_style"]
        
        progress = f"{self.question_count}/{self.max_questions}"
        
        recent_context = ""
        if self.conversation_history:
            last_qa = self.conversation_history[-1]
            recent_context = f"\nLast Q&A for context:\nQ: {last_qa['question']}\nA: {last_qa['answer'][:200]}..."
        
        context_msg = SystemMessage(content=f"""
INTERVIEW CONTEXT:
Progress: {progress} questions completed
Current Stage: {stage_name} ({stage_purpose})
Question Style: {question_style}

JOB REQUIREMENTS:
{self.job_description}

CANDIDATE BACKGROUND:
{self.resume_text}

GUIDELINES:
- Ask ONE focused question that builds on previous answers
- Reference specific details from their resume or previous responses
- Use follow-up questions to dig deeper into interesting points
- Maintain professional but conversational tone
- For technical questions, ask for specific examples and explanations
- For behavioral questions, use "Tell me about a time when..." format
- Keep questions concise (2-3 sentences max)
- Avoid yes/no questions - seek detailed responses

{recent_context}
""")
        
        msgs: list[HumanMessage | SystemMessage] = [SYSTEM_MESSAGE, context_msg]
        
        for i, turn in enumerate(self.conversation_history):
            msgs.append(HumanMessage(content=f"Previous Question {i+1}: {turn['question']}"))
            msgs.append(HumanMessage(content=f"Candidate Response {i+1}: {turn['answer']}"))
        
        instruction = f"""
Based on the {stage_name} stage focus and the conversation so far, continue the interview naturally.

CONVERSATION CONTEXT:
- This is question {self.question_count + 1} of {self.max_questions} main questions
- Current stage: {stage_name} - {stage_purpose}
- Recent conversation: {recent_context if recent_context else "Starting this stage"}

TASK: Generate a conversational question that:
1. Builds naturally on what they've shared so far
2. References specific details from their previous responses
3. Maintains the interview flow and stage focus
4. Feels like a natural conversation, not a rigid Q&A
5. Shows genuine interest in their experience

IMPORTANT: Make your question conversational and engaging. Reference what they've said and ask for more details about interesting points they've mentioned.

Generate your question:
"""
        msgs.append(HumanMessage(content=instruction))
        return msgs

    def create_personalized_opening(self) -> str:
        return (
            "Hello! I'm excited to speak with you today about this opportunity. "
            "I've reviewed your background and I'm particularly interested in your experience. "
            "Could you start by telling me what drew you to apply for this role and "
            "what aspects of your background make you most excited about this opportunity?"
        )
    
    def refine_question(self, question: str, candidate_input: str) -> str:
        prefixes_to_remove = [
            "Great question!", "That's interesting.", "Thank you for sharing.",
            "I see.", "Excellent.", "Perfect."
        ]
        for prefix in prefixes_to_remove:
            if question.startswith(prefix):
                question = question[len(prefix):].strip()
        if not question.endswith(('?', '.', '!')):
            question += '?'
        return question
    
    def get_fallback_question(self) -> str:
        stage_name = self.interview_stages[self.current_stage]["name"]
        fallbacks = {
            "introduction": "What interests you most about this role and our company?",
            "experience_deep_dive": "Can you walk me through a challenging project you've worked on recently?",
            "technical_assessment": "How would you approach solving a complex technical problem in this domain?",
            "role_specific_fit": "What do you see as the biggest challenges in this role, and how would you address them?",
            "behavioral_insights": "Tell me about a time when you had to collaborate with a difficult team member.",
            "closing_exploration": "What questions do you have about the role or our team?"
        }
        return fallbacks.get(stage_name, "Could you tell me more about your relevant experience?")
    
    def advance_stage(self):
        questions_per_stage = max(1, self.max_questions // len(self.interview_stages))
        expected_stage = min(
            (self.question_count - 1) // questions_per_stage,
            len(self.interview_stages) - 1
        )
        self.current_stage = expected_stage

    async def get_response(self, candidate_input: str = None) -> str:
        if self.question_count == 0:
            opening = self.create_personalized_opening()
            self.question_count += 1
            return opening
        
        # Check if candidate is asking for clarification or help
        if candidate_input and self._is_clarification_request(candidate_input):
            logger.info(f"Detected clarification request: {candidate_input[:50]}...")
            clarification_response = self._handle_clarification_request(candidate_input)
            return clarification_response
        
        # Check if we should provide a follow-up based on the candidate's response
        if candidate_input and self._should_follow_up(candidate_input):
            logger.info(f"Detected need for follow-up: {candidate_input[:50]}...")
            follow_up_question = await self._generate_follow_up(candidate_input)
            return follow_up_question
        
        # Generate next main question
        try:
            messages = self.build_enhanced_prompt()
            logger.info(f"Generating question {self.question_count + 1} for stage: {self.interview_stages[self.current_stage]['name']}")
            resp = await self.llm.agenerate([messages])
            llm_message = resp.generations[0][0].message
            question = self.refine_question(llm_message.content.strip(), candidate_input)
            logger.info(f"Generated question: {question[:100]}...")
        except Exception as e:
            logger.error(f"LLM error generating main question: {e}")
            logger.error(f"Falling back to predefined question for stage: {self.interview_stages[self.current_stage]['name']}")
            question = self.get_fallback_question()
        
        # Only increment question count and advance stage for main questions
        # (clarifications and follow-ups don't count as main questions)
        if self.should_increment_question_count(candidate_input):
            self.question_count += 1
            self.advance_stage()
        
        return question

    def should_increment_question_count(self, candidate_input: str = None) -> bool:
        """Determine if this response should increment the main question count."""
        if not candidate_input:
            return True  # Initial question always counts
        
        # Don't count clarifications or follow-ups as main questions
        if self._is_clarification_request(candidate_input):
            return False
        
        if self._should_follow_up(candidate_input):
            return False
        
        return True

    def _is_clarification_request(self, candidate_input: str) -> bool:
        """Check if the candidate is asking for clarification or help."""
        clarification_indicators = [
            "i didn't understand", "i don't understand", "can you repeat", "could you repeat",
            "can you clarify", "could you clarify", "what do you mean", "i'm not sure",
            "can you explain", "could you explain", "i need help", "i'm confused",
            "can you rephrase", "could you rephrase", "i didn't catch that",
            "can you say that again", "could you say that again", "i missed that"
        ]
        
        input_lower = candidate_input.lower()
        return any(indicator in input_lower for indicator in clarification_indicators)

    def _handle_clarification_request(self, candidate_input: str) -> str:
        """Handle when candidate asks for clarification."""
        if not self.conversation_history:
            return "I'd be happy to clarify! Let me rephrase my question in a different way."
        
        last_question = self.conversation_history[-1]["question"]
        
        clarification_responses = [
            f"Of course! Let me rephrase that question: {last_question}",
            f"I understand. Let me break this down more simply: {last_question}",
            f"Let me clarify what I'm asking: {last_question}",
            f"Let me put this another way: {last_question}",
            f"I'll rephrase that: {last_question}"
        ]
        
        import random
        return random.choice(clarification_responses)

    def _should_follow_up(self, candidate_input: str) -> bool:
        """Determine if we should ask a follow-up question based on the response."""
        # Don't follow up if we've already asked too many questions in this stage
        current_stage_questions = sum(1 for qa in self.conversation_history 
                                    if qa.get("stage") == self.interview_stages[self.current_stage]["name"])
        
        if current_stage_questions >= 3:  # Max 3 questions per stage
            logger.info(f"Not following up - already asked {current_stage_questions} questions in this stage")
            return False
        
        # Check if the response is substantial enough to warrant a follow-up
        if len(candidate_input.split()) < 8:  # Reduced threshold for more follow-ups
            logger.info(f"Not following up - response too short ({len(candidate_input.split())} words)")
            return False
        
        # Check for interesting points that could be explored
        interesting_indicators = [
            "i worked on", "i developed", "i implemented", "i solved", "i managed",
            "i led", "i created", "i built", "i designed", "i collaborated",
            "challenge", "problem", "difficult", "complex", "interesting",
            "learned", "grew", "improved", "achieved", "successful",
            "project", "team", "experience", "technology", "system",
            "application", "database", "api", "framework", "tool"
        ]
        
        input_lower = candidate_input.lower()
        has_interesting_content = any(indicator in input_lower for indicator in interesting_indicators)
        
        logger.info(f"Follow-up check: {len(candidate_input.split())} words, interesting content: {has_interesting_content}")
        return has_interesting_content

    async def _generate_follow_up(self, candidate_input: str) -> str:
        """Generate a contextual follow-up question based on the candidate's response."""
        current_stage_info = self.interview_stages[self.current_stage]
        
        follow_up_prompt = f"""
You are an AI interviewer conducting a {current_stage_info['name']} stage interview.

CANDIDATE'S LAST RESPONSE:
{candidate_input}

CURRENT STAGE: {current_stage_info['name']} - {current_stage_info['purpose']}

TASK: Generate a natural follow-up question that:
1. References something specific from their response
2. Digs deeper into an interesting point they mentioned
3. Helps you better understand their experience or thinking
4. Maintains the conversational flow
5. Is relevant to the current interview stage

Guidelines:
- Keep it conversational and natural
- Reference specific details from their response
- Ask for more details, examples, or explanations
- Don't ask yes/no questions
- Keep it to 1-2 sentences maximum

Generate the follow-up question:
"""
        
        try:
            messages = [SystemMessage(content=follow_up_prompt)]
            logger.info("Generating follow-up question based on candidate response")
            resp = await self.llm.agenerate([messages])
            follow_up = resp.generations[0][0].message.content.strip()
            logger.info(f"Generated follow-up: {follow_up[:100]}...")
            return self.refine_question(follow_up, candidate_input)
        except Exception as e:
            logger.error(f"Follow-up generation error: {e}")
            logger.error("Falling back to generic follow-up")
            return "That's interesting! Can you tell me more about that?"

    async def score_answer(self, question: str, answer: str) -> int | None:
        current_stage_info = self.interview_stages[self.current_stage]
        scoring_prompt = f"""
You are an expert interviewer evaluating a candidate's response. Your task is to score this response from 1-10.

QUESTION: {question}
ANSWER: {answer}

EVALUATION CRITERIA:
- Stage: {current_stage_info['name']} ({current_stage_info['purpose']})
- Relevance: How well does the answer address the question?
- Depth: Does the answer provide sufficient detail and examples?
- Clarity: Is the response well-structured and easy to follow?
- Technical accuracy: (For technical questions) Are the concepts correct?
- Behavioral indicators: (For behavioral questions) Does it show good judgment/skills?

SCORING GUIDE:
1-3: Poor (vague, irrelevant, or incorrect)
4-6: Average (basic response, some relevance)
7-8: Good (solid response with good detail)
9-10: Excellent (comprehensive, insightful, well-articulated)

IMPORTANT: Respond with ONLY a single number between 1 and 10. Do not include any text, explanation, or punctuation.
"""
        # TEMPORARY: Skip LLM scoring and use fallback for testing
        logger.info("Using fallback scoring for testing")
        try:
            fallback_score = self._calculate_fallback_score(question, answer)
            logger.info(f"Fallback score: {fallback_score}/10")
            return fallback_score
        except Exception as fallback_error:
            logger.error(f"Fallback scoring failed: {fallback_error}")
            return 5  # Default score if everything fails

    def _calculate_fallback_score(self, question: str, answer: str) -> int:
        """Calculate a basic fallback score based on answer characteristics."""
        logger.info(f"Calculating fallback score for answer: '{answer}' (length: {len(answer)})")
        
        if not answer or len(answer.strip()) < 10:
            logger.info("Answer too short, returning score 3")
            return 3  # Very short answers get low scores
        
        word_count = len(answer.split())
        logger.info(f"Word count: {word_count}")
        
        # Basic scoring based on length and content
        if word_count < 20:
            score = 4  # Short answers
        elif word_count < 50:
            score = 6  # Medium answers
        elif word_count < 100:
            score = 7  # Good length answers
        else:
            score = 8  # Comprehensive answers
        
        logger.info(f"Fallback score calculated: {score}/10")
        return score

    def add_to_history(self, question: str, answer: str, score: int | None):
        self.conversation_history.append({
            "question": question,
            "answer": answer,
            "score": score,
            "stage": self.interview_stages[self.current_stage]["name"],
            "question_number": self.question_count
        })

async def finalize_interview(session: InterviewSession,
                             session_id,
                             websocket: WebSocket):
    """Compute final score & summary, persist, send wrap-up, and close WS."""
    doc = interview_sessions.find_one({"_id": session_id})
    
    # Debug: Log all history entries
    logger.info(f"Finalizing interview for session {session_id}")
    logger.info(f"Total history entries: {len(doc.get('history', []))}")
    
    for i, entry in enumerate(doc.get("history", [])):
        logger.info(f"History entry {i+1}: score={entry.get('score')}, question={entry.get('question', '')[:50]}...")
    
    scores = [h["score"] for h in doc.get("history", []) if h.get("score") is not None]
    logger.info(f"Valid scores found: {scores}")
    avg = sum(scores) / len(scores) if scores else None
    logger.info(f"Calculated average: {avg}")

    # 1) Build summary
    if avg is not None:
        # Stage-by-stage breakdown
        stage_breakdown: dict[str, list[int]] = {}
        for item in doc.get("history", []):
            stg = item.get("stage", "unknown")
            if item.get("score") is not None:
                stage_breakdown.setdefault(stg, []).append(item["score"])
        # Summarize averages
        stage_summary = ""
        for stg, stg_scores in stage_breakdown.items():
            if stg_scores:
                s_avg = sum(stg_scores) / len(stg_scores)
                stage_summary += f"{stg}: {s_avg:.1f}/10, "

        # Generate the narrative summary
        summary_prompt = f"""
The candidate completed an interview with an overall average score of {avg:.1f}/10.

Stage-by-stage performance:
{stage_summary}

Please provide a comprehensive but concise summary covering:
1. Key strengths demonstrated
2. Areas for improvement
3. Overall assessment for the role
4. Specific recommendations

Keep it professional and constructive.
"""
        resp_sum = await session.llm.agenerate([[SystemMessage(content=summary_prompt)]])
        summary = resp_sum.generations[0][0].message.content
    else:
        summary = "Not enough scored answers to generate a comprehensive summary."
        stage_breakdown = None

    # 2) Only ask for a recommendation if we have an average
    recommendation = None
    if avg is not None:
        rec_prompt = f"""
Based on the candidate’s overall average score of {avg:.1f}/10 and the stage-by-stage
summary provided, would you recommend advancing this candidate to the next stage?
Respond with EXACTLY one word: “Yes” or “No”, and then in 1–2 sentences justify your choice.
"""
        resp_rec = await session.llm.agenerate([[SystemMessage(content=rec_prompt)]])
        recommendation = resp_rec.generations[0][0].message.content.strip()

    # 3) Persist everything
    interview_sessions.update_one(
        {"_id": session_id},
        {"$set": {
            "ended_at":        datetime.utcnow(),
            "average_score":   avg,
            "summary":         summary,
            "stage_breakdown": stage_breakdown,
            "recommendation":  recommendation
        }}
    )
    job_profiles.update_one(
        {"_id": ObjectId(doc["job_id"]), "scoredResumes.resumeId": doc["resume_id"]},
        {"$set": {
            "scoredResumes.$.interviewDone": True,
            "scoredResumes.$.sessionId":     session_id
        }}
    )

    # 4) Send back over the WebSocket
    payload = {
        "text":            "⏰ Interview completed! Here's your comprehensive assessment:",
        "type":            "interview_complete",
        "summary":         summary,
        "average_score":   avg,
        "stage_breakdown": stage_breakdown,
    }
    if recommendation is not None:
        payload["recommendation"] = recommendation

    await websocket.send_json(payload)
    # Give the client a moment to process the completion message
    await asyncio.sleep(1)
    await websocket.close()



async def finalize_after_10min(session, session_id, websocket):
    try:
        await asyncio.sleep(600)  # 10 minutes
        await finalize_interview(session, session_id, websocket)
    except asyncio.CancelledError:
        pass


@router.websocket("/ws/interview/{job_id}/{resume_id}")
async def interview_ws(websocket: WebSocket, job_id: str, resume_id: str):
    # 1) Fetch job & candidate entry
    job = job_profiles.find_one({"_id": ObjectId(job_id)})
    if not job:
        await websocket.accept()
        await websocket.send_json({"error": "Job not found"})
        await websocket.close()
        return

    entry = next(
        (r for r in job.get("scoredResumes", []) if str(r.get("resumeId")) == resume_id),
        None
    )
    if not entry:
        await websocket.accept()
        await websocket.send_json({"error": "Resume not found"})
        await websocket.close()
        return

    # 2) Enforce schedule window
    sched = entry.get("interview_schedule")
    now = datetime.utcnow()
    if not sched:
        await websocket.accept()
        await websocket.send_json({"error": "Interview not scheduled for this candidate"})
        await websocket.close()
        return
    start, end = sched["start"], sched["end"]
    if now < start:
        await websocket.accept()
        await websocket.send_json({
            "error":    "Interview window hasn't opened yet",
            "startsAt": start.isoformat()
        })
        await websocket.close()
        return
    if now > end:
        await websocket.accept()
        await websocket.send_json({"error": "Interview window has expired"})
        await websocket.close()
        return

    # 3) Accept WS and create session doc
    await websocket.accept()
    sess_doc = {
        "job_id":           job_id,
        "resume_id":        resume_id,
        "scheduled_start":  start,
        "scheduled_end":    end,
        "started_at":       now,
        "history":          [],
        "stage_progression": []
    }
    session_id = interview_sessions.insert_one(sess_doc).inserted_id
    session = InterviewSession(job["description"], entry["text"], max_questions=8)

    # 4) Auto-finalize timer
    auto_task = asyncio.create_task(finalize_after_10min(session, session_id, websocket))

    async def send_response(text: str):
        await websocket.send_json({
            "text":            text,
            "question_count":  session.question_count,
            "max_questions":   session.max_questions,
            "current_stage":   session.interview_stages[session.current_stage]["name"],
            "stage_progress":  f"{session.current_stage+1}/{len(session.interview_stages)}"
        })

    try:
        # First, ask for screen sharing
        await websocket.send_json({
            "text": "Welcome to your AI interview! Before we begin, please start screen sharing for proctoring purposes. Click the 'Share Screen' button below.",
            "type": "screen_share_request",
            "question_count": 0,
            "max_questions": session.max_questions,
            "current_stage": "setup",
            "stage_progress": "0/1"
        })
        
        # Wait for screen sharing confirmation
        screen_shared = False
        while not screen_shared:
            msg = await websocket.receive_json()
            
            # Handle screen sharing events
            if msg.get("type") == "screen-share":
                if msg.get("action") == "started":
                    screen_shared = True
                    await websocket.send_json({
                        "text": "Perfect! Screen sharing is active. Now let's begin your interview. I'll ask you questions and you can respond using voice or text.",
                        "type": "screen_share_confirmed",
                        "question_count": 0,
                        "max_questions": session.max_questions,
                        "current_stage": session.interview_stages[session.current_stage]["name"],
                        "stage_progress": f"{session.current_stage+1}/{len(session.interview_stages)}"
                    })
                    break
                elif msg.get("action") == "declined":
                    await websocket.send_json({
                        "text": "Screen sharing is required for this interview. Please enable screen sharing to continue.",
                        "type": "screen_share_required",
                        "question_count": 0,
                        "max_questions": session.max_questions,
                        "current_stage": "setup",
                        "stage_progress": "0/1"
                    })
                elif msg.get("action") == "ended":
                    screen_shared = False
                    await websocket.send_json({
                        "text": "Screen sharing was stopped. Please restart screen sharing to continue the interview.",
                        "type": "screen_share_required",
                        "question_count": 0,
                        "max_questions": session.max_questions,
                        "current_stage": "setup",
                        "stage_progress": "0/1"
                    })
            
            # Handle telemetry events during setup
            elif msg.get("type") in {"tab-switch", "gaze", "object-detect", "not-looking", "fullscreen-violation"}:
                field = {
                    "tab-switch": "tabEvents",
                    "gaze": "gazeData",
                    "object-detect": "objectEvents",
                    "not-looking": "warningEvents",
                    "fullscreen-violation": "fullscreenViolations"
                }[msg["type"]]
                
                # Log fullscreen violations with additional details
                if msg["type"] == "fullscreen-violation":
                    violation_data = {
                        **msg,
                        "timestamp": datetime.utcnow(),
                        "session_stage": "setup" if not last_q else "interview"
                    }
                    logger.warning(f"Fullscreen violation #{msg.get('count', 0)} detected for resume {resume_id}")
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {field: violation_data}}
                    )
                else:
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {field: {**msg, "timestamp": datetime.utcnow()}}}
                    )
                continue
        
        # Now send the initial question
        last_q = await session.get_response()
        await send_response(last_q)

        # Main loop
        while True:
            msg = await websocket.receive_json()

            # Telemetry events
            if msg.get("type") in {"tab-switch", "gaze", "object-detect", "not-looking", "fullscreen-violation"}:
                field = {
                    "tab-switch": "tabEvents",
                    "gaze": "gazeData",
                    "object-detect": "objectEvents",
                    "not-looking": "warningEvents",
                    "fullscreen-violation": "fullscreenViolations"
                }[msg["type"]]
                
                # Log fullscreen violations with additional details
                if msg["type"] == "fullscreen-violation":
                    violation_data = {
                        **msg,
                        "timestamp": datetime.utcnow(),
                        "session_stage": "interview",
                        "question_number": session.question_count
                    }
                    logger.warning(f"Fullscreen violation #{msg.get('count', 0)} detected for resume {resume_id} during interview")
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {field: violation_data}}
                    )
                else:
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$push": {field: {**msg, "timestamp": datetime.utcnow()}}}
                    )
                continue

            answer = msg.get("answer", "").strip()
            if not answer:
                await websocket.send_json({"error": "Empty answer received"})
                continue
            if answer.lower() in {"quit", "exit", "end interview"}:
                # Check if this is a fullscreen violation termination
                if msg.get("reason") == "fullscreen_violations":
                    violation_count = msg.get("violation_count", 0)
                    logger.warning(f"Interview terminated due to {violation_count} fullscreen violations for resume {resume_id}")
                    
                    # Record the termination reason in the session
                    interview_sessions.update_one(
                        {"_id": session_id},
                        {"$set": {
                            "terminated_reason": "fullscreen_violations",
                            "violation_count": violation_count,
                            "terminated_at": datetime.utcnow()
                        }}
                    )
                break

            # Score & record
            logger.info(f"Scoring answer for question {session.question_count}: {last_q[:50]}...")
            score = await session.score_answer(last_q, answer)
            logger.info(f"Score received: {score} (type: {type(score)})")
            
            # Ensure score is valid before storing
            if score is not None and isinstance(score, (int, float)):
                score_to_store = int(score)
                logger.info(f"Storing score: {score_to_store}")
            else:
                logger.warning(f"Invalid score received: {score}, using fallback")
                score_to_store = session._calculate_fallback_score(last_q, answer)
            
            interview_scores.insert_one({
                "job_id":         job_id,
                "resume_id":      resume_id,
                "question_number":session.question_count,
                "question":       last_q,
                "answer":         answer,
                "score":          score_to_store,
                "timestamp":      datetime.utcnow(),
                "stage":          session.interview_stages[session.current_stage]["name"]
            })
            session.add_to_history(last_q, answer, score_to_store)
            interview_sessions.update_one(
                {"_id": session_id},
                {"$push": {"history": {
                    "question_number":session.question_count,
                    "question":       last_q,
                    "answer":         answer,
                    "score":          score_to_store,
                    "timestamp":      datetime.utcnow(),
                    "stage":          session.interview_stages[session.current_stage]["name"]
                }}}
            )
            interview_sessions.update_one(
                {"_id": session_id},
                {"$push": {"stage_progression": {
                    "stage":          session.interview_stages[session.current_stage]["name"],
                    "question_number":session.question_count,
                    "timestamp":      datetime.utcnow()
                }}}
            )

            # Next question with retry
            backoff = 1
            for attempt in range(3):
                try:
                    last_q = await session.get_response(answer)
                    break
                except Exception as e:
                    logger.error(f"Error generating question: {e}")
                    if attempt == 2:
                        last_q = session.get_fallback_question()
                        break
                    await asyncio.sleep(backoff)
                    backoff *= 2

            await send_response(last_q)
            
            # Check if we should end the interview
            # Only end if we've reached the max questions AND this was a main question (not clarification/follow-up)
            if session.question_count >= session.max_questions:
                break

    except WebSocketDisconnect:
        return
    finally:
        if not auto_task.done():
            auto_task.cancel()
            await finalize_interview(session, session_id, websocket)
        await websocket.close()


@router.get("/session/{session_id}")
async def get_interview_session(session_id: str):
    """Fetch the full interview session document by its ID."""
    doc = interview_sessions.find_one({"_id": ObjectId(session_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Interview session not found")
    doc["_id"] = str(doc["_id"])
    doc["job_id"] = str(doc["job_id"])
    doc["resume_id"] = str(doc["resume_id"])
    return {"session": doc}


@router.post("/admin/reset-interview/{session_id}")
async def reset_interview(
    session_id: str,
    admin = Depends(get_current_user)
):
    """
    Deletes the in-flight session and clears the interviewDone flag
    so the candidate can be re-interviewed.
    """
    interview_sessions.delete_one({"_id": ObjectId(session_id)})
    job_profiles.update_one(
        { "scoredResumes.sessionId": ObjectId(session_id) },
        { "$unset": {
            "scoredResumes.$.interviewDone": "",
            "scoredResumes.$.sessionId": ""
        }}
    )
    return {"ok": True, "message": "Interview session reset"}


@router.get("/analytics/{job_id}")
async def get_interview_analytics(job_id: str):
    """Get analytics for all interviews for a specific job"""
    pipeline = [
        {"$match": {"job_id": job_id}},
        {"$unwind": "$history"},
        {"$group": {
            "_id": "$history.stage",
            "avg_score": {"$avg": "$history.score"},
            "question_count": {"$sum": 1},
            "scores": {"$push": "$history.score"}
        }},
        {"$sort": {"_id": 1}}
    ]
    stage_analytics = list(interview_sessions.aggregate(pipeline))
    overall_pipeline = [
        {"$match": {"job_id": job_id}},
        {"$group": {
            "_id": None,
            "total_interviews": {"$sum": 1},
            "avg_score": {"$avg": "$average_score"},
            "completion_rate": {"$avg": {"$cond": [{"$ne": ["$ended_at", None]}, 1, 0]}}
        }}
    ]
    overall_stats = list(interview_sessions.aggregate(overall_pipeline))
    return {
        "stage_analytics": stage_analytics,
        "overall_stats": overall_stats[0] if overall_stats else None,
        "job_id": job_id
    }


@router.get("/session/by-resume/{resume_id}")
async def get_full_session_by_resume(resume_id: str):
    """
    Fetch the latest interview session for a given resume_id,
    including the full Q&A history, average score, recommendation, and summary.
    """
    doc = interview_sessions.find_one(
        {"resume_id": resume_id},
        sort=[("started_at", -1)]
    )
    if not doc:
        raise HTTPException(status_code=404, detail="No interview session found for that resume_id")

    session = {
        "session_id":       str(doc["_id"]),
        "job_id":           str(doc["job_id"]),
        "resume_id":        doc["resume_id"],
        "scheduled_start":  doc["scheduled_start"].isoformat(),
        "scheduled_end":    doc["scheduled_end"].isoformat(),
        "started_at":       doc["started_at"].isoformat(),
        "ended_at":         doc.get("ended_at").isoformat() if doc.get("ended_at") else None,
        "average_score":    doc.get("average_score"),
        "recommendation":   doc.get("recommendation"),
        "summary":          doc.get("summary"),
        "stage_breakdown":  doc.get("stage_breakdown"),
        "history": [
            {
                "question_number": h["question_number"],
                "question":        h["question"],
                "answer":          h["answer"],
                "score":           h.get("score"),
                "stage":           h.get("stage"),
                "timestamp":       h["timestamp"].isoformat(),
            }
            for h in doc.get("history", [])
        ],
        "stage_progression": [
            {
                "stage":           sp["stage"],
                "question_number": sp["question_number"],
                "timestamp":       sp["timestamp"].isoformat(),
            }
            for sp in doc.get("stage_progression", [])
        ],
    }

    return {"session": session}
