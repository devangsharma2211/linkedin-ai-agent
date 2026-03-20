from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from database import get_db, SessionLocal
import models
import schemas
from utils.security import get_current_user
from services.ai_service import chat_with_profile
from services.memory_service import build_memory_context, extract_and_update_memory

router = APIRouter()
MEMORY_UPDATE_EVERY = 5

@router.post("/send", response_model=schemas.ChatResponse)
def send_message(
    payload: schemas.ChatMessageIn,
    background_tasks: BackgroundTasks,
    session_id: Optional[int] = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(models.Profile).filter(models.Profile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Please upload your LinkedIn PDF first.")

    if session_id:
        session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found.")
        if session.ended_at:
            raise HTTPException(status_code=400, detail="This session has ended.")
    else:
        session = models.ChatSession(user_id=current_user.id)
        db.add(session)
        db.flush()

    memory = db.query(models.UserMemory).filter(models.UserMemory.user_id == current_user.id).first()
    memory_context = build_memory_context(memory)
    history_records = db.query(models.ChatMessage).filter(models.ChatMessage.user_id == current_user.id, models.ChatMessage.session_id == session.id).order_by(models.ChatMessage.created_at.desc()).limit(20).all()
    history = [{"role": m.role, "content": m.content} for m in reversed(history_records)]
    profile_data = {"headline": profile.headline, "summary": profile.summary, "experience": profile.experience, "education": profile.education, "skills": profile.skills, "certifications": profile.certifications}

    ai_result = chat_with_profile(user_message=payload.message, profile_data=profile_data, chat_history=history, memory_context=memory_context)
    reply = ai_result["reply"]
    crud_action = ai_result.get("crud_action")
    intent = ai_result.get("intent", "general")
    topic = ai_result.get("topic", "other")

    db.add(models.ChatMessage(user_id=current_user.id, session_id=session.id, role="user", content=payload.message, intent=intent, topic=topic))
    db.add(models.ChatMessage(user_id=current_user.id, session_id=session.id, role="assistant", content=reply, intent=intent, topic=topic))

    updated_profile = None
    if crud_action and crud_action.get("action") == "update":
        field = crud_action.get("field")
        new_value = crud_action.get("new_value")
        allowed = {"headline", "summary", "experience", "education", "skills", "certifications"}
        if field in allowed and new_value is not None:
            setattr(profile, field, new_value)
            db.flush()
            db.refresh(profile)
            updated_profile = profile

    session.message_count = (session.message_count or 0) + 2
    db.commit()

    if session.message_count % MEMORY_UPDATE_EVERY == 0:
        background_tasks.add_task(_bg_extract_memory, current_user.id, payload.message, reply)

    return schemas.ChatResponse(reply=reply, session_id=session.id, updated_profile=updated_profile)


@router.post("/session/{session_id}/end", status_code=200)
def end_session(session_id: int, background_tasks: BackgroundTasks, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    background_tasks.add_task(_bg_end_session, current_user.id, session_id)
    return {"message": "Session ended."}


@router.patch("/message/{message_id}/rate")
def rate_message(message_id: int, score: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not 1 <= score <= 5:
        raise HTTPException(status_code=400, detail="Score must be between 1 and 5.")
    msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == message_id, models.ChatMessage.user_id == current_user.id, models.ChatMessage.role == "assistant").first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found.")
    msg.feedback_score = score
    msg.was_helpful = score >= 4
    memory = db.query(models.UserMemory).filter(models.UserMemory.user_id == current_user.id).first()
    if memory:
        total = memory.total_messages or 1
        prev_avg = memory.avg_feedback_score or score
        memory.avg_feedback_score = ((prev_avg * (total - 1)) + score) / total
    db.commit()
    return {"message": "Rating saved.", "score": score}


@router.get("/sessions", response_model=List[schemas.ChatSessionOut])
def list_sessions(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.ChatSession).filter(models.ChatSession.user_id == current_user.id).order_by(models.ChatSession.created_at.desc()).all()


@router.get("/session/{session_id}", response_model=List[schemas.ChatMessageOut])
def get_session_messages(session_id: int, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id, models.ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at).all()


@router.get("/history", response_model=List[schemas.ChatMessageOut])
def get_all_history(limit: int = 100, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.user_id == current_user.id).order_by(models.ChatMessage.created_at.desc()).limit(limit).all()
    return list(reversed(messages))


@router.get("/memory", response_model=schemas.UserMemoryOut)
def get_memory(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory = db.query(models.UserMemory).filter(models.UserMemory.user_id == current_user.id).first()
    if not memory:
        raise HTTPException(status_code=404, detail="No memory yet. Chat more and it will build up.")
    return memory


@router.delete("/memory", status_code=204)
def clear_memory(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    memory = db.query(models.UserMemory).filter(models.UserMemory.user_id == current_user.id).first()
    if memory:
        db.delete(memory)
        db.commit()


@router.delete("/history", status_code=204)
def clear_all_history(current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(models.ChatMessage).filter(models.ChatMessage.user_id == current_user.id).delete()
    db.query(models.ChatSession).filter(models.ChatSession.user_id == current_user.id).delete()
    db.commit()


def _bg_extract_memory(user_id: int, user_message: str, assistant_reply: str):
    db = SessionLocal()
    try:
        extract_and_update_memory(user_id, user_message, assistant_reply, db)
    except Exception as e:
        print(f"[Memory Error] user={user_id}: {e}")
    finally:
        db.close()


def _bg_end_session(user_id: int, session_id: int):
    db = SessionLocal()
    try:
        session = db.query(models.ChatSession).filter(models.ChatSession.id == session_id).first()
        if session:
            latest = db.query(models.ChatMessage).filter(models.ChatMessage.session_id == session_id).order_by(models.ChatMessage.created_at.desc()).limit(2).all()
            if len(latest) >= 2:
                user_msg = latest[1].content
                ai_reply = latest[0].content
                extract_and_update_memory(user_id, user_msg, ai_reply, db)
    except Exception as e:
        print(f"[Session End Error] user={user_id} session={session_id}: {e}")
    finally:
        db.close()
