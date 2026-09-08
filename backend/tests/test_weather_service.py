from datetime import date

from app.integrations.weather import WeatherForecast
from app.services.weather import get_current_weather, get_daily_weather
from app.integrations.weather_forecast import DailyWeatherForecast


class FakeWeatherProvider:
    def get_forecast(
        self,
        latitude: float,
        longitude: float,
    ) -> WeatherForecast:
        return WeatherForecast(
            latitude=latitude,
            longitude=longitude,
            temperature_c=20.0,
            precipitation_probability=10,
            wind_speed_kmh=8.0,
            weather_code=1,
        )

    def get_daily_forecast(
    self,
        latitude: float,
        longitude: float,
        forecast_date: date,
    ) -> DailyWeatherForecast:
        return DailyWeatherForecast(
            forecast_date=forecast_date,
            latitude=latitude,
            longitude=longitude,
            temperature_max_c=22.0,
            temperature_min_c=12.0,
            precipitation_probability=20,
            wind_speed_max_kmh=15.0,
            weather_code=2,
        )


def test_get_current_weather():
    provider = FakeWeatherProvider()

    result = get_current_weather(
        provider=provider,
        latitude=59.3293,
        longitude=18.0686,
    )

    assert result.latitude == 59.3293
    assert result.longitude == 18.0686
    assert result.temperature_c == 20.0
    assert result.precipitation_probability == 10
    assert result.wind_speed_kmh == 8.0
    assert result.weather_code == 1


def test_get_daily_weather():
    provider = FakeWeatherProvider()

    result = get_daily_weather(
        provider=provider,
        latitude=59.3293,
        longitude=18.0686,
        forecast_date=date(2026, 9, 10),
    )

    assert isinstance(result, DailyWeatherForecast)
    assert result.forecast_date == date(2026, 9, 10)
    assert result.latitude == 59.3293
    assert result.longitude == 18.0686
    assert result.temperature_max_c == 22.0
    assert result.temperature_min_c == 12.0
    assert result.precipitation_probability == 20
    assert result.wind_speed_max_kmh == 15.0
    assert result.weather_code == 2