from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
    )

    name: Mapped[str] = mapped_column(String(100))

    vehicle_type: Mapped[str] = mapped_column(String(50))

    fuel_type: Mapped[str] = mapped_column(String(50))

    fuel_consumption: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    tank_capacity: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )