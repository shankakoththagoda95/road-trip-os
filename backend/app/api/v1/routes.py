import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import get_current_user
from app.models.user import User
from app.schemas.route import (
    GeocodeRequest,
    GeocodeResponse,
    RoutePreviewRequest,
    RoutePreviewResponse,
)
from app.services.geocoding import search_location
from app.services.route_preview import preview_route


router = APIRouter(
    prefix="/routes",
    tags=["routes"],
)


@router.post(
    "/geocode",
    response_model=GeocodeResponse,
)
def geocode(
    request: GeocodeRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Look up one location by name (best match only).
    """

    query = request.query.strip()

    try:
        result = search_location(query)
    except ValueError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error),
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Location service is unavailable. Try again shortly.",
        )

    return {
        "query": query,
        **result,
    }


@router.post(
    "/preview",
    response_model=RoutePreviewResponse,
)
def preview(
    request: RoutePreviewRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Calculate a route before the trip is saved (used while planning).
    """

    try:
        return preview_route(request)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )
    except httpx.HTTPError:
        raise HTTPException(
            status_code=502,
            detail="Routing service is unavailable. Try again shortly.",
        )
