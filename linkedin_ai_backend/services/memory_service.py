"""
memory_service.py

After every assistant reply, this service:
  1. Reads the latest exchange (user msg + assistant reply)
  2. Asks Claude to extract any new facts about the user
  3. Merges those facts into the UserMemory row (never overwrites, always enriches)
  4. Provides build_memory_context() used by ai_service to personalise responses
"""
from groq import Groq
import os
import json
from dotenv import load_dotenv
import models

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"
# ── Public API ──────────────────────────
# ──────────────────────────────────────


def build_memory_context(memory) -> str:
    """
    Returns a natural-language summary of what we know about the user.
    Injected into the system prompt of every chat response.
    """
    if not memory:
        return ""

    parts = []
    if memory.tone_preference:
        parts.append(f"Preferred tone: {memory.tone_preference}")
    if memory.communication_style:
        parts.append(f"Communication style: {memory.communication_style}")
    if memory.industry_focus:
        parts.append(f"Industry / domain: {memory.industry_focus}")
    if memory.career_goals:
        parts.append(f"Career goals: {memory.career_goals}")
    if memory.key_strengths:
        parts.append(f"Key strengths: {memory.key_strengths}")
    if memory.pain_points:
        parts.append(f"Known pain points: {memory.pain_points}")
    if memory.accepted_suggestions:
        parts.append(f"Advice styles they liked before: {memory.accepted_suggestions}")
    if memory.disliked_suggestions:
        parts.append(f"Advice styles to avoid: {memory.disliked_suggestions}")
    if memory.recurring_topics:
        parts.append(f"Topics they care about most: {memory.recurring_topics}")
    if memory.writing_samples:
        parts.append(f"Their own writing voice: {memory.writing_samples}")

    if not parts:
        return ""

    return (
        "=== What you already know about this user (use to personalise your reply) ===\n"
        + "\n".join(f"* {p}" for p in parts)
        + "\n=== End of user context ==="
    )


def extract_and_update_memory(
    user_id: int, user_message: str, assistant_reply: str, db: Session
) -> None:
    """
    Background call: extract insights from the latest exchange and
    merge them into the UserMemory row.
    """
    extraction = _extract_insights(user_message, assistant_reply)
    if not extraction:
        return
    _merge_into_memory(user_id, extraction, db)


# ── Internal helpers ──────────────────────────────────────────────────────────


def _extract_insights(user_message: str, assistant_reply: str) -> dict:
    prompt = f"""You are an insight extractor for a LinkedIn coaching AI.
Read this one conversation exchange and extract learnable facts about the USER only.
Only extract what is clearly shown — do not guess. Use null for anything not found.

User message: {user_message}
Assistant reply: {assistant_reply}

Respond ONLY with valid JSON, no markdown:
{{
  "tone_preference": "formal | casual | friendly | direct | null",
  "communication_style": "brief description or null",
  "industry_focus": "e.g. Software Engineering, Marketing or null",
  "career_goals": "what they seem to be working toward or null",
  "key_strengths": "strengths mentioned or null",
  "pain_points": "frustrations or challenges mentioned or null",
  "accepted_suggestion": "if user reacted positively to advice, describe it or null",
  "disliked_suggestion": "if user rejected advice, describe it or null",
  "recurring_topic": "topic they asked about that seems important or null",
  "writing_sample": "a sentence in their own voice if present, verbatim, or null"
}}"""

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
        )
        raw = response.choices[0].message.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1].lstrip("json").strip()
        raw = raw.rstrip("```").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"[Memory extraction error] {e}")
        return {}


def _merge_into_memory(user_id: int, data: dict, db: Session) -> None:
    memory = (
        db.query(models.UserMemory).filter(models.UserMemory.user_id == user_id).first()
    )
    if not memory:
        memory = models.UserMemory(user_id=user_id)
        db.add(memory)

    # Scalar fields — overwrite only with new non-null values
    _set_if_new(memory, "tone_preference", data.get("tone_preference"))
    _set_if_new(memory, "communication_style", data.get("communication_style"))
    _set_if_new(memory, "industry_focus", data.get("industry_focus"))

    # Append fields — accumulate facts, never lose old ones
    _append(memory, "career_goals", data.get("career_goals"))
    _append(memory, "key_strengths", data.get("key_strengths"))
    _append(memory, "pain_points", data.get("pain_points"))
    _append(memory, "accepted_suggestions", data.get("accepted_suggestion"))
    _append(memory, "disliked_suggestions", data.get("disliked_suggestion"))
    _append(memory, "recurring_topics", data.get("recurring_topic"))

    # Writing samples — keep last 3
    sample = data.get("writing_sample")
    if sample and _is_real(sample):
        existing = memory.writing_samples or ""
        samples = [s.strip() for s in existing.split("|||") if s.strip()]
        if sample not in samples:
            samples.append(sample)
            memory.writing_samples = " ||| ".join(samples[-3:])

    memory.total_messages = (memory.total_messages or 0) + 1
    db.commit()


def _is_real(val: str) -> bool:
    return bool(val) and val.lower() not in ("null", "none", "")


def _set_if_new(memory, field: str, value) -> None:
    if _is_real(str(value) if value else ""):
        setattr(memory, field, value)


def _append(memory, field: str, value) -> None:
    if not _is_real(str(value) if value else ""):
        return
    existing = getattr(memory, field) or ""
    items = [i.strip() for i in existing.split("|") if i.strip()]
    if value not in items:
        items.append(value)
        setattr(memory, field, " | ".join(items))
