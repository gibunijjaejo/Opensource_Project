FROM python:3.11-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Seoul

WORKDIR /app

# apt-get 없이 설치 가능한 이유:
#   python:3.11-bookworm = buildpack-deps 기반 → gcc 포함 → libgomp1 내장
#   opencv-python-headless = libGL.so.1 불필요 (headless 빌드)
#
# paddleocr이 의존성으로 opencv-python(libGL 필요)을 설치하므로
# pip install 후 opencv-python-headless 로 교체
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip uninstall -y opencv-python \
    && pip install --no-cache-dir "opencv-python-headless==4.10.0.84"

COPY main.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
