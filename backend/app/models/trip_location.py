from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TripLocation(Base):
    __tablename__ = "trip_locations"

    id: Mapped[int] = mapped_column(primary_key=True)

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id"),
        index=True,
    )

    latitude: Mapped[float] = mapped_column(Float)

    longitude: Mapped[float] = mapped_column(Float)

    recorded_at: Mapped[datetime] = mapped_column(
        DateTime,
    )