from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Trip(Base):
    __tablename__ = "trips"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    name: Mapped[str] = mapped_column(String(150))

    start_location: Mapped[str] = mapped_column(String(255))

    destination: Mapped[str] = mapped_column(String(255))

    trip_type: Mapped[str] = mapped_column(String(50))

    departure_at: Mapped[datetime] = mapped_column(DateTime)

    travelers: Mapped[int] = mapped_column(Integer)

    duration_days: Mapped[int] = mapped_column(Integer)

    max_driving_hours_per_day: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    max_distance_per_day: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )