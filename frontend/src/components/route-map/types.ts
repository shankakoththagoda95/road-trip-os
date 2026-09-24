export type MapPointKind =
  | 'start'
  | 'stop'
  | 'destination'
  | 'fuel'
  | 'charge'
  | 'border';

export type MapPoint = {
  label: string;
  latitude: number;
  longitude: number;
  kind: MapPointKind;
};

export type RouteMapProps = {
  points: MapPoint[];
  // Route line as GeoJSON [longitude, latitude] pairs.
  line?: [number, number][];
  height?: number;
};

export const MarkerColors: Record<MapPointKind, string> = {
  start: '#16A34A',
  stop: '#2563EB',
  destination: '#DC2626',
  fuel: '#F97316',
  charge: '#A855F7',
  border: '#64748B',
};
