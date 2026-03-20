from groq import Groq
import os
import json
from dotenv import load_dotenv


load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))
MODEL = "llama-3.3-70b-versatile"
def analyze_profile(profile_data: dict) -> dict:
    profile_text = _format_profile_for_prompt(profile_data)

    prompt = f"""You are a LinkedIn profile expert who has studied thousands of top-performing LinkedIn profiles.
A user has shared their LinkedIn profile. Your job is to:

1. Give a detailed, honest analysis of their current profile strengths and weaknesses.
2. Rewrite their headline to be more impactful and keyword-rich.
3. Rewrite their summary/about section to be compelling, first-person, and action-oriented.
4. Suggest 10 additional relevant skills they should add.
5. Give 5 powerful LinkedIn post hooks relevant to their industry.
6. Provide 3 sets of relevant hashtags (5 hashtags each) for their content strategy.
7. Write a clear step-by-step improvement guide comparing them to top LinkedIn profiles.

Here is the user's LinkedIn profile:
{profile_text}

Respond ONLY with a valid JSON object (no markdown, no preamble):
{{
  "full_analysis": "Detailed 3-4 paragraph analysis...",
  "rewritten_headline": "The new improved headline...",
  "rewritten_summary": "The full rewritten About section...",
  "suggested_skills": ["skill1", "skill2", "skill3"],
  "hooks": ["Hook 1...", "Hook 2...", "Hook 3...", "Hook 4...", "Hook 5..."],
  "hashtags": [
    ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
    ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
  ],
  "improvement_guide": "Step-by-step guide..."
}}"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4000,
    )
    raw = response.choices[0].message.content.strip().strip("```json").strip("```").strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON if there's extra text
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


def chat_with_profile(
    user_message: str,
    profile_data: dict,
    chat_history: list,
    memory_context: str = ""
) -> dict:
    profile_text = _format_profile_for_prompt(profile_data)
    history_text = _format_history(chat_history)
    memory_block = f"\n{memory_context}\n" if memory_context else ""

    prompt = f"""You are a friendly and expert LinkedIn profile coach with memory of past conversations.
You have full access to the user's LinkedIn profile and know them personally from previous sessions.
{memory_block}
You help the user understand their profile analysis, answer questions, and improve their profile.

You can perform CRUD operations on the profile when the user asks:
- UPDATE: "change my headline to X", "update my summary", "add skill Y"
- DELETE: "remove skill X", "delete my certification"
- READ: answer any question about their profile data

When a CRUD operation is needed, include this block at the END of your reply:
<<<CRUD>>>
{{"action": "update", "field": "headline", "new_value": "value here"}}
<<<END>>>

Valid fields: headline, summary, experience, education, skills, certifications

Also classify this message by including this block at the END of your reply (after CRUD if any):
<<<META>>>
{{"intent": "crud_update|question|feedback_request|general", "topic": "headline|skills|hooks|analysis|experience|education|other"}}
<<<END_META>>>

The user's current LinkedIn profile:
{profile_text}

Recent conversation:
{history_text}

User message: {user_message}"""

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=4000,
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
    if not chat_history:
        return "(No previous messages)"
    lines = []
    for msg in chat_history[-10:]:
        role = "User" if msg["role"] == "user" else "Assistant"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)