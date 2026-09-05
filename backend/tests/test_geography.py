import pytest

from app.services.geography import (
    calculate_distance_km,
    calculate_total_distance_km,
)


def test_distance_between_same_coordinates_is_zero():
    distance = calculate_distance_km(
        59.3293,
        18.0686,
        59.3293,
        18.0686,
    )

    assert distance == pytest.approx(0.0)


def test_distance_between_stockholm_and_oslo():
    distance = calculate_distance_km(
        59.3293,
        18.0686,
        59.9139,
        10.7522,
    )

    assert distance == pytest.approx(416, abs=5)


def test_distance_is_symmetric():
    stockholm_to_oslo = calculate_distance_km(
        59.3293,
        18.0686,
        59.9139,
        10.7522,
    )

    oslo_to_stockholm = calculate_distance_km(
        59.9139,
        10.7522,
        59.3293,
        18.0686,
    )

    assert stockholm_to_oslo == pytest.approx(
        oslo_to_stockholm
    )


def test_distance_handles_equator():
    distance = calculate_distance_km(
        0.0,
        0.0,
        0.0,
        1.0,
    )

    assert distance == pytest.approx(111.2, abs=0.5)


def test_distance_handles_negative_coordinates():
    distance = calculate_distance_km(
        -33.8688,
        151.2093,
        -37.8136,
        144.9631,
    )

    assert distance == pytest.approx(714, abs=10)


def test_total_distance_with_multiple_points():
    coordinates = [
        (59.3293, 18.0686),
        (59.3326, 18.0649),
        (59.3346, 18.0632),
    ]

    result = calculate_total_distance_km(coordinates)

    assert result > 0


def test_total_distance_with_two_points():
    coordinates = [
        (59.3293, 18.0686),
        (59.3326, 18.0649),
    ]

    result = calculate_total_distance_km(coordinates)

    assert result > 0


def test_total_distance_with_one_point():
    coordinates = [
        (59.3293, 18.0686),
    ]

    result = calculate_total_distance_km(coordinates)

    assert result == 0.0


def test_total_distance_with_no_points():
    result = calculate_total_distance_km([])

    assert result == 0.0


def test_total_distance_is_sum_of_segments():
    coordinates = [
        (59.3293, 18.0686),
        (59.3326, 18.0649),
        (59.3346, 18.0632),
    ]

    first_segment = calculate_distance_km(
        59.3293,
        18.0686,
        59.3326,
        18.0649,
    )

    second_segment = calculate_distance_km(
        59.3326,
        18.0649,
        59.3346,
        18.0632,
    )

    result = calculate_total_distance_km(coordinates)

    assert result == pytest.approx(
        first_segment + second_segment
    )