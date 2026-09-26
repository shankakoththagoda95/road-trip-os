from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.dependencies import get_current_user
from app.integrations.google_places import PlacesNotConfigured, lookup_place
from app.models.user import User
from app.services.geocoding import reverse_place


router = APIRouter(
    prefix="/places",
    tags=["places"],
)


class PhotoAttributionResponse(BaseModel):
    name: str
    url: str | None


class PlaceLookupResponse(BaseModel):
    query: str
    name: str
    address: str
    country: str | None
    latitude: float
    longitude: float
    # Short-lived Google image URL, or None if the place has no photos.
    photo_url: str | None
    # Must be shown wherever the photo is displayed (Google's terms).
    photo_attributions: list[PhotoAttributionResponse]


@router.get(
    "/lookup",
    response_model=PlaceLookupResponse,
)
def lookup(
    q: str = Query(min_length=1, max_length=120),
    current_user: User = Depends(get_current_user),
):
    """
    Find a place by name, with a photo (Google Places).
    """

    try:
        place = lookup_place(q.strip())
    except PlacesNotConfigured:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "places_not_configured",
                "message": "Place photos aren't set up on the server.",
            },
        )

    if place is None:
        raise HTTPException(
            status_code=404,
            detail=f"Couldn't find “{q.strip()}”.",
        )

    return asdict(place)


class ReversePlaceResponse(BaseModel):
    name: str
    region: str | None
    country: str | None
    country_code: str | None


@router.get("/reverse", response_model=ReversePlaceResponse)
def reverse(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    current_user: User = Depends(get_current_user),
):
    """
    The town or city at a point, e.g. the traveller's current position.
    """

    place = reverse_place(latitude, longitude)

    if place is None:
        raise HTTPException(status_code=404, detail="No town or city here.")

    return place
