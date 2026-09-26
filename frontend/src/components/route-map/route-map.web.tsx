import 'leaflet/dist/leaflet.css';

import type { LatLngTuple } from 'leaflet';
import { Fragment, useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';

import { useTheme } from '@/hooks/use-theme';

import { MarkerColors, type RouteMapProps } from './types';

// Shown before any location is known: roughly central Europe.
const DefaultCenter: LatLngTuple = [54, 15];
const DefaultZoom = 4;

/**
 * Leaflet map with start / stop / destination markers and the route line.
 */
export function RouteMap({ points, line, height = 320, focus }: RouteMapProps) {
  const colors = useTheme();

  const markerPositions = points.map((point): LatLngTuple => [
    point.latitude,
    point.longitude,
  ]);
  const linePositions = (line ?? []).map(
    ([longitude, latitude]): LatLngTuple => [latitude, longitude],
  );
  // The focus points if given; otherwise the route (or its markers),
  // plus the traveller wherever they are.
  const boundsPositions: LatLngTuple[] =
    focus && focus.length > 0
      ? focus.map((point): LatLngTuple => [point.latitude, point.longitude])
      : [
          ...(linePositions.length > 0 ? linePositions : markerPositions),
          ...points
            .filter((point) => point.kind === 'current')
            .map((point): LatLngTuple => [point.latitude, point.longitude]),
        ];

  let stopNumber = 0;

  return (
    <div
      style={{
        height,
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        // Keep Leaflet's panes below app overlays.
        position: 'relative',
        zIndex: 0,
      }}>
      <MapContainer
        center={markerPositions[0] ?? DefaultCenter}
        zoom={markerPositions.length > 0 ? 8 : DefaultZoom}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {linePositions.length > 0 && (
          <Polyline
            positions={linePositions}
            pathOptions={{ color: colors.primary, weight: 5, opacity: 0.85 }}
          />
        )}

        {points.map((point, index) => {
          const isEndpoint =
            point.kind === 'start' || point.kind === 'destination';
          const label =
            point.kind === 'stop'
              ? `${++stopNumber}. ${point.label}`
              : point.label;

          // The traveller: a haloed dot with its label always shown.
          if (point.kind === 'current') {
            return (
              <Fragment key={`current-${index}`}>
                <CircleMarker
                  center={[point.latitude, point.longitude]}
                  radius={20}
                  interactive={false}
                  pathOptions={{
                    stroke: false,
                    fillColor: MarkerColors.current,
                    fillOpacity: 0.22,
                  }}
                />
                <CircleMarker
                  center={[point.latitude, point.longitude]}
                  radius={9}
                  pathOptions={{
                    color: '#FFFFFF',
                    weight: 3,
                    fillColor: MarkerColors.current,
                    fillOpacity: 1,
                  }}>
                  <Tooltip direction="top" offset={[0, -10]} permanent>
                    {label}
                  </Tooltip>
                </CircleMarker>
              </Fragment>
            );
          }

          return (
            <CircleMarker
              key={`${point.kind}-${index}`}
              center={[point.latitude, point.longitude]}
              radius={isEndpoint ? 10 : 8}
              pathOptions={{
                color: '#FFFFFF',
                weight: 2,
                fillColor: MarkerColors[point.kind],
                fillOpacity: 1,
              }}>
              <Tooltip
                direction="top"
                offset={[0, -8]}
                permanent={Boolean(point.permanentLabel)}>
                {point.permanentLabel ?? label}
              </Tooltip>
            </CircleMarker>
          );
        })}

        <FitBounds positions={boundsPositions} />
      </MapContainer>
    </div>
  );
}

// Zooms the map to show every position whenever they change.
function FitBounds({ positions }: { positions: LatLngTuple[] }) {
  const map = useMap();
  const key = JSON.stringify(positions);

  useEffect(() => {
    const latLngs: LatLngTuple[] = JSON.parse(key);

    function fit() {
      // The container may have changed size since Leaflet measured it
      // (e.g. inside a popup that animates open).
      map.invalidateSize();

      if (latLngs.length === 1) {
        map.setView(latLngs[0], 10);
      } else if (latLngs.length > 1) {
        map.fitBounds(latLngs, { padding: [32, 32] });
      }
    }

    fit();
    // Again once opening animations have finished.
    const settled = setTimeout(fit, 350);

    return () => clearTimeout(settled);
  }, [map, key]);

  return null;
}
