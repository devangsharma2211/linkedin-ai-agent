from groq import Groq
import os
import json
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"


# ── Profile Analysis ──────────────────────────────────────────────────────────

def analyze_profile(profile_data: dict) -> dict:
    profile_text = _format_profile_for_prompt(profile_data)

    system_prompt = """You are a world-class LinkedIn strategist and personal branding expert.
You have helped thousands of professionals — from fresh graduates to Fortune 500 executives — transform their LinkedIn profiles into powerful career assets.

Your analysis is always:
- Brutally honest but encouraging
- Highly specific (you never give generic advice)
- Grounded in what actually works on LinkedIn in 2025 (keywords, algorithms, recruiter behavior)
- Tailored to the individual's industry, level, and goals

You write with clarity, authority, and warmth."""

    user_prompt = f"""Analyze the following LinkedIn profile thoroughly and return ONLY a valid JSON object.

Here is the user's LinkedIn profile:
{profile_text}

Your task:

1. **full_analysis** — Write 4-5 paragraphs covering:
   - What the profile does well (be specific, quote their actual words)
   - What's weak or missing (be direct, explain the impact on recruiters/opportunities)
   - How it compares to top profiles in their industry
   - What their profile currently communicates vs. what it should communicate

2. **rewritten_headline** — Rewrite their headline to be:
   - Under 220 characters
   - Keyword-rich for their industry
   - Value-focused (what they do + who they help + unique angle)
   - Example format: "Senior Product Manager | Driving 0→1 Products in Fintech | Ex-Google | Building teams that ship"

3. **rewritten_summary** — Rewrite their About section to be:
   - 3-4 punchy paragraphs in first person
   - Opens with a hook (not "I am a..." — start with impact or a bold statement)
   - Covers: what they do, their unique approach, key achievements with numbers, what they're looking for
   - Ends with a clear CTA

4. **suggested_skills** — List exactly 10 skills they are missing that:
   - Are highly searched by recruiters in their industry
   - Match their background (don't suggest skills they clearly don't have)
   - Include a mix of technical and soft skills

5. **hooks** — Write 5 LinkedIn post opening lines that would stop someone mid-scroll:
   - Each hook should be under 2 lines
   - Based on their actual experience, not generic topics
   - Use proven hook formats: contrarian take, personal story opener, bold stat, unpopular opinion, "X years ago I..."

6. **hashtags** — Provide 3 sets of 5 hashtags each:
   - Set 1: Industry/niche specific
   - Set 2: Career/professional growth
   - Set 3: Content strategy/thought leadership

7. **improvement_guide** — Write a numbered step-by-step action plan (at least 8 steps) that:
   - Prioritizes the highest-impact changes first
   - Gives specific instructions for each step (not vague advice)
   - Includes what to do in the first 24 hours, first week, and first month

Respond ONLY with a valid JSON object (no markdown, no preamble, no explanation):
{{
  "full_analysis": "...",
  "rewritten_headline": "...",
  "rewritten_summary": "...",
  "suggested_skills": ["skill1", "skill2", ...],
  "hooks": ["Hook 1...", "Hook 2...", ...],
  "hashtags": [
    ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  ],
  "improvement_guide": "1. ...\n2. ...\n3. ..."
}}"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
        max_tokens=8192,
        temperature=0.7,
    )
    raw = response.choices[0].message.content.strip().strip("```json").strip("```").strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find('{')
        end = raw.rfind('}') + 1
        result = json.loads(raw[start:end])

    return {
        "full_analysis":      result.get("full_analysis", ""),
        "rewritten_headline": result.get("rewritten_headline", ""),
        "rewritten_summary":  result.get("rewritten_summary", ""),
        "suggested_skills":   json.dumps(result.get("suggested_skills", [])),
        "hooks":              json.dumps(result.get("hooks", [])),
        "hashtags":           json.dumps(result.get("hashtags", [])),
        "improvement_guide":  result.get("improvement_guide", ""),
    }


# ── Chat ──────────────────────────────────────────────────────────────────────

def chat_with_profile(
    user_message: str,
    profile_data: dict,
    chat_history: list,
    memory_context: str = ""
) -> dict:
    profile_text = _format_profile_for_prompt(profile_data)
    memory_block = f"\n--- WHAT YOU KNOW ABOUT THIS USER FROM PAST SESSIONS ---\n{memory_context}\n---\n" if memory_context else ""

    system_prompt = f"""You are an elite LinkedIn coach and personal branding strategist — sharp, warm, and deeply knowledgeable.

