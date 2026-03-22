import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_verification_email(target_email: str, auth_code: str):
    sender_email = os.getenv("SENDER_EMAIL")
    sender_password = os.getenv("SENDER_PASSWORD")

    msg = MIMEMultipart("alternative") # 텍스트와 HTML
    msg["Subject"] = "[서간표] 서비스 이용을 위한 인증번호입니다."
    msg["From"] = f"서간표 관리자 <{sender_email}>"
    msg["To"] = target_email

    # HTML 템플릿
    html_content = f"""
    <html>
    <body style="font-family: 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
        <div style="width: 100%; max-width: 500px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden;">
            <div style="background-color: #B1000E; padding: 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px; letter-spacing: -1px;">서간표 (Seoganpyo)</h1>
            </div>
            
            <div style="padding: 40px 30px; text-align: center; background-color: #ffffff;">
                <h2 style="color: #333; margin-bottom: 20px;">본인 확인 인증번호</h2>
                <p style="font-size: 16px; color: #666; margin-bottom: 30px;">
                    안녕하세요! 서간표 서비스를 이용해 주셔서 감사합니다.<br>
                    아래의 인증번호를 앱 화면에 입력하여 인증을 완료해 주세요.
                </p>
                
                <div style="background-color: #f9f9f9; border: 1px dashed #B1000E; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                    <span style="font-size: 32px; font-weight: bold; color: #B1000E; letter-spacing: 5px;">{auth_code}</span>
                </div>
                
                <p style="font-size: 13px; color: #999;">
                    * 이 인증번호는 <b>3분 동안</b>만 유효합니다.<br>
                    인증번호가 만료되었다면 다시 요청해 주세요.
                </p>
            </div>
            
            <div style="background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; color: #888;">
                <p style="margin: 0;">본 메일은 발신 전용입니다. 문의사항은 서비스 내 고객센터를 이용해 주세요.</p>
                <p style="margin: 5px 0 0 0;">© 2026 서간표(Seoganpyo) Team. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # HTML 내용 첨부
    part = MIMEText(html_content, "html")
    msg.attach(part)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.send_message(msg)
        print(f"메일 발송 성공: {target_email}")
    except Exception as e:
        print(f"메일 발송 에러: {e}")