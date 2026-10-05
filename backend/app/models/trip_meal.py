from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TripMeal(Base):
    """
    A planned meal: breakfast, lunch or dinner on a day of the trip, or the
    snacks for the whole trip (no day).
    """

    __tablename__ = "trip_meals"
    __table_args__ = (
        UniqueConstraint("trip_id", "day_number", "meal", name="uq_trip_meal_slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    trip_id: Mapped[int] = mapped_column(ForeignKey("trips.id"), index=True)

    # Day of the trip (1 = departure day); null for the trip's snacks.
    day_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # "breakfast", "lunch", "dinner" or "snacks".
    meal: Mapped[str] = mapped_column(String(20))

    # "fast_food" (buy on the way) or "home_prep" (bring / cook it).
    kind: Mapped[str] = mapped_column(String(20), default="fast_food")

    # What to prepare; home-prepared meals only.
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