You have full context of this user's LinkedIn profile and remember everything from your past conversations with them.
{memory_block}
--- USER'S CURRENT LINKEDIN PROFILE ---
{profile_text}
---

YOUR COACHING STYLE:
- You give specific, actionable advice — never vague or generic
- You reference the user's actual profile content in your answers ("Your current headline says X, here's why that's limiting you...")
- You explain the *why* behind every suggestion (recruiter psychology, LinkedIn algorithm, industry norms)
- You ask clarifying questions when needed to give better advice
- You celebrate wins and progress — you're invested in their success
- You write in a clear, conversational tone — no corporate fluff, no bullet-point walls unless it genuinely helps

PROFILE UPDATE CAPABILITY:
When the user asks you to change, update, add, or remove something from their profile, you:
1. Make the change AND explain what you changed and why it's better
2. Append a CRUD block at the END of your reply (after your full response):

<<<CRUD>>>
{{"action": "update", "field": "headline", "new_value": "the full new value here"}}
<<<END>>>

Valid fields: headline, summary, experience, education, skills, certifications

MESSAGE CLASSIFICATION:
Always append this at the very end of your reply:
<<<META>>>
{{"intent": "crud_update|question|feedback_request|general", "topic": "headline|skills|hooks|analysis|experience|education|other"}}
<<<END_META>>>"""

    # Build proper conversational message array
    messages = [{"role": "system", "content": system_prompt}]

    # Add real conversation history as alternating user/assistant turns
    for msg in chat_history[-12:]:  # last 12 messages = 6 turns
        role = "user" if msg["role"] == "user" else "assistant"
        # Strip META/CRUD blocks from history to keep it clean
        content = msg["content"]
        if "<<<META>>>" in content:
            content = content.split("<<<META>>>")[0].strip()
        if "<<<CRUD>>>" in content:
            content = content.split("<<<CRUD>>>")[0].strip()
        messages.append({"role": role, "content": content})

    # Add the current user message
    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
        max_tokens=8192,
        temperature=0.75,
    )
    full_reply = response.choices[0].message.content.strip()

    crud_action = None
    intent = "general"
    topic = "other"

    # Parse META block
    if "<<<META>>>" in full_reply and "<<<END_META>>>" in full_reply:
        parts = full_reply.split("<<<META>>>")
        full_reply = parts[0].strip()
        meta_block = parts[1].split("<<<END_META>>>")[0].strip()
        try:
            meta = json.loads(meta_block)
            intent = meta.get("intent", "general")
            topic = meta.get("topic", "other")
        except json.JSONDecodeError:
            pass

    # Parse CRUD block
    if "<<<CRUD>>>" in full_reply and "<<<END>>>" in full_reply:
        parts = full_reply.split("<<<CRUD>>>")
        full_reply = parts[0].strip()
        crud_block = parts[1].split("<<<END>>>")[0].strip()
        try:
            crud_action = json.loads(crud_block)
        except json.JSONDecodeError:
            crud_action = None

    return {
        "reply":       full_reply,
        "crud_action": crud_action,
        "intent":      intent,
        "topic":       topic,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_profile_for_prompt(profile_data: dict) -> str:
    parts = []
    if profile_data.get("headline"):
        parts.append(f"HEADLINE:\n{profile_data['headline']}")
    if profile_data.get("summary"):
        parts.append(f"ABOUT / SUMMARY:\n{profile_data['summary']}")
    if profile_data.get("experience"):
        parts.append(f"EXPERIENCE:\n{profile_data['experience']}")
    if profile_data.get("education"):
        parts.append(f"EDUCATION:\n{profile_data['education']}")
    if profile_data.get("skills"):
        parts.append(f"SKILLS:\n{profile_data['skills']}")
    if profile_data.get("certifications"):
        parts.append(f"CERTIFICATIONS:\n{profile_data['certifications']}")
    return "\n\n".join(parts) if parts else "No profile data available yet."


def _format_history(chat_history: list) -> str:
    """Legacy helper — kept for compatibility but no longer used in chat_with_profile."""
    if not chat_history:
        return "(No previous messages)"
    lines = []
    for msg in chat_history[-10:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)
