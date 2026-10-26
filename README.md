# LinkedAI — AI LinkedIn Profile Analyzer & Coach

LinkedAI is a full-stack web app that turns a user's LinkedIn profile PDF into an
actionable improvement plan, and then stays with them as a **conversational AI coach**
that remembers who they are across sessions.

You upload your LinkedIn "Save to PDF" export → the app parses it into structured
sections → an LLM analyzes it and returns rewritten headline/summary, suggested skills,
post hooks, hashtags, and a step-by-step improvement guide → you then chat with an AI
coach that knows your profile and remembers your tone, goals, and preferences over time.
When you ask the coach to change something ("add Python to my skills", "rewrite my
headline"), it updates your profile in the database automatically through the chat.

> The repo is a monorepo with two folders:
> - `linkedin_ai_backend/` — FastAPI + SQLAlchemy + Groq (Python)
> - `linkedin_frontend/` — React + Vite + Three.js + Framer Motion

---

## Table of Contents

1. [What Problem It Solves](#what-problem-it-solves)
2. [High-Level Architecture](#high-level-architecture)
3. [Technology Stack](#technology-stack)
4. [The End-to-End Pipeline](#the-end-to-end-pipeline)
5. [Backend Logic in Detail](#backend-logic-in-detail)
   - [PDF Parsing](#1-pdf-parsing)
   - [AI Profile Analysis](#2-ai-profile-analysis)
   - [The Chat Engine (with CRUD)](#3-the-chat-engine-with-crud)
   - [The Memory System](#4-the-memory-system)
   - [Security & Hardening](#5-security--hardening)
6. [Database Schema](#database-schema)
7. [Frontend Logic in Detail](#frontend-logic-in-detail)
8. [Project Structure](#project-structure)
9. [API Reference](#api-reference)
10. [Environment Variables](#environment-variables)
11. [Local Setup](#local-setup)
12. [How to Explain This in an Interview](#how-to-explain-this-in-an-interview)

---

## What Problem It Solves

Most people's LinkedIn profiles are weak: vague headlines, "I am a…" summaries,
missing skills, no content plan. Fixing it manually is hard because you don't know
what recruiters or the LinkedIn algorithm actually reward.

LinkedAI solves this in two layers:

1. **One-shot analysis** — Upload your PDF, get a brutally honest, specific audit plus
   ready-to-paste rewrites and a content plan.
2. **Ongoing coaching with memory** — Chat with an AI coach that (a) knows your exact
   profile, (b) can edit your profile for you directly through chat, and (c) gradually
   learns your tone, goals, and what advice you like/dislike so future replies get
   more personalized.

The memory piece is the differentiator: the coach doesn't reset every conversation.
It accumulates a profile of *you* across sessions.

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React + Vite)                         │
│  AuthPage → Dashboard → Upload → Chat → Analysis                     │
│       │                                    │                           │
│       │  axios (JWT in localStorage)       │  react-dropzone upload   │
│       │  Vite proxy /api → :8000           │                           │
└───────┼────────────────────────────────────┼──────────────────────────┘
        │                                    │
        ▼                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     BACKEND  (FastAPI :8000)                          │
│                                                                      │
│  Middleware: CORS · rate limiting (slowapi) · security headers ·     │
│              request size cap · global error handler                 │
│                                                                      │
│  Routers:   auth.py   profile.py   chat.py                            │
│       │          │           │                                       │
│       ▼          ▼           ▼                                       │
│  utils/security   services/pdf_parser   services/ai_service         │
│  (JWT, bcrypt,    (pdfplumber, regex)   (Groq llama-3.3-70b)         │
│   brute-force,                           services/memory_service       │
│   sanitization)                          (background LLM extraction)  │
│       │          │           │                                       │
│       └──────────┴───────────┴───► SQLAlchemy ORM ──► Database       │
│                                                  (SQLite / Postgres)  │
└──────────────────────────────────────────────────────────────────────┘
```

The three layers:

- **Frontend** is a SPA. It holds the JWT in `localStorage`, attaches it to every
  request via an axios interceptor, and handles auth state through React Context.
- **Backend** is a stateless FastAPI app. Each request is authenticated by decoding
  the JWT and loading the `User`. Heavy work (analysis, memory extraction) runs as
  FastAPI `BackgroundTasks` so the HTTP response stays fast.
- **Database** stores users, profiles, chat sessions/messages, AI analyses, and the
  evolving `UserMemory` row. SQLite for dev, Postgres for prod (configured via
  `DATABASE_URL`).

---

## Technology Stack

### Backend (`linkedin_ai_backend/requirements.txt`)

| Library | Why it's here |
|---|---|
| **FastAPI** 0.110 | Web framework — async, auto OpenAPI docs at `/docs` |
| **Uvicorn** | ASGI server that runs FastAPI |
| **SQLAlchemy** 2.0 | ORM — maps Python classes to DB tables |
| **Pydantic** 2.6 (+email) | Request/response validation; `EmailStr`, strict schemas |
| **PyJWT** 2.8 | Creates and verifies JWT access tokens (HS256) |
| **bcrypt** 4.1 | Password hashing + verification |
| **pdfplumber** 0.11 | Extracts text from the uploaded LinkedIn PDF |
| **groq** 0.5 | Official SDK for Groq's ultra-fast LLM inference |
| **slowapi** 0.1.9 | Rate limiting per IP (login, register, upload, global) |
| **bleach** 6.1 | Strips HTML tags from user input to prevent XSS |
| **httpx** | Async HTTP client (Groq SDK dependency) |
| **aiofiles** | Async file writes for PDF uploads |
| **python-multipart** | Parses `multipart/form-data` file uploads |
| **python-dotenv** | Loads `.env` variables |
| **psycopg2-binary** | Postgres driver (used when `DATABASE_URL` points to Postgres) |

### AI

- **Groq Cloud** as the LLM provider — chosen for low latency.
- **Model:** `llama-3.3-70b-versatile` for both analysis and chat.
- The model is prompted to return **strict JSON**, parsed and stored in the DB.

### Frontend (`linkedin_frontend/package.json`)

| Library | Why it's here |
|---|---|
| **React 18** | UI framework |
| **Vite 5** | Dev server + build tool; proxies `/api` → `:8000` |
| **React Router v6** | Client-side routing with route guards |
| **Three.js + @react-three/fiber + @react-three/drei** | The always-on animated 3D blob background |
| **Framer Motion** | Page transitions, message animations, panel reveals |
| **GSAP** | The preloader timeline (progress bar + letter stagger) |
| **react-dropzone** | Drag-and-drop PDF upload |
| **react-markdown** | Renders AI markdown replies with formatting |
| **react-hot-toast** | Toast notifications |
| **lucide-react** | Icon set |
| **axios** | HTTP client with request/response interceptors |

### Database

- **SQLite** (file `linkedin_ai.db`) for local dev — zero config.
- **PostgreSQL** ready for production via `DATABASE_URL` + `psycopg2-binary`.
- Tables auto-created on startup with `Base.metadata.create_all(bind=engine)`.

---

## The End-to-End Pipeline

This is the single most important thing to understand for an interview:

```
1. REGISTER / LOGIN
   └─ bcrypt hashes password · JWT (HS256, 60 min) issued · stored in localStorage

2. UPLOAD LinkedIn PDF  (/profile/upload)
   ├─ Security checks: .pdf extension · %PDF magic bytes · secure random filename ·
   │                    path-traversal guard · 5/hour rate limit · 10MB body cap
   ├─ pdfplumber extracts raw text
   ├─ parse_linkedin_sections() splits text into headline/summary/experience/
   │   education/skills/certifications using known LinkedIn section headers
   ├─ Structured profile UPSERTED into the `profiles` table
   └─ Background task _run_analysis() kicks off (HTTP response returns immediately)

3. AI ANALYSIS  (background)
   └─ ai_service.analyze_profile() sends profile to llama-3.3-70b with a detailed
      prompt → returns JSON: full_analysis, rewritten_headline, rewritten_summary,
      10 suggested_skills, 5 hooks, 3x5 hashtags, 8+ step improvement_guide
      → stored in the `analyses` table. User reads it on /analysis.

4. CHAT  (/chat/send)
   ├─ Load profile + last 20 messages + UserMemory
   ├─ build_memory_context() turns memory into a natural-language block
   ├─ ai_service.chat_with_profile() sends system prompt (profile + memory) +
   │   last 12 messages + new message → llama-3.3-70b
   ├─ AI reply contains two trailing blocks:
   │     <<<CRUD>>> {"action":"update","field":"skills","new_value":"..."} <<<END>>>
   │     <<<META>>> {"intent":"crud_update","topic":"skills"}            <<<END_META>>>
   ├─ Backend strips those blocks from the visible reply, stores clean messages,
   │   and if a valid CRUD action targets an allowed field → updates the profile row
   └─ Every 5 messages a background task extracts insights → merges into UserMemory

5. MEMORY  (background, async)
   └─ memory_service._extract_insights() asks the LLM to pull learnable facts from
      the last exchange → _merge_into_memory() updates UserMemory:
        • scalar fields (tone, industry) overwrite only with new non-null values
        • list fields (goals, strengths, pain points) APPEND, never lose old facts
        • writing samples keep the last 3
      → this context is injected into every future chat's system prompt
```

The whole point: **analysis is instant because it runs in the background, and the coach
gets smarter the more you talk to it.**

---

## Backend Logic in Detail

### 1. PDF Parsing (`services/pdf_parser.py`)

`extract_text_from_pdf()` opens the PDF with `pdfplumber` and concatenates every page's
text. `parse_linkedin_sections()` then:

- Takes the second non-empty line as the **headline** (line 0 is the name).
- Scans for known LinkedIn section markers: `Summary`/`About`, `Experience`,
  `Education`, `Skills`/`Top Skills`, `Licenses & Certifications`/`Certifications`.
- Slices the text between consecutive markers to isolate each section's content.
- Normalizes the output:
  - `experience` and `education` are split into blocks at date patterns
    (`Jan 2020 - …`) and stored as JSON arrays.
  - `skills` are split on commas / newlines / bullets into a JSON list.

Result: a dict the AI service and the profile API can both consume.

### 2. AI Profile Analysis (`services/ai_service.py` → `analyze_profile`)

- Builds a system prompt casting the model as a "world-class LinkedIn strategist."
- Sends the formatted profile and asks for **only a JSON object** with seven keys.
- Cleans the LLM output (strips ```json fences, finds the first `{` … last `}`).
- List/array fields are `json.dumps`'d before storage so they fit in text columns.
- Runs as a **FastAPI BackgroundTask** (`_run_analysis` in `routers/profile.py`), which
  opens its own DB session — this is why the upload endpoint returns instantly even
  though analysis takes a few seconds.

### 3. The Chat Engine (with CRUD) (`routers/chat.py` + `ai_service.chat_with_profile`)

This is the most interesting backend logic.

**Message construction:**
- System prompt = coach persona + the user's full structured profile + a
  `build_memory_context()` block (what we know about them from past sessions).
- Last 12 messages of history are appended as real `user`/`assistant` turns, with any
  previous `<<<META>>>`/`<<<CRUD>>>` blocks stripped so history stays clean.
- The new user message is appended last.

**The two structured blocks the AI returns:**
- `<<<CRUD>>> … <<<END>>>` — when the user asks to change the profile. Contains
  `action`, `field`, `new_value`. Valid fields: `headline, summary, experience,
  education, skills, certifications`.
- `<<<META>>> … <<<END_META>>>` — classification: `intent`
  (`crud_update|question|feedback_request|general`) and `topic`
  (`headline|skills|hooks|analysis|experience|education|other`).

**What the backend does:**
- Parses both blocks out of the raw reply so the user only sees the clean response.
- Stores both the user message and assistant reply with `intent`/`topic` metadata.
- If a valid CRUD action targets an allowed field → `setattr(profile, field, new_value)`
  updates the DB, and the updated profile is returned to the frontend (which shows a
  "Profile updated!" toast).
- Increments the session's message count; every 5th exchange triggers background
  memory extraction.

**Sessions & history:** messages are grouped into `ChatSession` rows. You can list
sessions, load one, end one (which also triggers a final memory extraction), and rate
any assistant message 1–5 (stored on the message; rolls into `UserMemory.avg_feedback_score`).

### 4. The Memory System (`services/memory_service.py`)

The memory system is what makes the coach feel personal over time.

**`build_memory_context(memory)`** — turns the `UserMemory` row into a bulleted
natural-language block ("Preferred tone: …", "Career goals: …", "Advice styles to
avoid: …") that gets injected into every chat system prompt.

**`extract_and_update_memory()`** — a background task that:
1. Calls the LLM with a strict-JSON prompt asking it to extract learnable *facts about
   the user* from the latest exchange (tone, industry, goals, strengths, pain points,
   accepted/disliked suggestions, recurring topics, a verbatim writing sample).
2. Merges results into `UserMemory` with a careful strategy:
   - **Scalar fields** (`tone_preference`, `industry_focus`, `communication_style`):
     overwrite **only** when the new value is non-null/non-"null".
   - **Append fields** (`career_goals`, `key_strengths`, `pain_points`,
     `accepted_suggestions`, `disliked_suggestions`, `recurring_topics`): split on `|`,
     append only if not already present — facts are never lost.
   - **Writing samples**: keep the most recent 3, joined by `|||`.
3. Increments `total_messages`.

Triggers: every 5th message in a session, and on session end.

### 5. Security & Hardening (`utils/security.py` + `main.py`)

This project deliberately layers defense-in-depth — great talking points:

- **Auth:** bcrypt password hashing; JWT (HS256, 60-min expiry, `sub` = email); the
  `get_current_user` dependency decodes the token on every protected route.
- **Brute-force protection:** in-memory per-IP failed-login counter; after 5 failures
  in a 5-minute window the IP is blocked (HTTP 429). Successful login clears the counter.
- **Rate limiting (slowapi):** global 200/min, register 5/min, login 10/min,
  upload 5/hour.
- **Password strength:** minimum 8 chars, requires an uppercase letter and a number.
- **Input sanitization:** `bleach.clean()` strips tags from free-text input (XSS).
- **Email enumeration prevention:** login returns the same "Incorrect email or
  password." whether the email or the password was wrong.
- **Secure file uploads:** `.pdf` extension check, `%PDF` magic-byte validation,
  `secrets.token_hex` random filename (prevents path traversal), and an `abspath`
  containment check on the destination.
- **Security headers middleware:** sets `X-Content-Type-Options`, `X-Frame-Options:
  DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`,
  `Strict-Transport-Security`, and `Cache-Control: no-store`. Also rejects any request
  with `Content-Length > 10MB` (HTTP 413) before it reaches a handler.
- **Error handling:** a `RequestValidationError` handler returns clean 422 errors with
  field-level messages; a global `Exception` handler logs and returns a generic 500.
- **CORS:** permissive in dev (`*`, no credentials) with a note to tighten for prod.
- **Docs:** `/docs` (Swagger) disabled when `ENV=production`.

> ⚠️ Known gaps to be honest about in an interview: brute-force tracking and the
> `UserMemory` are **in-memory / per-process** (a multi-worker deploy would reset
> them); CORS is `*` in dev; secrets use a dev fallback default if unset. These are
> flagged in the code comments as production hardening TODOs.

---

## Database Schema

Six tables, all linked to `User` with `cascade="all, delete"` so deleting an account
removes everything.

```
users
 ├─ id, name, email (unique), hashed_password, linkedin_url, created_at, is_active
 │
 ├─< profiles  (1:1)
 │     headline, summary, experience (JSON), education (JSON), skills (JSON),
 │     certifications (JSON), pdf_filename, raw_text, timestamps
 │
 ├─< analyses  (1:1)
 │     full_analysis, rewritten_headline, rewritten_summary, suggested_skills,
 │     hooks, hashtags, improvement_guide, timestamps
 │
 ├─< chat_sessions  (1:N)
 │     title, summary, message_count, created_at, ended_at
 │     └─< chat_messages (1:N)
 │           role, content, intent, topic, feedback_score, was_helpful, created_at
 │
 └─< user_memory  (1:1)
       tone_preference, communication_style, writing_samples, career_goals,
       industry_focus, key_strengths, recurring_topics, disliked_suggestions,
       accepted_suggestions, pain_points, total_sessions, total_messages,
       avg_feedback_score, last_updated
```

The schema is defined in `models.py` with SQLAlchemy `Column`s and `relationship`s;
Pydantic schemas in `schemas.py` validate the HTTP layer and power the auto-generated
`/docs`.

---

## Frontend Logic in Detail

### Routing & Auth (`App.jsx`, `context/AuthContext.jsx`)

- Routes: `/login`, `/dashboard`, `/upload`, `/chat`, `/analysis`. Unknown paths
  redirect to `/login`.
- A `<Private>` wrapper guards authenticated routes — it reads `useAuth()` and
  `<Navigate>`s to `/login` if there's no user.
- `AuthProvider` checks `localStorage` for a token on mount and calls `GET /auth/me`
  to hydrate the user. Logout clears the token and hard-reloads to wipe state.
- Pages are `lazy()`-loaded with `Suspense` so the initial bundle stays small.

### API layer (`services/api.js`)

- One `axios` instance with `baseURL = '/api'` (Vite proxies `/api` → `:8000`).
- **Request interceptor** attaches `Authorization: Bearer <token>` from `localStorage`.
- **Response interceptor** auto-logs-out (clears token, redirects to `/login`) on any
  `401`. This keeps the JWT handling DRY across every page.

### Chat UX (`pages/ChatPage.jsx`)

- **Sessions sidebar:** lists past conversations, can start a new chat, can open an
  existing one (which ends the previous session).
- **Optimistic UI:** the user's message is added to the list instantly with a temp id
  before the API responds; on success the temp id is replaced and the assistant reply
  appended. On failure the optimistic message is removed.
- **Memory panel:** a collapsible grid showing tone/industry/goals/strengths the AI
  has learned, plus a "Memory active" pill in the top bar.
- **Message feedback:** thumbs up/down on each assistant reply → `PATCH /chat/message/:id/rate`.
- **Auto-scroll** to the newest message, **auto-resizing textarea** (capped at 180px),
  Enter to send / Shift+Enter for newline.
- AI replies rendered with `react-markdown` using custom component overrides.

### Animation (`components/Scene3D.jsx`, `components/Preloader.jsx`)

- **Preloader:** a GSAP timeline animates a progress bar `scaleX 0→1`, a 0%→100%
  counter, and a letter-by-letter stagger of "LinkedAI", then fades out.
- **3D background:** a fixed `@react-three/fiber` `<Canvas>` with floating distorted
  blobs (`MeshDistortMaterial` + `Float`) behind everything (`z-index: 0`). A `CameraRig`
  lerps the camera toward the mouse position. UI sits at `z-index: 2`.
- **Page transitions:** `AnimatePresence mode="wait"` around `<Routes>` with
  `motion.div` enter/exit variants on every page.

---

## Project Structure

```
linkedin-ai-agent/
├── README.md                      ← you are here
├── .gitignore
├── linkedin_ai_backend/
│   ├── main.py                     FastAPI app, middleware, routers wired in
│   ├── database.py                 SQLAlchemy engine/session/get_db dependency
│   ├── models.py                   6 ORM tables + relationships
│   ├── schemas.py                  Pydantic request/response schemas
│   ├── requirements.txt
│   ├── .env / .env.example
│   ├── routers/
│   │   ├── auth.py                 register, login, me, delete account
│   │   ├── profile.py              upload, get/patch/delete profile, get analysis
│   │   └── chat.py                 send, sessions, history, memory, rate, end
│   ├── services/
│   │   ├── pdf_parser.py           pdfplumber + section parser
│   │   ├── ai_service.py           Groq prompts: analysis + chat
│   │   └── memory_service.py       background insight extraction + merge
│   ├── utils/
│   │   └── security.py             bcrypt, JWT, brute-force, sanitization
│   └── uploads/                    stored PDFs (gitignored)
└── linkedin_frontend/
    ├── index.html
    ├── vite.config.js              /api proxy → :8000
    ├── package.json
    ├── .env
    └── src/
        ├── main.jsx                React root
        ├── App.jsx                 routes + auth guard + animation wrappers
        ├── index.css               design tokens / global styles
        ├── context/AuthContext.jsx  auth state + token hydration
        ├── services/api.js          axios instance + interceptors + endpoint fns
        ├── components/
        │   ├── Preloader.jsx        GSAP intro timeline
        │   └── Scene3D.jsx          Three.js background
        └── pages/
            ├── AuthPage.jsx        login + register toggle
            ├── DashboardPage.jsx   overview / stats / quick nav
            ├── UploadPage.jsx       drag-drop PDF upload
            ├── ChatPage.jsx         full chat with sessions + memory
            └── AnalysisPage.jsx     renders AI analysis results
```

---

## API Reference

All protected routes require `Authorization: Bearer <jwt>`.

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account (password-strength validated) |
| POST | `/auth/login` | Log in → `{ access_token, token_type }` |
| GET | `/auth/me` | Current user info |
| DELETE | `/auth/me` | Permanently delete account + all data |

### Profile
| Method | Endpoint | Description |
|---|---|---|
| POST | `/profile/upload` | Upload LinkedIn PDF (multipart); triggers background analysis |
| GET | `/profile/` | Get parsed profile |
| PATCH | `/profile/` | Manually update profile fields |
| DELETE | `/profile/` | Delete profile + stored PDF |
| GET | `/profile/analysis` | Get AI analysis results |

### Chat
| Method | Endpoint | Description |
|---|---|---|
| POST | `/chat/send?session_id=` | Send message → AI reply (auto CRUD + memory) |
| GET | `/chat/sessions` | List chat sessions |
| GET | `/chat/session/{id}` | Get messages in a session |
| POST | `/chat/session/{id}/end` | End a session (triggers final memory extraction) |
| PATCH | `/chat/message/{id}/rate?score=1..5` | Rate an assistant message |
| GET | `/chat/history` | Get all messages (newest first) |
| DELETE | `/chat/history` | Clear all chat history |
| GET | `/chat/memory` | Get the AI's accumulated memory of you |
| DELETE | `/chat/memory` | Clear memory |

### Health
| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | `{ status, version }` |
| GET | `/health` | `{ status: "ok", timestamp }` |
| GET | `/ping` | `{ pong: true }` |

---

## Environment Variables

Backend (`linkedin_ai_backend/.env`) — referenced by name only, never committed:

| Variable | Purpose | Default |
|---|---|---|
| `GROQ_API_KEY` | Groq Cloud API key (required) | none |
| `SECRET_KEY` | JWT signing secret | dev fallback (change in prod) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime | `60` |
| `DATABASE_URL` | DB connection string | `sqlite:///./linkedin_ai.db` |
| `ENV` | `production` disables `/docs` | `development` |
| `UPLOAD_DIR` | Where uploaded PDFs are stored | `uploads` |

Frontend (`linkedin_frontend/.env`):

| Variable | Purpose | Default |
|---|---|---|
| `VITE_API_URL` | Backend base URL | `/api` (uses Vite proxy) |

`.env`, `*.db`, and `uploads/` are all in `.gitignore`.

---

## Local Setup

### Backend
```bash
cd linkedin_ai_backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                              # then fill in GROQ_API_KEY + SECRET_KEY
uvicorn main:app --reload                         # http://localhost:8000  (docs at /docs)
```

### Frontend (in another terminal)
```bash
cd linkedin_frontend
npm install
npm run dev                                       # http://localhost:3000  (proxies /api → :8000)
```

### Get a LinkedIn PDF
1. Open your LinkedIn profile → **More** (below your photo) → **Save to PDF**.
2. Upload that file on the `/upload` page.

---

## How to Explain This in an Interview

A short script you can say out loud, plus the questions you're most likely to get.

### 30-second pitch
> "LinkedAI is a full-stack app that analyzes a user's LinkedIn PDF and then coaches
> them through a chatbot that remembers them over time. The frontend is React with a
> Three.js animated background; the backend is FastAPI with SQLAlchemy and the Groq
> LLM. You upload your LinkedIn export, we parse it with pdfplumber, send it to
> llama-3.3-70b for a full audit plus rewrites and a content plan, and then a chat
> coach can even edit your profile directly from natural language. The interesting
> part is the memory layer: every few messages a background job extracts facts about
> the user and merges them into a profile row, so the coach's replies get more
> personalized the more you use it."

### Likely questions & strong answers

**Q: How does the chatbot update the profile from natural language?**
The LLM is instructed to append a `<<<CRUD>>>` JSON block at the end of its reply
whenever the user asks to change something. The backend parses that block out,
validates the field is in an allow-list (`headline, summary, experience, education,
skills, certifications`), and uses `setattr(profile, field, new_value)` to update the
row. The visible reply has the block stripped, so the user just sees a normal answer
plus a "profile updated" toast.

**Q: How does memory work and why is it a background task?**
After every 5th message (and on session end), a `BackgroundTask` sends the latest
exchange to the LLM with a strict-JSON prompt asking it to extract only clearly-stated
facts about the user. Those facts are merged into a `UserMemory` row — scalar fields
overwrite only with new non-null values, list fields append without losing old ones,
writing samples keep the last three. We do it in the background so the chat response
stays fast, and `build_memory_context()` turns that row into a natural-language block
injected into every future system prompt.

**Q: Why Groq / llama instead of OpenAI/Claude?**
Groq runs Llama 3.3 70B on dedicated hardware with very low latency, which matters
for a chat experience, and it's much cheaper. The model is prompted to return strict
JSON, which we parse defensively (stripping fences, finding the outer braces).

**Q: What security measures did you implement?**
bcrypt for passwords, JWT (HS256, 60-min) for auth, per-IP brute-force tracking that
blocks after 5 failed logins in 5 minutes, slowapi rate limits (global 200/min,
upload 5/hour), bleach sanitization against XSS, password-strength validation, generic
login errors to prevent email enumeration, and secure PDF uploads (extension +
`%PDF` magic-byte + random filename + path-traversal containment). A middleware also
injects security headers and caps request size at 10MB.

**Q: How is the app structured / layered?**
Routers (HTTP) → services (business logic: pdf parsing, AI, memory) → models/ORM → DB.
`utils/security` holds cross-cutting auth concerns. Pydantic schemas sit between HTTP
and ORM for validation. The frontend mirrors this: pages (UI) → services/api
(networking) → context (global state).

**Q: What would you improve for production?**
Move brute-force tracking and any shared state into Redis (currently per-process);
swap SQLite for Postgres; tighten CORS to the real frontend origin; store PDFs on S3
instead of local disk; run the secret from a secrets manager not a fallback default;
add tests for the parser and the CRUD/metadata block parsing.

**Q: Where does the heavy work happen?**
Profile analysis and memory extraction both run as FastAPI `BackgroundTasks` with their
own DB sessions, so the upload/send responses return immediately while the LLM work
continues after the response is sent.

---

_Built with FastAPI, React, Vite, Three.js, Framer Motion, GSAP, Groq (llama-3.3-70b),
SQLAlchemy, and pdfplumber._
