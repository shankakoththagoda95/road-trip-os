from dataclasses import dataclass
from datetime import date


@dataclass
class DailyWeatherForecast:
    forecast_date: date
    latitude: float
    longitude: float
    temperature_max_c: float
    temperature_min_c: float
    precipitation_probability: float
    wind_speed_max_kmh: float
    weather_code: int