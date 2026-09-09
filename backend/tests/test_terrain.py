from app.services.terrain import (
    calculate_total_ascent,
    calculate_total_descent,
)
from app.services.terrain import (
    TerrainSummary,
    calculate_elevation_range,
    calculate_max_elevation,
    calculate_min_elevation,
    calculate_terrain_summary,
    calculate_total_ascent,
    calculate_total_descent,
)


def test_calculate_total_ascent():
    elevations = [24.0, 40.0, 15.0, 52.0]

    result = calculate_total_ascent(elevations)

    assert result == 53.0


def test_calculate_total_ascent_flat_route():
    elevations = [20.0, 20.0, 20.0]

    result = calculate_total_ascent(elevations)

    assert result == 0.0


def test_calculate_total_ascent_only_downhill():
    elevations = [100.0, 80.0, 50.0, 10.0]

    result = calculate_total_ascent(elevations)

    assert result == 0.0


def test_calculate_total_ascent_empty():
    result = calculate_total_ascent([])

    assert result == 0.0


def test_calculate_total_descent():
    elevations = [24.0, 40.0, 15.0, 52.0]

    result = calculate_total_descent(elevations)

    assert result == 25.0


def test_calculate_total_descent_flat_route():
    elevations = [20.0, 20.0, 20.0]

    result = calculate_total_descent(elevations)

    assert result == 0.0


def test_calculate_total_descent_only_uphill():
    elevations = [10.0, 50.0, 80.0, 100.0]

    result = calculate_total_descent(elevations)

    assert result == 0.0


def test_calculate_total_descent_empty():
    result = calculate_total_descent([])

    assert result == 0.0


def test_calculate_max_elevation():
    elevations = [24.0, 40.0, 15.0, 52.0]

    result = calculate_max_elevation(elevations)

    assert result == 52.0


def test_calculate_max_elevation_negative_values():
    elevations = [-10.0, -5.0, -20.0]

    result = calculate_max_elevation(elevations)

    assert result == -5.0


def test_calculate_max_elevation_empty():
    result = calculate_max_elevation([])

    assert result == 0.0


def test_calculate_min_elevation():
    elevations = [24.0, 40.0, 15.0, 52.0]

    result = calculate_min_elevation(elevations)

    assert result == 15.0


def test_calculate_min_elevation_negative_values():
    elevations = [-10.0, -5.0, -20.0]

    result = calculate_min_elevation(elevations)

    assert result == -20.0


def test_calculate_min_elevation_empty():
    result = calculate_min_elevation([])

    assert result == 0.0


def test_calculate_elevation_range():
    elevations = [24.0, 40.0, 15.0, 52.0]

    result = calculate_elevation_range(elevations)

    assert result == 37.0


def test_calculate_elevation_range_negative_values():
    elevations = [-20.0, -5.0, -15.0]

    result = calculate_elevation_range(elevations)

    assert result == 15.0


def test_calculate_elevation_range_empty():
    result = calculate_elevation_range([])

    assert result == 0.0


def test_calculate_terrain_summary():
    elevations = [24.0, 40.0, 15.0, 52.0]

    result = calculate_terrain_summary(elevations)

    assert isinstance(result, TerrainSummary)
    assert result.total_ascent_m == 53.0
    assert result.total_descent_m == 25.0
    assert result.max_elevation_m == 52.0
    assert result.min_elevation_m == 15.0
    assert result.elevation_range_m == 37.0


def test_calculate_terrain_summary_empty():
    result = calculate_terrain_summary([])

    assert result.total_ascent_m == 0.0
    assert result.total_descent_m == 0.0
    assert result.max_elevation_m == 0.0
    assert result.min_elevation_m == 0.0
    assert result.elevation_range_m == 0.0