from unittest.mock import MagicMock, patch

import pytest

from app.core.security import create_access_token
from app.integrations import google_places
from app.integrations.google_places import PlacesNotConfigured, lookup_place


SEARCH_RESPONSE = {
    "places": [
        {
            "displayName": {"text": "Hallstatt"},
            "formattedAddress": "4830 Hallstatt, Austria",
            "location": {"latitude": 47.5622, "longitude": 13.6493},
            "photos": [
                {
                    "name": "places/abc/photos/xyz",
                    "authorAttributions": [
                        {"displayName": "Jane Doe", "uri": "https://maps.google.com/jane"}
                    ],
                }
            ],
        }
    ]
}


def response(json_data):
    mock = MagicMock()
    mock.json.return_value = json_data
    mock.raise_for_status.return_value = None
    return mock


@pytest.fixture(autouse=True)
def fresh_cache():
    google_places.clear_cache()
    yield
    google_places.clear_cache()


@pytest.fixture
def google():
    with (
        patch("app.integrations.google_places.httpx.post") as post,
        patch("app.integrations.google_places.httpx.get") as get,
    ):
        post.return_value = response(SEARCH_RESPONSE)
        get.return_value = response({"photoUri": "https://lh3.googleusercontent.com/photo"})
        yield post, get


def test_lookup_returns_place_photo_and_attribution(google):
    post, get = google

    place = lookup_place("Hallstatt", api_key="test-key")

    assert place.name == "Hallstatt"
    assert place.country == "Austria"
    assert (place.latitude, place.longitude) == (47.5622, 13.6493)
    assert place.photo_url == "https://lh3.googleusercontent.com/photo"
    assert place.photo_attributions[0].name == "Jane Doe"

    # The key is sent to Google, never returned.
    assert post.call_args.kwargs["headers"]["X-Goog-Api-Key"] == "test-key"
    assert "places.photos" in post.call_args.kwargs["headers"]["X-Goog-FieldMask"]
    assert get.call_args.kwargs["params"]["skipHttpRedirect"] == "true"
    assert "test-key" not in place.photo_url


def test_lookup_is_cached(google):
    post, _ = google

    lookup_place("Hallstatt", api_key="test-key")
    lookup_place("  hallstatt ", api_key="test-key")

    assert post.call_count == 1


def test_place_without_photos(google):
    post, get = google
    post.return_value = response(
        {"places": [{**SEARCH_RESPONSE["places"][0], "photos": []}]}
    )

    place = lookup_place("Hallstatt", api_key="test-key")

    assert place.photo_url is None
    assert place.photo_attributions == []
    get.assert_not_called()


def test_no_match_returns_none(google):
    post, _ = google
    post.return_value = response({})

    assert lookup_place("Nowhereville", api_key="test-key") is None


def test_missing_key_raises():
    with pytest.raises(PlacesNotConfigured):
        lookup_place("Hallstatt", api_key="")


@pytest.fixture
def auth_headers(test_user):
    return {"Authorization": f"Bearer {create_access_token(test_user.id)}"}


def test_lookup_endpoint(client, auth_headers, google):
    with patch("app.core.settings.GOOGLE_MAPS_API_KEY", "test-key"):
        result = client.get("/places/lookup?q=Hallstatt", headers=auth_headers)

    assert result.status_code == 200
    assert result.json()["country"] == "Austria"
    assert result.json()["photo_attributions"][0]["url"] == "https://maps.google.com/jane"


def test_lookup_endpoint_without_key(client, auth_headers):
    with patch("app.core.settings.GOOGLE_MAPS_API_KEY", ""):
        result = client.get("/places/lookup?q=Hallstatt", headers=auth_headers)

    assert result.status_code == 503
    assert result.json()["detail"]["code"] == "places_not_configured"


def test_lookup_endpoint_not_found(client, auth_headers, google):
    post, _ = google
    post.return_value = response({})

    with patch("app.core.settings.GOOGLE_MAPS_API_KEY", "test-key"):
        result = client.get("/places/lookup?q=Nowhereville", headers=auth_headers)

    assert result.status_code == 404
