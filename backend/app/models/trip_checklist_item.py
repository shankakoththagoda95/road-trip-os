from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TripChecklistItem(Base):
    """
    Something to bring or sort out for a trip: either a requirement from the
    generated checklist (documents, equipment, …) or the traveller's own
    personal item. Ticked off while travelling.
    """

    __tablename__ = "trip_checklist_items"

    id: Mapped[int] = mapped_column(primary_key=True)

    trip_id: Mapped[int] = mapped_column(
        ForeignKey("trips.id"),
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200))

    description: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )

    # Generated items: "documents", "payments", "equipment", "winter",
    # "rules" or "vehicle". Personal items have none.
    category: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True,
    )

    required: Mapped[bool] = mapped_column(Boolean, default=False)

    # Added by the traveller rather than generated for the route.
    personal: Mapped[bool] = mapped_column(Boolean, default=True)

    checked: Mapped[bool] = mapped_column(Boolean, default=False)

    # Order within the trip's list.
    position: Mapped[int] = mapped_column(Integer, default=0)
