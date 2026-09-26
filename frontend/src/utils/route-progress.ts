import type { RoutePoint } from '@/api/routes';

export type LatLng = { latitude: number; longitude: number };

const EarthRadiusKm = 6371;

// Beyond this the traveller isn't on the planned route.
export const OffRouteKm = 25;

export function haversineKm(a: LatLng, b: LatLng) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) *
      Math.cos(toRad(b.latitude)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EarthRadiusKm * Math.asin(Math.sqrt(h));
}

export type RouteLine = {
  points: LatLng[];
  // Distance from the start to each point, in km.
  cumulativeKm: number[];
  totalKm: number;
};

/**
 * A route geometry (GeoJSON [longitude, latitude] pairs) ready for
 * measuring along.
 */
export function routeLine(coordinates: [number, number][]): RouteLine {
  const points = coordinates.map(([longitude, latitude]) => ({
    latitude,
    longitude,
  }));
  const cumulativeKm = [0];

  for (let index = 1; index < points.length; index++) {
    cumulativeKm.push(
      cumulativeKm[index - 1] + haversineKm(points[index - 1], points[index]),
    );
  }

  return { points, cumulativeKm, totalKm: cumulativeKm.at(-1) ?? 0 };
}

export type RouteProjection = {
  // Distance along the route to the closest point on it.
  alongKm: number;
  // How far the position is from the route.
  offRouteKm: number;
};

/**
 * The closest point on the route to a position, as a distance along it.
 * Uses a flat projection per segment, which is accurate at road scale.
 * With `afterKm`, only the route from there on is searched (so a round
 * trip's way home isn't mistaken for the way out).
 */
export function projectOntoRoute(
  line: RouteLine,
  position: LatLng,
  afterKm = 0,
): RouteProjection | null {
  if (line.points.length < 2) {
    return null;
  }

  let best: RouteProjection | null = null;
  const kmPerDegLat = (Math.PI / 180) * EarthRadiusKm;

  for (let index = 1; index < line.points.length; index++) {
    if (line.cumulativeKm[index] < afterKm) {
      continue;
    }

    const a = line.points[index - 1];
    const b = line.points[index];
    const kmPerDegLng = kmPerDegLat * Math.cos((a.latitude * Math.PI) / 180);

    // Segment and position in km, relative to the segment's start.
    const bx = (b.longitude - a.longitude) * kmPerDegLng;
    const by = (b.latitude - a.latitude) * kmPerDegLat;
    const px = (position.longitude - a.longitude) * kmPerDegLng;
    const py = (position.latitude - a.latitude) * kmPerDegLat;
    const lengthSquared = bx * bx + by * by;
    const t =
      lengthSquared > 0
        ? Math.min(1, Math.max(0, (px * bx + py * by) / lengthSquared))
        : 0;
    const distance = Math.hypot(px - t * bx, py - t * by);

    if (!best || distance < best.offRouteKm) {
      const segmentKm = line.cumulativeKm[index] - line.cumulativeKm[index - 1];
      best = {
        alongKm: line.cumulativeKm[index - 1] + t * segmentKm,
        offRouteKm: distance,
      };
    }
  }

  return best;
}

export type RouteStopAlong = RoutePoint & {
  // Distance along the route to this stop.
  alongKm: number;
};

/**
 * The route's stops with their distance along it, in route order. On round
 * trips the start is added again at the end (the way home).
 */
export function stopsAlongRoute(
  line: RouteLine,
  points: RoutePoint[],
  roundTrip: boolean,
): RouteStopAlong[] {
  let afterKm = 0;
  const stops: RouteStopAlong[] = [];

  for (const point of points) {
    const projection = projectOntoRoute(line, point, afterKm);
    const alongKm =
      point.kind === 'start' ? 0 : (projection?.alongKm ?? afterKm);
    stops.push({ ...point, alongKm });
    afterKm = alongKm;
  }

  const start = points.find((point) => point.kind === 'start');

  if (roundTrip && start) {
    stops.push({ ...start, kind: 'destination', alongKm: line.totalKm });
  }

  return stops;
}
