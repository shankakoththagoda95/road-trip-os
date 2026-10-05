from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.trip import Trip
from app.models.trip_checklist_item import TripChecklistItem
from app.models.trip_meal import TripMeal
from app.models.user import User
from app.schemas.trip_checklist_item import (
    TripChecklistItemCreate,
    TripChecklistItemResponse,
    TripChecklistItemsCreate,
    TripChecklistItemUpdate,
)
from app.schemas.trip_meal import (
    TripMealDay,
    TripMealPlanResponse,
    TripMealResponse,
    TripMealUpdate,
)


router = APIRouter(
    prefix="/trips/{trip_id}/checklist",
    tags=["trip checklist"],
)


def get_own_trip(trip_id: int, user: User, db: Session) -> Trip:
    trip = db.scalar(
        select(Trip).where(
            Trip.id == trip_id,
            Trip.user_id == user.id,
        )
    )

    if trip is None:
        raise HTTPException(status_code=404, detail="Trip not found")

    return trip


def get_own_item(
    trip_id: int, item_id: int, user: User, db: Session
) -> TripChecklistItem:
    get_own_trip(trip_id, user, db)

    item = db.scalar(
        select(TripChecklistItem).where(
            TripChecklistItem.id == item_id,
            TripChecklistItem.trip_id == trip_id,
        )
    )

    if item is None:
        raise HTTPException(status_code=404, detail="Checklist item not found")

    return item


def add_items(
    trip_id: int, items: list[TripChecklistItemCreate], db: Session
) -> list[TripChecklistItem]:
    last_position = db.scalar(
        select(func.max(TripChecklistItem.position)).where(
            TripChecklistItem.trip_id == trip_id
        )
    )
    start = (last_position or 0) + 1

    created = [
        TripChecklistItem(
            trip_id=trip_id,
            position=start + offset,
            **item.model_dump(),
        )
        for offset, item in enumerate(items)
    ]

    db.add_all(created)
    db.commit()

    for item in created:
        db.refresh(item)

    return created


@router.get("/", response_model=list[TripChecklistItemResponse])
def list_checklist(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    The trip's checklist: generated requirements first, then personal items.
    """
    get_own_trip(trip_id, current_user, db)

    return db.scalars(
        select(TripChecklistItem)
        .where(TripChecklistItem.trip_id == trip_id)
        .order_by(TripChecklistItem.personal, TripChecklistItem.position)
    ).all()


@router.post(
    "/",
    response_model=TripChecklistItemResponse,
    status_code=201,
)
def create_checklist_item(
    trip_id: int,
    item: TripChecklistItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    get_own_trip(trip_id, current_user, db)

    return add_items(trip_id, [item], db)[0]


@router.post(
    "/bulk",
    response_model=list[TripChecklistItemResponse],
    status_code=201,
)
def create_checklist_items(
    trip_id: int,
    request: TripChecklistItemsCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Add several items at once, e.g. the planner's checklist when a trip is
    created.
    """
    get_own_trip(trip_id, current_user, db)

    return add_items(trip_id, request.items, db)


DAY_MEALS = ("breakfast", "lunch", "dinner")


def meal_response(
    saved: dict[tuple[int | None, str], TripMeal],
    day_number: int | None,
    meal: str,
) -> TripMealResponse:
    """The saved meal, or a fast-food default when nothing is planned yet."""

    row = saved.get((day_number, meal))

    return TripMealResponse(
        day_number=day_number,
        meal=meal,
        kind=row.kind if row else "fast_food",
        description=row.description if row else None,
    )


@router.get("/meals", response_model=TripMealPlanResponse)
def get_meal_plan(
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Breakfast, lunch and dinner for every day of the trip, plus snacks for
    the whole trip. Meals not planned yet come back as fast food.
    """

    trip = get_own_trip(trip_id, current_user, db)
    saved = {
        (row.day_number, row.meal): row
        for row in db.scalars(select(TripMeal).where(TripMeal.trip_id == trip_id))
    }

    return TripMealPlanResponse(
        days=[
            TripMealDay(
                day_number=day,
                **{meal: meal_response(saved, day, meal) for meal in DAY_MEALS},
            )
            for day in range(1, trip.duration_days + 1)
        ],
        snacks=meal_response(saved, None, "snacks"),
    )


@router.put("/meals", response_model=TripMealResponse)
def update_meal(
    meal: TripMealUpdate,
    trip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Plan one meal: fast food, or home-prepared with a description.
    """

    trip = get_own_trip(trip_id, current_user, db)

    if meal.day_number is not None and meal.day_number > trip.duration_days:
        raise HTTPException(
            status_code=422,
            detail=f"The trip has {trip.duration_days} days",
        )

    row = db.scalar(
        select(TripMeal).where(
            TripMeal.trip_id == trip_id,
            TripMeal.meal == meal.meal,
            TripMeal.day_number.is_(None)
            if meal.day_number is None
            else TripMeal.day_number == meal.day_number,
        )
    )

    if row is None:
        row = TripMeal(trip_id=trip_id, day_number=meal.day_number, meal=meal.meal)
        db.add(row)

    row.kind = meal.kind
    row.description = meal.description
    db.commit()

    return TripMealResponse(
        day_number=row.day_number,
        meal=row.meal,
        kind=row.kind,
        description=row.description,
    )


@router.patch("/{item_id}", response_model=TripChecklistItemResponse)
def update_checklist_item(
    trip_id: int,
    item_id: int,
    changes: TripChecklistItemUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = get_own_item(trip_id, item_id, current_user, db)

    for field, value in changes.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)

    return item


@router.delete("/{item_id}", status_code=204)
def delete_checklist_item(
    trip_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = get_own_item(trip_id, item_id, current_user, db)

    db.delete(item)
    db.commit()

    return Response(status_code=204)
