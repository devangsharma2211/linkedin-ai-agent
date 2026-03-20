from fastapi import APIRouter, Depends, HTTPException, status, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from utils.security import (
    hash_password, verify_password, create_access_token, get_current_user,
    check_brute_force, record_failed_login, record_successful_login,
    sanitize_input, validate_password_strength
)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, user_data: schemas.UserRegister, db: Session = Depends(get_db)):
    """Create a new user account."""
    # Validate password strength
    is_valid, msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg
        )
    
    # Check if email already exists
    existing = db.query(models.User).filter(models.User.email == user_data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    new_user = models.User(
        name=sanitize_input(user_data.name),
        email=user_data.email.lower().strip(),
        hashed_password=hash_password(user_data.password),
        linkedin_url=sanitize_input(user_data.linkedin_url) if user_data.linkedin_url else None,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=schemas.Token)
@limiter.limit("10/minute")
def login(request: Request, credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    """Log in and receive a JWT access token."""
    # Check brute force protection
    check_brute_force(request)
    
    user = db.query(models.User).filter(models.User.email == credentials.email.lower().strip()).first()
    
    # Generic error message to prevent email enumeration
    if not user or not verify_password(credentials.password, user.hashed_password):
        record_failed_login(request)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    # Clear failed attempts on successful login
    record_successful_login(request)
    token = create_access_token(data={"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    """Get the currently logged-in user's info."""
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Permanently delete the current user's account and all data."""
    db.delete(current_user)
    db.commit()
