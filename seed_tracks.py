import os
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models.activity import Track, History, Cart
from app.models.user import User
from app.models.course import Course
from app.models.professor import Professor

def seed_tracks():
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    
    track_names = [
        "데이터 분석",
        "데이터 관리",
        "백엔드",
        "프론트엔드",
        "웹/앱",
        "AI",
        "DevOps",
        "네트워크",
        "보안",
        "QA",
        "게임",
        "임베디드",
        "IT컨설팅",
        "컴퓨터 교육"
    ]

    try:
        print("Checking tracks...")
        added_count = 0
        for name in track_names:
            # Check if track already exists
            exists = db.query(Track).filter(Track.track_name == name).first()
            if not exists:
                new_track = Track(track_name=name)
                db.add(new_track)
                added_count += 1
                print(f"Adding track: {name}")
        
        db.commit()
        if added_count > 0:
            print(f"Successfully added {added_count} new tracks.")
        else:
            print("All tracks already exist. No changes made.")
            
    except Exception as e:
        db.rollback()
        print(f"Error seeding tracks: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_tracks()
