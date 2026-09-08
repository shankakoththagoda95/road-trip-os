from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TripBudget(Base):
    __tablename__ = "trip_budgets"

    id: Mapped[int] = mapped_column(primary_key=True)

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id"),
        unique=True,
        index=True,
    )

    currency: Mapped[str] = mapped_column(
        String(3),
        default="EUR",
    )

    estimated_fuel_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    estimated_ev_charging_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    estimated_toll_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    estimated_food_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    estimated_parking_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    estimated_other_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    actual_fuel_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    actual_ev_charging_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    actual_toll_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    actual_food_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    actual_parking_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )

    actual_other_cost: Mapped[float] = mapped_column(
        Float,
        default=0,
    )