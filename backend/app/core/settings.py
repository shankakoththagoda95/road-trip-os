import os

from dotenv import load_dotenv


load_dotenv()

# Where the web app runs; links in emails point here.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:8081").rstrip("/")

# Outgoing email. Leave SMTP_HOST empty in development to print emails to
# the server log instead of sending them.
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
# "starttls" (usually port 587), "ssl" (usually 465) or "none".
SMTP_SECURITY = os.getenv("SMTP_SECURITY", "starttls").lower()
EMAIL_FROM = os.getenv("EMAIL_FROM", "Road-Trip OS <no-reply@roadtrip-os.local>")

# Link lifetimes.
EMAIL_VERIFICATION_TOKEN_HOURS = 24
PASSWORD_RESET_TOKEN_MINUTES = 60

# Minimum time between "send the email again" requests per account.
EMAIL_RESEND_COOLDOWN_SECONDS = 60
