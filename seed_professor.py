import json
from app.database import SessionLocal
from app.models.professor import Professor
from app.models.course import Course
from app.models.activity import History
from app.models.user import User

JSON_PATH = "data/professor/professor.json"


def seed_professors():
    db = SessionLocal()

    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            professors = json.load(f)

        inserted_count = 0
        updated_count = 0

        for item in professors:
            professor_id = item.get("professor_id")
            name = item.get("name")
            course_name = item.get("course_name")
            lab = item.get("lab")

            existing_professor = db.query(Professor).filter(
                Professor.professor_id == professor_id
            ).first()

            if existing_professor:
                existing_professor.name = name
                existing_professor.course_name = course_name
                existing_professor.lab = lab
                updated_count += 1
            else:
                new_professor = Professor(
                    professor_id=professor_id,
                    name=name,
                    course_name=course_name,
                    lab=lab
                )
                db.add(new_professor)
                inserted_count += 1

        db.commit()
        print(f"교수 데이터 입력 완료: inserted={inserted_count}, updated={updated_count}")

    except Exception as e:
        db.rollback()
        print("에러 발생:", e)

    finally:
        db.close()


if __name__ == "__main__":
    seed_professors()