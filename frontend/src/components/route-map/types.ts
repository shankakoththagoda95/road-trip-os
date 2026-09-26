export type MapPointKind =
  | 'start'
  | 'stop'
  | 'destination'
  | 'fuel'
  | 'charge'
  | 'border'
  // The traveller's own position.
  | 'current';

export type MapPoint = {
  label: string;
  // Shown next to the marker all the time (the label shows on hover).
  permanentLabel?: string;
  latitude: number;
  longitude: number;
  kind: MapPointKind;
};

export type RouteMapProps = {
  points: MapPoint[];
  // Route line as GeoJSON [longitude, latitude] pairs.
  line?: [number, number][];
  height?: number;
  // Zoom to just these points (e.g. the traveller and nearby stations)
  // instead of the whole route.
  focus?: { latitude: number; longitude: number }[];
};

export const MarkerColors: Record<MapPointKind, string> = {
  start: '#16A34A',
  stop: '#2563EB',
  destination: '#DC2626',
  fuel: '#F97316',
  charge: '#A855F7',
  border: '#64748B',
  current: '#0EA5E9',
};
