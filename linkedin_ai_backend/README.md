# LinkedIn AI Profile Analyzer — Backend

A FastAPI backend that lets users upload their LinkedIn PDF export, get AI-powered profile analysis, and improve their profile through a conversational chat interface.

---

## Features

- **User auth** — Register, login, JWT-protected endpoints
- **PDF upload** — Accepts LinkedIn PDF exports, parses all sections automatically
- **AI analysis** — Claude analyzes the profile and generates:
  - Detailed strengths/weaknesses analysis
  - Rewritten headline and about section
  - 10 suggested skills
  - 5 scroll-stopping post hooks
  - 3 sets of hashtags for content strategy
  - Step-by-step improvement guide vs top profiles
- **Chat interface** — Talk to the AI about your profile
- **CRUD via chat** — Say "change my headline to X" or "add Python to my skills" and the AI updates the DB automatically

---

## Project Structure

```
linkedin_ai_backend/
├── main.py               # FastAPI app entry point
├── database.py           # SQLAlchemy + SQLite setup
├── models.py             # DB models (User, Profile, ChatMessage, Analysis)
├── schemas.py            # Pydantic schemas for validation
├── requirements.txt      # Python dependencies
├── .env.example          # Copy to .env and fill in
├── routers/
│   ├── auth.py           # /auth/register, /auth/login, /auth/me
│   ├── profile.py        # /profile/upload, /profile/, /profile/analysis
│   └── chat.py           # /chat/send, /chat/history, /chat/history (DELETE)
├── services/
│   ├── pdf_parser.py     # LinkedIn PDF text extraction and section parsing
│   └── ai_service.py     # Anthropic Claude integration
└── utils/
    └── security.py       # Password hashing, JWT creation/verification
```

---

## Setup

### 1. Clone / copy the project
```bash
cd linkedin_ai_backend
```

### 2. Create a virtual environment
```bash
python -m venv venv
source venv/bin/activate      # Mac / Linux
venv\Scripts\activate         # Windows
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Set up environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in:
- `SECRET_KEY` — generate with: `python -c "import secrets; print(secrets.token_hex(32))"`
- `ANTHROPIC_API_KEY` — get from https://console.anthropic.com (free tier available)

### 5. Run the server
```bash
uvicorn main:app --reload
```

The API will be running at: http://localhost:8000  
Interactive API docs: http://localhost:8000/docs

---

## How to get a LinkedIn PDF export

1. Go to your LinkedIn profile
2. Click the **"More"** button below your profile photo
3. Select **"Save to PDF"**
4. Upload that PDF to `/profile/upload`

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create a new account |
| POST | `/auth/login` | Log in, receive JWT token |
| GET | `/auth/me` | Get current user info |
| DELETE | `/auth/me` | Delete account |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/profile/upload` | Upload LinkedIn PDF (triggers AI analysis) |
| GET | `/profile/` | Get parsed profile data |
| PATCH | `/profile/` | Manually update profile fields |
| DELETE | `/profile/` | Delete profile data |
| GET | `/profile/analysis` | Get AI analysis results |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/chat/send` | Send a message, get AI reply (with auto CRUD) |
| GET | `/chat/history` | Get chat history |
| DELETE | `/chat/history` | Clear chat history |

---

## Example Chat CRUD Commands

Once your profile is uploaded, you can say things like:

- "What are the main weaknesses in my profile?"
- "Change my headline to: Senior Software Engineer | Python | AI/ML"
- "Rewrite my summary section"
- "Add Docker and Kubernetes to my skills"
- "Remove my oldest job from experience"
- "Give me 3 LinkedIn post ideas based on my background"
- "Show me the hooks you generated"

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| FastAPI | Web framework |
| SQLAlchemy + SQLite | Database ORM |
| pdfplumber | PDF text extraction |
| Anthropic Claude | AI analysis and chat |
| python-jose | JWT tokens |
| passlib / bcrypt | Password hashing |

---

## Notes for Production

- Replace SQLite with PostgreSQL (change `DATABASE_URL` in `.env`)
- Set `allow_origins` in CORS to your actual frontend domain
- Store PDFs on S3 or similar instead of local disk
- Add rate limiting (e.g. `slowapi`) to protect the AI endpoints
