from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TripDestination(Base):
    __tablename__ = "trip_destinations"

    id: Mapped[int] = mapped_column(primary_key=True)

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id"),
        index=True,
    )

    location: Mapped[str] = mapped_column(String(255))

    latitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    
    longitude: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    stop_order: Mapped[int] = mapped_column(Integer)