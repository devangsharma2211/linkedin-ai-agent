from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from jwt.exceptions import InvalidTokenError
import bcrypt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
import models
import os
from dotenv import load_dotenv
import bleach
from collections import defaultdict
import re

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "fallback_dev_secret_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Brute force protection: track failed login attempts per IP
# Format: {ip: [(timestamp, attempt_count), ...]}
login_attempts = defaultdict(list)
FAILED_ATTEMPTS_LIMIT = 5
FAILED_ATTEMPTS_WINDOW = 5 * 60  # 5 minutes in seconds


def check_brute_force(request: Request) -> None:
    """Check if IP is blocked due to too many failed login attempts."""
    client_ip = request.client.host
    now = datetime.now(timezone.utc).timestamp()
    
    # Clean up old attempts outside the window
    login_attempts[client_ip] = [
        (ts, cnt) for ts, cnt in login_attempts[client_ip]
        if now - ts < FAILED_ATTEMPTS_WINDOW
    ]
    
    # Count failed attempts in the window
    failed_count = sum(cnt for _, cnt in login_attempts[client_ip])
    
    if failed_count >= FAILED_ATTEMPTS_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Try again later.",
        )


def record_failed_login(request: Request) -> None:
    """Record a failed login attempt for brute force tracking."""
    client_ip = request.client.host
    now = datetime.now(timezone.utc).timestamp()
    login_attempts[client_ip].append((now, 1))


def record_successful_login(request: Request) -> None:
    """Clear failed login attempts on successful login."""
    client_ip = request.client.host
    login_attempts[client_ip] = []


def sanitize_input(text: str) -> str:
    """Sanitize user input to prevent XSS attacks."""
    return bleach.clean(text, tags=[], strip=True)


def validate_password_strength(password: str) -> tuple[bool, str]:
    """Validate password meets minimum security requirements."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number."
    return True, "Password is strong."


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user