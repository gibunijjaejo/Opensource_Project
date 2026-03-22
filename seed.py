# seed.py
from app.database import SessionLocal
from app.models.user import User

def seed_data():
    db = SessionLocal()
    try:
        # 민지님 학번으로 이미 유저가 있는지 확인
        # (아까 ERD 설계도에서 student_id가 PK였죠?)
        test_user = db.query(User).filter(User.student_id == 20221234).first()

        if not test_user:
            new_user = User(
                student_id=20221234,
                name="김민지",
                email="minji@sogang.ac.kr",
                password="hashed_password_123", # 임시 비번
                current_semester=3,
                total_credits=45,
                total_english=1
            )
            db.add(new_user)
            db.commit()
            print("✅ 테스트 유저 '김민지' 생성 완료 (학번: 20221234)")
        else:
            print("ℹ️ 이미 테스트 유저가 존재합니다.")
    except Exception as e:
        print(f"❌ 에러 발생: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()