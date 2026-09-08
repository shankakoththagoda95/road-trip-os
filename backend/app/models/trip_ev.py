from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TripEV(Base):
    __tablename__ = "trip_evs"

    id: Mapped[int] = mapped_column(primary_key=True)

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id"),
        unique=True,
        index=True,
    )

    starting_battery_percentage: Mapped[float] = mapped_column(
        Float,
    )

    current_battery_percentage: Mapped[float] = mapped_column(
        Float,
    )