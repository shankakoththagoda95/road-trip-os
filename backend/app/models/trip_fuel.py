from sqlalchemy import Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TripFuel(Base):
    __tablename__ = "trip_fuels"

    id: Mapped[int] = mapped_column(primary_key=True)

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id"),
        unique=True,
        index=True,
    )

    starting_fuel: Mapped[float] = mapped_column(Float)

    current_fuel: Mapped[float] = mapped_column(Float)

    fuel_used: Mapped[float] = mapped_column(Float)

    fuel_cost: Mapped[float] = mapped_column(Float)