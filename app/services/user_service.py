import os
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.models.user import User

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24시간

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(student_id: int) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": str(student_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return int(payload["sub"])


def get_user_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, student_id: int) -> User | None:
    return db.query(User).filter(User.student_id == student_id).first()


def get_user_by_approval_token(db: Session, token: str) -> User | None:
    return db.query(User).filter(User.approval_token == token).first()


def update_password(db: Session, email: str, new_password: str) -> None:
    user = get_user_by_email(db, email)
    user.password = hash_password(new_password)
    db.commit()


def delete_user(db: Session, student_id: int) -> None:
    db.execute(text("ALTER TABLE posts ALTER COLUMN student_id DROP NOT NULL"))
    db.execute(text("ALTER TABLE comments ALTER COLUMN student_id DROP NOT NULL"))
    db.execute(text("UPDATE posts SET student_id = NULL WHERE student_id = :sid"), {"sid": student_id})
    db.execute(text("UPDATE comments SET student_id = NULL WHERE student_id = :sid"), {"sid": student_id})
    db.execute(text("DELETE FROM post_likes WHERE student_id = :sid"), {"sid": student_id})
    db.execute(text("DELETE FROM comment_likes WHERE student_id = :sid"), {"sid": student_id})
    db.execute(text("DELETE FROM histories WHERE student_id = :sid"), {"sid": student_id})
    db.execute(text("DELETE FROM carts WHERE student_id = :sid"), {"sid": student_id})
    db.execute(text("DELETE FROM users WHERE student_id = :sid"), {"sid": student_id})
    db.commit()


def create_user(db: Session, student_id: int, name: str, email: str, password: str, **kwargs) -> User:
    user = User(
        student_id=student_id,
        name=name,
        email=email,
        password=hash_password(password),
        **kwargs
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
