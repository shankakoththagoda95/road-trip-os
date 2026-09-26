import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import type { NearestStations, StationKind } from '@/api/stations';
import type { Vehicle } from '@/api/vehicles';
import { ThemedText } from '@/components/themed-text';
import {
  directionsUrl,
  formatDistance,
  StationsDialog,
} from '@/components/trip-overview/stations-dialog';
import { StationKindInfo } from '@/constants/stations';
import { Spacing } from '@/constants/theme';
import type {
  CurrentPosition,
  LocationState,
} from '@/hooks/use-current-location';
import { useStationSearch } from '@/hooks/use-station-search';
import { useTheme } from '@/hooks/use-theme';

/**
 * Finds the nearest fuel station or charger for the trip's vehicle (the
 * search radius grows 1 km at a time until one is found).
 */
export function StationFinder({
  vehicle,
  position,
  locationStatus,
  onShareLocation,
  onFound,
}: {
  vehicle: Vehicle | null;
  position: CurrentPosition | null;
  locationStatus: LocationState['status'];
  onShareLocation: () => void;
  // Stations to show on the map (empty to clear).
  onFound: (result: NearestStations | null) => void;
}) {
  const colors = useTheme();
  // Plug-in hybrids (and trips without a vehicle) can use either.
  const choosable = !vehicle || vehicle.fuel_type === 'plug_in_hybrid';
  const [chosen, setChosen] = useState<StationKind>('fuel');
  const kind: StationKind =
    vehicle?.fuel_type === 'electric'
      ? 'charging'
      : choosable
        ? chosen
        : 'fuel';
  const info = StationKindInfo[kind];

  const {
    search,
    find: startSearch,
    reset,
  } = useStationSearch({
    position,
    shareLocation: onShareLocation,
    onFound,
  });
  // The popup opens as soon as a search starts.
  const [open, setOpen] = useState(false);

  function find() {
    setOpen(true);
    startSearch(kind);
  }

  function switchKind(next: StationKind) {
    setChosen(next);
    reset();
  }

  const nearest = search.status === 'done' ? search.result.stations[0] : null;
  const busy = search.status === 'searching' || search.status === 'waiting';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: `${info.tint}2E` }]}>
          <MaterialCommunityIcons
            name={info.icon}
            size={24}
            color={info.tint}
          />
        </View>
        <View style={styles.headerText}>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            Nearest {kind === 'fuel' ? 'fuel station' : 'charger'}
          </ThemedText>
          {choosable && (
            <View style={[styles.switch, { borderColor: colors.border }]}>
              {(['fuel', 'charging'] as const).map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: option === kind }}
                  onPress={() => switchKind(option)}
                  style={[
                    styles.switchOption,
                    option === kind && {
                      backgroundColor: StationKindInfo[option].tint,
                    },
                  ]}>
                  <ThemedText
                    type="small"
                    style={[
                      styles.switchText,
                      {
                        color:
                          option === kind ? '#FFFFFF' : colors.textSecondary,
                      },
                    ]}>
                    {option === 'fuel' ? 'Fuel' : 'Charging'}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {search.status === 'done' && nearest ? (
        <View style={styles.result}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {nearest.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {formatDistance(nearest.distance_km)} away
            {nearest.power_kw ? ` · ${Math.round(nearest.power_kw)} kW` : ''}
            {search.result.stations.length > 1
              ? ` · ${search.result.stations.length - 1} more within ${search.result.radius_km} km`
              : ` · within ${search.result.radius_km} km`}
          </ThemedText>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="link"
              onPress={() =>
                Linking.openURL(
                  directionsUrl(
                    search.from,
                    nearest.latitude,
                    nearest.longitude,
                  ),
                )
              }
              style={({ hovered, pressed }) => [
                styles.button,
                { backgroundColor: info.tint },
                (hovered || pressed) && styles.pressed,
              ]}>
              <MaterialCommunityIcons
                name="directions"
                size={16}
                color="#FFFFFF"
              />
              <ThemedText type="smallBold" style={styles.buttonText}>
                Directions
              </ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Show stations on a map"
              onPress={() => setOpen(true)}
              style={({ hovered }) => [
                styles.iconButton,
                { borderColor: colors.border },
                hovered && { backgroundColor: colors.backgroundSelected },
              ]}>
              <MaterialCommunityIcons
                name="map-search-outline"
                size={16}
                color={colors.text}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search again"
              onPress={find}
              style={({ hovered }) => [
                styles.iconButton,
                { borderColor: colors.border },
                hovered && { backgroundColor: colors.backgroundSelected },
              ]}>
              <MaterialCommunityIcons
                name="refresh"
                size={16}
                color={colors.text}
              />
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.result}>
          <ThemedText type="small" themeColor="textSecondary">
            {search.status === 'waiting' && !position
              ? locationStatus === 'denied'
                ? 'Allow location access to search near you.'
                : 'Finding your location…'
              : busy
                ? `Searching for ${info.noun}, 1 km at a time…`
                : search.status === 'error'
                  ? search.message
                  : search.status === 'done'
                    ? `No ${info.noun} within ${search.result.searched_up_to_km} km.`
                    : 'Searches around you, 1 km wider each step.'}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={find}
            style={({ hovered, pressed }) => [
              styles.button,
              { backgroundColor: info.tint },
              (hovered || pressed) && styles.pressed,
              busy && styles.disabled,
            ]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={16}
                color="#FFFFFF"
              />
            )}
            <ThemedText
              type="smallBold"
              style={styles.buttonText}
              numberOfLines={1}>
              {search.status === 'error' || search.status === 'done'
                ? 'Try again'
                : info.button}
            </ThemedText>
          </Pressable>
        </View>
      )}

      <StationsDialog
        visible={open}
        onClose={() => setOpen(false)}
        kind={kind}
        tint={info.tint}
        search={search}
        locationDenied={locationStatus === 'denied'}
        onRetry={find}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: Spacing.two,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },

  switch: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
  },

  switchOption: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
  },

  switchText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  result: {
    gap: Spacing.one,
  },

  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.half,
  },

  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    maxWidth: '100%',
  },

  buttonText: {
    color: '#FFFFFF',
  },

  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pressed: {
    opacity: 0.88,
  },

  disabled: {
    opacity: 0.7,
  },
});
