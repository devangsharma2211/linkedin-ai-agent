import os
import shutil
import json
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, BackgroundTasks, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from utils.security import get_current_user, sanitize_input
from services.pdf_parser import extract_text_from_pdf, parse_linkedin_sections
from services.ai_service import analyze_profile
from dotenv import load_dotenv

load_dotenv()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def validate_pdf_magic_bytes(file_bytes: bytes) -> bool:
    """Check if file starts with PDF magic bytes (%PDF)."""
    return file_bytes.startswith(b'%PDF')


def generate_secure_filename(user_id: int) -> str:
    """Generate a secure filename with hash to prevent path traversal."""
    random_suffix = secrets.token_hex(8)
    return f"user_{user_id}_{random_suffix}.pdf"


@router.post("/upload", response_model=schemas.ProfileOut)
@limiter.limit("5/hour")
async def upload_linkedin_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a LinkedIn PDF export with security validation.
    Validates: file type, magic bytes, request size, and prevents path traversal.
    """
    if not file.filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted. Please upload your LinkedIn PDF export."
        )

    # Read file content for magic bytes validation
    file_content = await file.read()
    
    # Validate PDF magic bytes to prevent malicious file uploads
    if not validate_pdf_magic_bytes(file_content):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid PDF file. The file does not appear to be a valid PDF."
        )
    
    # Generate secure filename with hash (prevents path traversal like ../../etc/passwd)
    safe_filename = generate_secure_filename(current_user.id)
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    # Ensure path stays within UPLOAD_DIR
    if not os.path.abspath(file_path).startswith(os.path.abspath(UPLOAD_DIR)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path."
        )

    # Write file
    with open(file_path, "wb") as buffer:
        buffer.write(file_content)

    # Extract and parse
    try:
        raw_text = extract_text_from_pdf(file_path)
        parsed = parse_linkedin_sections(raw_text)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not read the PDF. Make sure it is a LinkedIn profile export. Error: {str(e)}"
        )

    # Upsert profile (create or update if already exists)
    profile = db.query(models.Profile).filter(
        models.Profile.user_id == current_user.id
    ).first()

    if profile:
        profile.raw_text = raw_text
        profile.headline = parsed.get("headline")
        profile.summary = parsed.get("summary")
        profile.experience = parsed.get("experience")
        profile.education = parsed.get("education")
        profile.skills = parsed.get("skills")
        profile.certifications = parsed.get("certifications")
        profile.pdf_filename = safe_filename
    else:
        profile = models.Profile(
            user_id=current_user.id,
            raw_text=raw_text,
            headline=parsed.get("headline"),
            summary=parsed.get("summary"),
            experience=parsed.get("experience"),
            education=parsed.get("education"),
            skills=parsed.get("skills"),
            certifications=parsed.get("certifications"),
            pdf_filename=safe_filename,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)

    # Run AI analysis in the background so the upload response is instant
    background_tasks.add_task(_run_analysis, current_user.id, db)

    return profile


@router.get("/", response_model=schemas.ProfileOut)
def get_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's parsed LinkedIn profile."""
    profile = db.query(models.Profile).filter(
        models.Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile found. Please upload your LinkedIn PDF first."
        )
    return profile


@router.patch("/", response_model=schemas.ProfileOut)
def update_profile(
    updates: schemas.ProfileUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually update specific fields of the profile (REST-style, also used by chat)."""
    profile = db.query(models.Profile).filter(
        models.Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    update_data = updates.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete the current user's profile data (keeps the account)."""
    profile = db.query(models.Profile).filter(
        models.Profile.user_id == current_user.id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")

    # Also remove the uploaded PDF
    if profile.pdf_filename:
        pdf_path = os.path.join(UPLOAD_DIR, profile.pdf_filename)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)

    db.delete(profile)
    db.commit()


@router.get("/analysis", response_model=schemas.AnalysisOut)
def get_analysis(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the AI analysis results for the current user's profile."""
    analysis = db.query(models.Analysis).filter(
        models.Analysis.user_id == current_user.id
    ).first()
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="No analysis found. Please upload your LinkedIn PDF first — analysis runs automatically."
        )
    return analysis


# ── Internal helper ───────────────────────────────────────────────────────────

def _run_analysis(user_id: int, db: Session):
    """Background task: run AI analysis and store results."""
    # Re-fetch a fresh DB session (background tasks need their own session)
    from database import SessionLocal
    db = SessionLocal()
    try:
        profile = db.query(models.Profile).filter(models.Profile.user_id == user_id).first()
        if not profile:
            return

        profile_data = {
            "headline": profile.headline,
            "summary": profile.summary,
            "experience": profile.experience,
            "education": profile.education,
            "skills": profile.skills,
            "certifications": profile.certifications,
        }

        result = analyze_profile(profile_data)

        analysis = db.query(models.Analysis).filter(models.Analysis.user_id == user_id).first()
        if analysis:
            for key, value in result.items():
                setattr(analysis, key, value)
        else:
            analysis = models.Analysis(user_id=user_id, **result)
            db.add(analysis)

        db.commit()
    except Exception as e:
        print(f"[Analysis Error] user_id={user_id}: {e}")
    finally:
        db.close()
