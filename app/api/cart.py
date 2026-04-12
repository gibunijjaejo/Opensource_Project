from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.dependencies import get_current_student_id
from app.models.activity import Cart, History
from app.models.course import Course
from app.schemas.cart import CartCreate, CartResponse, HistoryCreate, HistoryResponse

router = APIRouter(prefix="/api/v1", tags=["Cart & History"])


# ── 장바구니 ──────────────────────────────────────────────

@router.get("/users/{student_id}/cart", response_model=List[CartResponse])
def get_cart(student_id: int, db: Session = Depends(get_db)):
    return db.query(Cart).filter(Cart.student_id == student_id).all()


@router.post("/users/{student_id}/cart", response_model=CartResponse, status_code=201)
def add_to_cart(student_id: int, req: CartCreate, db: Session = Depends(get_db)):
    exists = db.query(Cart).filter(
        Cart.student_id == student_id,
        Cart.course_id == req.course_id
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="이미 장바구니에 담긴 강의입니다.")
    if not db.query(Course).filter(Course.course_id == req.course_id).first():
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    cart = Cart(student_id=student_id, course_id=req.course_id)
    db.add(cart)
    db.commit()
    db.refresh(cart)
    return cart


@router.delete("/users/{student_id}/cart/{cart_id}", status_code=204)
def remove_from_cart(student_id: int, cart_id: int, db: Session = Depends(get_db)):
    cart = db.query(Cart).filter(Cart.id == cart_id, Cart.student_id == student_id).first()
    if not cart:
        raise HTTPException(status_code=404, detail="장바구니 항목을 찾을 수 없습니다.")
    db.delete(cart)
    db.commit()


# ── 수강이력 ──────────────────────────────────────────────

@router.get("/users/{student_id}/history", response_model=List[HistoryResponse])
def get_history(student_id: int, db: Session = Depends(get_db)):
    return db.query(History).filter(History.student_id == student_id).all()


@router.post("/users/{student_id}/history", response_model=HistoryResponse, status_code=201)
def add_history(student_id: int, req: HistoryCreate, db: Session = Depends(get_db)):
    exists = db.query(History).filter(
        History.student_id == student_id,
        History.course_code == req.course_code
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="이미 수강이력에 존재하는 강의입니다.")
    history = History(student_id=student_id, course_code=req.course_code, is_retake=req.is_retake)
    db.add(history)
    db.commit()
    db.refresh(history)
    return history


@router.delete("/users/{student_id}/history/{history_id}", status_code=204)
def delete_history(student_id: int, history_id: int, db: Session = Depends(get_db)):
    history = db.query(History).filter(
        History.id == history_id,
        History.student_id == student_id
    ).first()
    if not history:
        raise HTTPException(status_code=404, detail="수강이력을 찾을 수 없습니다.")
    db.delete(history)
    db.commit()


# ── JWT 기반 장바구니 (프론트엔드 연동용) ─────────────────

@router.get("/cart", response_model=List[CartResponse])
def get_my_cart(
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    return db.query(Cart).filter(Cart.student_id == student_id).all()


@router.post("/cart", response_model=CartResponse, status_code=201)
def add_to_my_cart(
    req: CartCreate,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    exists = db.query(Cart).filter(
        Cart.student_id == student_id,
        Cart.course_id == req.course_id,
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="이미 장바구니에 담긴 강의입니다.")
    if not db.query(Course).filter(Course.course_id == req.course_id).first():
        raise HTTPException(status_code=404, detail="강의를 찾을 수 없습니다.")
    cart_item = Cart(student_id=student_id, course_id=req.course_id)
    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    return cart_item


@router.delete("/cart/{cart_id}", status_code=204)
def remove_from_my_cart(
    cart_id: int,
    student_id: int = Depends(get_current_student_id),
    db: Session = Depends(get_db),
):
    cart_item = db.query(Cart).filter(
        Cart.id == cart_id,
        Cart.student_id == student_id,
    ).first()
    if not cart_item:
        raise HTTPException(status_code=404, detail="장바구니 항목을 찾을 수 없습니다.")
    db.delete(cart_item)
    db.commit()
