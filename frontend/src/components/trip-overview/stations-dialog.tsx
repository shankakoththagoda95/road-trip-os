import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import type {
  NearestStation,
  NearestStations,
  StationKind,
} from '@/api/stations';
import { ModalDialog } from '@/components/modal-dialog';
import { RouteMap } from '@/components/route-map/route-map';
import type { MapPoint } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { CurrentPosition } from '@/hooks/use-current-location';
import { useTheme } from '@/hooks/use-theme';

const bannerImage = require('@/assets/images/brand/fueling-banner.jpg');

// Width from which the map and the list sit side by side.
const SideBySide = 820;

const FuelLabels: Record<string, string> = {
  diesel: 'Diesel',
  petrol_95: 'Petrol 95',
  e10: 'E10',
};

export type StationSearchState =
  | { status: 'idle' }
  | { status: 'waiting' }
  | { status: 'searching' }
  | { status: 'done'; result: NearestStations; from: CurrentPosition }
  | { status: 'error'; message: string };

/**
 * Popup with the nearest stations on a map, each labelled with its
 * distance, and a list with directions.
 */
export function StationsDialog({
  visible,
  onClose,
  kind,
  tint,
  search,
  locationDenied,
  onRetry,
}: {
  visible: boolean;
  onClose: () => void;
  kind: StationKind;
  tint: string;
  search: StationSearchState;
  locationDenied: boolean;
  onRetry: () => void;
}) {
  const { width } = useWindowDimensions();
  const noun = kind === 'fuel' ? 'fuel stations' : 'charging stations';

  return (
    <ModalDialog
      visible={visible}
      title={`Nearest ${noun}`}
      subtitle={searchSummary(search)}
      headerImage={bannerImage}
      maxWidth={1000}
      onClose={onClose}>
      <StationSearchBody
        search={search}
        kind={kind}
        tint={tint}
        locationDenied={locationDenied}
        onRetry={onRetry}
        sideBySide={width >= SideBySide}
      />
    </ModalDialog>
  );
}

/**
 * One line on how the search went, e.g. "Found within 3 km of you."
 */
export function searchSummary(search: StationSearchState) {
  switch (search.status) {
    case 'done':
      return search.result.radius_km !== null
        ? `Found within ${search.result.radius_km} km of you. The search grew 1 km at a time.`
        : `Nothing within ${search.result.searched_up_to_km} km of you.`;
    case 'waiting':
      return 'Finding your location…';
    case 'searching':
      return 'Searching around you, 1 km wider each step…';
    case 'error':
      return "The search didn't work this time.";
    default:
      return 'The search starts 1 km around you and grows 1 km at a time.';
  }
}

/**
 * The results as a map (each station labelled with its distance) and a
 * list with directions, or how the search is going.
 */
