from sqlalchemy.orm import Session

from app.core import settings
from app.models.app_setting import AppSetting

REGISTRATION_OPEN = "registration_open"


def registration_open(db: Session) -> bool:
    """
    Whether people can create their own account: the admin's choice, or
    REGISTRATION_OPEN from the environment until an admin has set it.
    """

    row = db.get(AppSetting, REGISTRATION_OPEN)

    return settings.REGISTRATION_OPEN if row is None else row.value == "true"


def set_registration_open(db: Session, value: bool) -> None:
    row = db.get(AppSetting, REGISTRATION_OPEN)

    if row is None:
        row = AppSetting(key=REGISTRATION_OPEN, value="")
        db.add(row)

    row.value = "true" if value else "false"
    db.commit()
