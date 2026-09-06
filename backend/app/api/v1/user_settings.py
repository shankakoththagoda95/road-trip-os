from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.user_settings import (
    UserSettingsResponse,
    UserSettingsUpdate,
)

router = APIRouter(
    prefix="/users/settings",
    tags=["User Settings"],
)


@router.get(
    "",
    response_model=UserSettingsResponse,
)
def get_user_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.scalar(
        select(UserSettings).where(
            UserSettings.user_id == current_user.id,
        )
    )

    if settings is None:
        settings = UserSettings(
            user_id=current_user.id,
        )

        db.add(settings)
        db.commit()
        db.refresh(settings)

    return settings


@router.put(
    "",
    response_model=UserSettingsResponse,
)
def update_user_settings(
    settings_update: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = db.scalar(
        select(UserSettings).where(
            UserSettings.user_id == current_user.id,
        )
    )

    if settings is None:
        settings = UserSettings(
            user_id=current_user.id,
            gps_movement_threshold_meters=(
                settings_update.gps_movement_threshold_meters
            ),
        )

        db.add(settings)
    else:
        settings.gps_movement_threshold_meters = (
            settings_update.gps_movement_threshold_meters
        )

    db.commit()
    db.refresh(settings)

    return settings