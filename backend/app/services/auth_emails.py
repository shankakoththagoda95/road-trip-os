from html import escape
from urllib.parse import urlencode

from app.core.settings import (
    EMAIL_VERIFICATION_TOKEN_HOURS,
    FRONTEND_URL,
    PASSWORD_RESET_TOKEN_MINUTES,
)
from app.models.user import User
from app.services.mailer import EmailMessage


def app_link(path: str, token: str) -> str:
    return f"{FRONTEND_URL}{path}?{urlencode({'token': token})}"


def _html(title: str, greeting: str, body: str, button: str, link: str, footer: str) -> str:
    # Inline styles only: most email clients ignore <style> blocks.
    return f"""<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F7F9FC;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#172033;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #DCE3EF;border-radius:16px;padding:32px;">
            <tr><td style="font-size:18px;font-weight:700;padding-bottom:24px;">🧭 Road-Trip OS</td></tr>
            <tr><td style="font-size:22px;font-weight:700;padding-bottom:16px;">{escape(title)}</td></tr>
            <tr><td style="font-size:16px;line-height:24px;padding-bottom:8px;">{escape(greeting)}</td></tr>
            <tr><td style="font-size:16px;line-height:24px;padding-bottom:24px;">{escape(body)}</td></tr>
            <tr>
              <td style="padding-bottom:24px;">
                <a href="{escape(link)}" style="display:inline-block;background:#2563EB;color:#FFFFFF;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:26px;">{escape(button)}</a>
              </td>
            </tr>
            <tr><td style="font-size:13px;line-height:20px;color:#5B6475;padding-bottom:8px;">Or paste this link into your browser:<br><a href="{escape(link)}" style="color:#2563EB;word-break:break-all;">{escape(link)}</a></td></tr>
            <tr><td style="font-size:13px;line-height:20px;color:#5B6475;padding-top:16px;border-top:1px solid #DCE3EF;">{escape(footer)}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def verification_email(user: User, token: str) -> EmailMessage:
    link = app_link("/verify-email", token)
    title = "Confirm your email address"
    greeting = f"Hi {user.first_name},"
    body = (
        "Thanks for signing up for Road-Trip OS. Confirm your email address "
        "to activate your account and start planning."
    )
    footer = (
        f"This link expires in {EMAIL_VERIFICATION_TOKEN_HOURS} hours. "
        "If you didn't create an account, you can ignore this email."
    )

    return EmailMessage(
        to=user.email,
        subject="Confirm your Road-Trip OS account",
        text=f"{greeting}\n\n{body}\n\nConfirm your email:\n{link}\n\n{footer}\n",
        html=_html(title, greeting, body, "Confirm email address", link, footer),
    )


def password_reset_email(user: User, token: str) -> EmailMessage:
    link = app_link("/reset-password", token)
    title = "Reset your password"
    greeting = f"Hi {user.first_name},"
    body = (
        "We received a request to reset the password for your Road-Trip OS "
        "account. Choose a new password with the button below."
    )
    footer = (
        f"This link expires in {PASSWORD_RESET_TOKEN_MINUTES} minutes and "
        "works once. If you didn't ask to reset your password, you can "
        "ignore this email: your password won't change."
    )

    return EmailMessage(
        to=user.email,
        subject="Reset your Road-Trip OS password",
        text=f"{greeting}\n\n{body}\n\nReset your password:\n{link}\n\n{footer}\n",
        html=_html(title, greeting, body, "Reset password", link, footer),
    )
