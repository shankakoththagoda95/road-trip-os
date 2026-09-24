from email_validator import EmailNotValidError, validate_email


# Common throwaway-inbox providers. Not exhaustive - it catches the usual
# suspects without needing an external service.
DISPOSABLE_EMAIL_DOMAINS = frozenset(
    {
        "10minutemail.com",
        "10minutemail.net",
        "20minutemail.com",
        "33mail.com",
        "dispostable.com",
        "emailondeck.com",
        "fakeinbox.com",
        "getairmail.com",
        "getnada.com",
        "guerrillamail.biz",
        "guerrillamail.com",
        "guerrillamail.de",
        "guerrillamail.net",
        "guerrillamail.org",
        "guerrillamailblock.com",
        "harakirimail.com",
        "inboxkitten.com",
        "maildrop.cc",
        "mailinator.com",
        "mailinator.net",
        "mailnesia.com",
        "mintemail.com",
        "mohmal.com",
        "moakt.com",
        "mytemp.email",
        "sharklasers.com",
        "spamgourmet.com",
        "temp-mail.io",
        "temp-mail.org",
        "tempail.com",
        "tempmail.com",
        "tempmail.dev",
        "tempmailo.com",
        "tempr.email",
        "throwawaymail.com",
        "trashmail.com",
        "trashmail.de",
        "yopmail.com",
        "yopmail.fr",
        "yopmail.net",
    }
)

# Seconds to wait for the DNS lookup before giving up.
DNS_TIMEOUT_SECONDS = 5


class EmailNotAcceptedError(ValueError):
    """The address is malformed, can't receive mail, or is disposable."""


def check_email_address(email: str) -> str:
    """
    Check that an email address is real enough to sign up with and return
    it normalised (lower case).

    - valid syntax
    - the domain exists and accepts mail (MX, or A/AAAA fallback, via DNS)
    - not a known disposable-inbox provider
    """

    try:
        result = validate_email(
            email,
            check_deliverability=True,
            timeout=DNS_TIMEOUT_SECONDS,
        )
    except EmailNotValidError as error:
        raise EmailNotAcceptedError(_friendly_message(str(error))) from error

    domain = result.domain.lower()

    if domain in DISPOSABLE_EMAIL_DOMAINS:
        raise EmailNotAcceptedError(
            "Disposable email addresses aren't accepted. "
            "Please use an address you'll keep."
        )

    return result.normalized.lower()


def _friendly_message(message: str) -> str:
    if "does not exist" in message or "does not accept email" in message:
        return (
            "This email domain can't receive mail. "
            "Check the address for typos."
        )

    return message
