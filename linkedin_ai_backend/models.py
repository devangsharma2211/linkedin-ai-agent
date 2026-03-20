from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(200), nullable=False)
    linkedin_url = Column(String(300), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    profile = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete")
    chat_sessions = relationship("ChatSession", back_populates="user", cascade="all, delete")
    chat_messages = relationship("ChatMessage", back_populates="user", cascade="all, delete")
    analysis = relationship("Analysis", back_populates="user", uselist=False, cascade="all, delete")
    memory = relationship("UserMemory", back_populates="user", uselist=False, cascade="all, delete")


class ChatSession(Base):
    """Groups messages into one logical sitting/conversation."""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(200), nullable=True)
    summary = Column(Text, nullable=True)
    message_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    intent = Column(String(100), nullable=True)
    topic = Column(String(100), nullable=True)
    feedback_score = Column(Integer, nullable=True)
    was_helpful = Column(Boolean, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    user = relationship("User", back_populates="chat_messages")
    session = relationship("ChatSession", back_populates="messages")


class UserMemory(Base):
    """Evolving user profile built from all past conversations."""
    __tablename__ = "user_memory"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    tone_preference = Column(String(100), nullable=True)
    communication_style = Column(Text, nullable=True)
    writing_samples = Column(Text, nullable=True)
    career_goals = Column(Text, nullable=True)
    industry_focus = Column(String(200), nullable=True)
    key_strengths = Column(Text, nullable=True)
    recurring_topics = Column(Text, nullable=True)
    disliked_suggestions = Column(Text, nullable=True)
    accepted_suggestions = Column(Text, nullable=True)
    pain_points = Column(Text, nullable=True)
    total_sessions = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    avg_feedback_score = Column(Float, nullable=True)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    user = relationship("User", back_populates="memory")


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    raw_text = Column(Text, nullable=True)
    headline = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    experience = Column(Text, nullable=True)
    education = Column(Text, nullable=True)
    skills = Column(Text, nullable=True)
    certifications = Column(Text, nullable=True)
    pdf_filename = Column(String(200), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="profile")


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    full_analysis = Column(Text, nullable=True)
    rewritten_headline = Column(Text, nullable=True)
    rewritten_summary = Column(Text, nullable=True)
    suggested_skills = Column(Text, nullable=True)
    hooks = Column(Text, nullable=True)
    hashtags = Column(Text, nullable=True)
    improvement_guide = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="analysis")