export function StationSearchBody({
  search,
  kind,
  tint,
  locationDenied,
  onRetry,
  sideBySide,
  mapHeight = 400,
  idleText,
}: {
  search: StationSearchState;
  kind: StationKind;
  tint: string;
  locationDenied: boolean;
  onRetry: () => void;
  // Map and list next to each other (wide screens).
  sideBySide: boolean;
  mapHeight?: number;
  // Shown before the first search.
  idleText?: string;
}) {
  const colors = useTheme();
  const noun = kind === 'fuel' ? 'fuel stations' : 'charging stations';

  if (search.status === 'done' && search.result.stations.length > 0) {
    return (
      <View style={[styles.content, sideBySide && styles.contentWide]}>
        <View style={[styles.map, sideBySide && styles.mapWide]}>
          <RouteMap
            height={sideBySide ? mapHeight : 280}
            points={mapPoints(search.from, search.result.stations, kind)}
            focus={[search.from, ...search.result.stations]}
          />
        </View>

        <View style={[styles.list, sideBySide && styles.listWide]}>
          {search.result.stations.map((station, index) => (
            <StationRow
              key={station.provider_id}
              station={station}
              number={index + 1}
              tint={tint}
              from={search.from}
              nearest={index === 0}
            />
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            Distances are straight-line from where you are; the drive is a
            little longer.
          </ThemedText>
        </View>
      </View>
    );
  }

  if (search.status === 'error' || search.status === 'done') {
    return (
      <View style={styles.status}>
        <MaterialCommunityIcons
          name={
            search.status === 'error'
              ? 'alert-circle-outline'
              : 'map-search-outline'
          }
          size={40}
          color={colors.textSecondary}
        />
        <ThemedText themeColor="textSecondary" style={styles.statusText}>
          {search.status === 'error'
            ? search.message
            : `No ${noun} within ${search.result.searched_up_to_km} km of you.`}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ hovered, pressed }) => [
            styles.button,
            { backgroundColor: tint },
            (hovered || pressed) && styles.pressed,
          ]}>
          <ThemedText type="smallBold" style={styles.buttonText}>
            Try again
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  if (search.status === 'idle') {
    return (
      <View style={styles.status}>
        <MaterialCommunityIcons
          name="map-marker-radius-outline"
          size={44}
          color={tint}
        />
        <ThemedText themeColor="textSecondary" style={styles.statusText}>
          {idleText ?? `Find the nearest ${noun} around you.`}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.status}>
      <ActivityIndicator size="large" color={tint} />
      <ThemedText themeColor="textSecondary" style={styles.statusText}>
        {search.status === 'waiting'
          ? locationDenied
            ? 'Location is blocked. Allow it for this site in your browser settings, then try again.'
            : 'Finding your location…'
          : `Looking for ${noun} 1 km around you, then 2 km, 3 km…`}
      </ThemedText>
    </View>
  );
}

function StationRow({
  station,
  number,
  tint,
  from,
  nearest,
}: {
  station: NearestStation;
  number: number;
  tint: string;
  from: CurrentPosition;
  nearest: boolean;
}) {
  const colors = useTheme();
  const details = [
    station.operator,
    station.power_kw ? `${Math.round(station.power_kw)} kW` : null,
    ...station.details.map((detail) => FuelLabels[detail] ?? detail),
  ].filter(Boolean);

  return (
    <View
      style={[
        styles.row,
        {
          borderColor: nearest ? tint : colors.border,
          backgroundColor: colors.backgroundElement,
        },
      ]}>
      <View style={[styles.badge, { backgroundColor: tint }]}>
        <ThemedText type="smallBold" style={styles.badgeText}>
          {number}
        </ThemedText>
      </View>
      <View style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {station.name}
        </ThemedText>
        <ThemedText type="small" style={{ color: tint }}>
          {formatDistance(station.distance_km)} away
          {nearest ? ' · nearest' : ''}
        </ThemedText>
        {details.length > 0 && (
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
            {details.join(' · ')}
          </ThemedText>
        )}
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Directions to ${station.name}`}
        onPress={() =>
          Linking.openURL(
            directionsUrl(from, station.latitude, station.longitude),
          )
        }
        style={({ hovered }) => [
          styles.directions,
          { borderColor: colors.border },
          hovered && { backgroundColor: colors.backgroundSelected },
        ]}>
        <MaterialCommunityIcons name="directions" size={20} color={tint} />
      </Pressable>
    </View>
  );
}

function mapPoints(
  from: CurrentPosition,
  stations: NearestStation[],
  kind: StationKind,
): MapPoint[] {
  return [
    {
      label: 'You are here',
      latitude: from.latitude,
      longitude: from.longitude,
      kind: 'current',
    },
    ...stations.map((station, index): MapPoint => ({
      label: station.name,
      permanentLabel: `${index + 1} · ${formatDistance(station.distance_km)}`,
      latitude: station.latitude,
      longitude: station.longitude,
      kind: kind === 'charging' ? 'charge' : 'fuel',
    })),
  ];
}

// Opens Google Maps (app or web) with driving directions.
export function directionsUrl(
  from: CurrentPosition,
  latitude: number,
  longitude: number,
) {
  return (
    'https://www.google.com/maps/dir/?api=1&travelmode=driving' +
    `&origin=${from.latitude},${from.longitude}&destination=${latitude},${longitude}`
  );
}

export function formatDistance(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },

  contentWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  map: {
    borderRadius: 14,
    overflow: 'hidden',
  },

  mapWide: {
    flex: 1.5,
  },

  list: {
    gap: Spacing.two,
  },

  listWide: {
    flex: 1,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
  },

  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeText: {
    color: '#FFFFFF',
  },

  rowText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },

  directions: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  status: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },

  statusText: {
    textAlign: 'center',
    maxWidth: 420,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 10,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },

  buttonText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },
});
