import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage as MimeMessage
from email.utils import formatdate, make_msgid

from app.core import settings


logger = logging.getLogger("uvicorn.error")


@dataclass
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str


class Mailer:
    def send(self, message: EmailMessage) -> None:
        raise NotImplementedError


class SmtpMailer(Mailer):
    """
    Sends through any SMTP provider (Gmail app password, Brevo, Resend,
    SendGrid, Mailgun, ...), configured in .env.
    """

    def send(self, message: EmailMessage) -> None:
        mime = MimeMessage()
        mime["From"] = settings.EMAIL_FROM
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime["Date"] = formatdate(localtime=True)
        mime["Message-ID"] = make_msgid(domain="roadtrip-os")
        mime.set_content(message.text)
        mime.add_alternative(message.html, subtype="html")

        context = ssl.create_default_context()

        if settings.SMTP_SECURITY == "ssl":
            server = smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                context=context,
                timeout=20,
            )
        else:
            server = smtplib.SMTP(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=20,
            )

        with server:
            if settings.SMTP_SECURITY == "starttls":
                server.starttls(context=context)

            if settings.SMTP_USERNAME:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)

            server.send_message(mime)


class ConsoleMailer(Mailer):
    """
    Development fallback: prints the email (and its link) to the server log.
    """

    def send(self, message: EmailMessage) -> None:
        logger.warning(
            "\n===== EMAIL (SMTP not configured, not sent) =====\n"
            "To: %s\nSubject: %s\n\n%s\n"
            "=================================================",
            message.to,
            message.subject,
            message.text,
        )


def get_mailer() -> Mailer:
    return SmtpMailer() if settings.SMTP_HOST else ConsoleMailer()


def send_email(message: EmailMessage) -> None:
    """
    Send without raising: this runs as a background task after the
    response, so failures are logged (the user can ask for the email again).
    """

    try:
        get_mailer().send(message)
    except Exception:
        logger.exception("Failed to send email to %s", message.to)
