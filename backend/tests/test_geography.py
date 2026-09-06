import pytest

from app.services.geography import (
    calculate_distance_km,
    calculate_total_distance_km,
    remove_consecutive_duplicate_coordinates,
    filter_gps_coordinates_by_distance,
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


def test_remove_consecutive_duplicate_coordinates():
    coordinates = [
        (59.3293, 18.0686),
        (59.3293, 18.0686),
        (59.3300, 18.0700),
        (59.3300, 18.0700),
        (59.3310, 18.0710),
    ]

    result = remove_consecutive_duplicate_coordinates(coordinates)

    assert result == [
        (59.3293, 18.0686),
        (59.3300, 18.0700),
        (59.3310, 18.0710),
    ]


def test_remove_consecutive_duplicate_coordinates_keeps_non_consecutive_duplicates():
    coordinates = [
        (59.3293, 18.0686),
        (59.3300, 18.0700),
        (59.3293, 18.0686),
    ]

    result = remove_consecutive_duplicate_coordinates(coordinates)

    assert result == coordinates


def test_remove_consecutive_duplicate_coordinates_empty():
    result = remove_consecutive_duplicate_coordinates([])

    assert result == []


def test_filter_gps_coordinates_by_distance_keeps_first_coordinate():
    coordinates = [
        (59.3293, 18.0686),
    ]

    result = filter_gps_coordinates_by_distance(coordinates)

    assert result == coordinates


def test_filter_gps_coordinates_by_distance_ignores_small_movement():
    coordinates = [
        (59.3293, 18.0686),
        (59.32931, 18.06861),
    ]

    result = filter_gps_coordinates_by_distance(coordinates)

    assert result == [
        (59.3293, 18.0686),
    ]


def test_filter_gps_coordinates_by_distance_accepts_large_movement():
    coordinates = [
        (59.3293, 18.0686),
        (59.3310, 18.0700),
    ]

    result = filter_gps_coordinates_by_distance(coordinates)

    assert result == coordinates


def test_filter_gps_coordinates_by_distance_compares_to_last_accepted_point():
    coordinates = [
        (59.3293, 18.0686),
        (59.32931, 18.06861),
        (59.32932, 18.06862),
        (59.3310, 18.0700),
    ]

    result = filter_gps_coordinates_by_distance(coordinates)

    assert result == [
        (59.3293, 18.0686),
        (59.3310, 18.0700),
    ]


def test_filter_gps_coordinates_by_distance_empty():
    result = filter_gps_coordinates_by_distance([])

    assert result == []


def test_filter_gps_coordinates_uses_20_meter_default_threshold():
    coordinates = [
        (59.3293, 18.0686),
        (59.32931, 18.06861),
    ]

    result = filter_gps_coordinates_by_distance(coordinates)

    assert result == [
        (59.3293, 18.0686),
    ]


def test_filter_gps_coordinates_accepts_custom_threshold():
    coordinates = [
        (59.3293, 18.0686),
        (59.3295, 18.0688),
    ]

    result = filter_gps_coordinates_by_distance(
        coordinates,
        threshold_meters=1,
    )

    assert result == coordinates


def test_filter_gps_coordinates_rejects_threshold_below_1_meter():
    with pytest.raises(ValueError, match="between 1 and 1000 meters"):
        filter_gps_coordinates_by_distance(
            [],
            threshold_meters=0,
        )


def test_filter_gps_coordinates_rejects_threshold_above_1_km():
    with pytest.raises(ValueError, match="between 1 and 1000 meters"):
        filter_gps_coordinates_by_distance(
            [],
            threshold_meters=1001,
        )


def test_filter_gps_coordinates_accepts_1_meter_boundary():
    result = filter_gps_coordinates_by_distance(
        [],
        threshold_meters=1,
    )

    assert result == []


def test_filter_gps_coordinates_accepts_1_km_boundary():
    result = filter_gps_coordinates_by_distance(
        [],
        threshold_meters=1000,
    )

    assert result == []