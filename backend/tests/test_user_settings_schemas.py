import pytest
from pydantic import ValidationError

from app.schemas.user_settings import (
    UserSettingsResponse,
    UserSettingsUpdate,
)


def test_user_settings_update_uses_20_meter_default():
    settings = UserSettingsUpdate()

    assert settings.gps_movement_threshold_meters == 20.0


def test_user_settings_update_accepts_valid_threshold():
    settings = UserSettingsUpdate(
        gps_movement_threshold_meters=50,
    )

    assert settings.gps_movement_threshold_meters == 50


def test_user_settings_update_accepts_1_meter():
    settings = UserSettingsUpdate(
        gps_movement_threshold_meters=1,
    )

    assert settings.gps_movement_threshold_meters == 1


def test_user_settings_update_accepts_1000_meters():
    settings = UserSettingsUpdate(
        gps_movement_threshold_meters=1000,
    )

    assert settings.gps_movement_threshold_meters == 1000


def test_user_settings_update_rejects_below_1_meter():
    with pytest.raises(ValidationError):
        UserSettingsUpdate(
            gps_movement_threshold_meters=0,
        )


def test_user_settings_update_rejects_above_1000_meters():
    with pytest.raises(ValidationError):
        UserSettingsUpdate(
            gps_movement_threshold_meters=1001,
        )


def test_user_settings_response_accepts_valid_threshold():
    settings = UserSettingsResponse(
        gps_movement_threshold_meters=100,
    )

    assert settings.gps_movement_threshold_meters == 100