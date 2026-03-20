from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


# ── Auth Schemas ──────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    linkedin_url: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    linkedin_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Profile Schemas ───────────────────────────────────────────────────────────

class ProfileOut(BaseModel):
    id: int
    user_id: int
    headline: Optional[str]
    summary: Optional[str]
    experience: Optional[str]
    education: Optional[str]
    skills: Optional[str]
    certifications: Optional[str]
    pdf_filename: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    headline: Optional[str] = None
    summary: Optional[str] = None
    experience: Optional[str] = None
    education: Optional[str] = None
    skills: Optional[str] = None
    certifications: Optional[str] = None


# ── Chat Schemas ──────────────────────────────────────────────────────────────

class ChatMessageIn(BaseModel):
    message: str


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatResponse(BaseModel):
    reply: str
    session_id: int
    updated_profile: Optional[ProfileOut] = None


# ── Analysis Schemas ──────────────────────────────────────────────────────────

class AnalysisOut(BaseModel):
    id: int
    user_id: int
    full_analysis: Optional[str]
    rewritten_headline: Optional[str]
    rewritten_summary: Optional[str]
    suggested_skills: Optional[str]
    hooks: Optional[str]
    hashtags: Optional[str]
    improvement_guide: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── Session + Memory Schemas ──────────────────────────────────────────────────

class ChatSessionOut(BaseModel):
    id: int
    title: Optional[str] = None
    summary: Optional[str] = None
    message_count: int
    created_at: datetime
    ended_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserMemoryOut(BaseModel):
    id: int
    user_id: int
    tone_preference: Optional[str] = None
    communication_style: Optional[str] = None
    writing_samples: Optional[str] = None
    career_goals: Optional[str] = None
    industry_focus: Optional[str] = None
    key_strengths: Optional[str] = None
    recurring_topics: Optional[str] = None
    disliked_suggestions: Optional[str] = None
    accepted_suggestions: Optional[str] = None
    pain_points: Optional[str] = None
    total_sessions: Optional[int] = None
    total_messages: Optional[int] = None
    avg_feedback_score: Optional[float] = None
    last_updated: Optional[datetime] = None

    class Config:
        from_attributes = True


# ── Session Schemas ───────────────────────────────────────────────────────────

class ChatSessionOut(BaseModel):
    id: int
    user_id: int
    title: Optional[str]
    summary: Optional[str]
    message_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Memory Schema ─────────────────────────────────────────────────────────────

class UserMemoryOut(BaseModel):
    id: int
    user_id: int
    tone_preference: Optional[str]
    communication_style: Optional[str]
    industry_focus: Optional[str]
    career_goals: Optional[str]
    key_strengths: Optional[str]
    pain_points: Optional[str]
    accepted_suggestions: Optional[str]
    disliked_suggestions: Optional[str]
    recurring_topics: Optional[str]
    writing_samples: Optional[str]
    total_sessions: Optional[int]
    total_messages: Optional[int]
    avg_feedback_score: Optional[float]
    last_updated: Optional[datetime]

    class Config:
        from_attributes = True
