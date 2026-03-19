FROM python:3.11-slim

WORKDIR /code

# 종속성 설치
COPY ./app/requirements.txt /code/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# 코드 복사
COPY ./app /code/app

# FastAPI 실행 (8000 포트)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]