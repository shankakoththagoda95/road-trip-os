from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id: Mapped[int] = mapped_column(primary_key=True)

    itinerary_id: Mapped[int] = mapped_column(
        ForeignKey("itineraries.id"),
        index=True,
    )

    day_number: Mapped[int] = mapped_column(Integer)

    total_distance_meters: Mapped[float] = mapped_column(Float)

    total_duration_seconds: Mapped[float] = mapped_column(Float)

    distance_status: Mapped[str] = mapped_column(String(50))

    driving_time_status: Mapped[str] = mapped_column(String(50))