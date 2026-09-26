"""
Google Places API (New): find a place by name and get a photo of it.

The API key stays on the server. Photo links returned to the app are
Google's short-lived image URLs (no key in them). Results are cached in
memory for an hour to keep Google charges down; Google's terms allow
short-term caching only.
"""

import time
from dataclasses import dataclass, field

import httpx

from app.core import settings


SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
MEDIA_URL = "https://places.googleapis.com/v1/{name}/media"

FIELD_MASK = ",".join(
    [
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.photos",
    ]
)

PHOTO_MAX_WIDTH = 800
CACHE_SECONDS = 60 * 60
CACHE_MAX_ENTRIES = 500


class PlacesNotConfigured(RuntimeError):
    """No Google Maps API key is set."""


@dataclass
class PhotoAttribution:
    name: str
    url: str | None


@dataclass
class PlaceLookup:
    query: str
    name: str
    address: str
    country: str | None
    latitude: float
    longitude: float
    photo_url: str | None
    photo_attributions: list[PhotoAttribution] = field(default_factory=list)


_cache: dict[str, tuple[float, PlaceLookup | None]] = {}


def _country(address: str) -> str | None:
    # Formatted addresses end with the country, e.g. "Hallstatt, Austria".
    parts = [part.strip() for part in address.split(",") if part.strip()]
    return parts[-1] if len(parts) > 1 else None


def _photo(place: dict, api_key: str) -> tuple[str | None, list[PhotoAttribution]]:
    photos = place.get("photos") or []

    if not photos:
        return None, []

    photo = photos[0]
    response = httpx.get(
        MEDIA_URL.format(name=photo["name"]),
        params={
            "key": api_key,
            "maxWidthPx": PHOTO_MAX_WIDTH,
            "skipHttpRedirect": "true",
        },
        timeout=10,
    )
    response.raise_for_status()

    attributions = [
        PhotoAttribution(
            name=author.get("displayName", "Google Maps user"),
            url=author.get("uri"),
        )
        for author in photo.get("authorAttributions") or []
    ]

    return response.json().get("photoUri"), attributions


def lookup_place(query: str, api_key: str | None = None) -> PlaceLookup | None:
    """
    Best match for `query` with one photo, or None if nothing matches.
    """

    api_key = api_key if api_key is not None else settings.GOOGLE_MAPS_API_KEY

    if not api_key:
        raise PlacesNotConfigured("GOOGLE_MAPS_API_KEY is not set")

    key = query.strip().lower()
    cached = _cache.get(key)

    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]

    response = httpx.post(
        SEARCH_URL,
        json={"textQuery": query, "maxResultCount": 1},
        headers={
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
        timeout=10,
    )
    response.raise_for_status()

    places = response.json().get("places") or []
    result = None

    if places:
        place = places[0]
        address = place.get("formattedAddress", "")
        photo_url, attributions = _photo(place, api_key)

        result = PlaceLookup(
            query=query,
            name=(place.get("displayName") or {}).get("text", query),
            address=address,
            country=_country(address),
            latitude=place["location"]["latitude"],
            longitude=place["location"]["longitude"],
            photo_url=photo_url,
            photo_attributions=attributions,
        )

    if len(_cache) >= CACHE_MAX_ENTRIES:
        _cache.clear()

    _cache[key] = (time.monotonic(), result)

    return result


def clear_cache() -> None:
    _cache.clear()
