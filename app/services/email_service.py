import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_verification_email(target_email: str, auth_code: str):
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    msg = MIMEMultipart()
    msg["Subject"] = "[서간표] 서비스 이용을 위한 인증번호입니다."
    msg["From"] = f"서간표 관리자 <{sender_email}>"
    msg["To"] = target_email

    body = f"인증번호는 [{auth_code}] 입니다. 3분 이내에 입력해 주세요."
    msg.attach(MIMEText(body, "plain"))

    with smtplib.SMTP("smtp.gmail.com", 587) as server:
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)