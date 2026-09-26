import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import type { StationKind } from '@/api/stations';
import { listVehicles } from '@/api/vehicles';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import {
  searchSummary,
  StationSearchBody,
} from '@/components/trip-overview/stations-dialog';
import { StationKindInfo } from '@/constants/stations';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useCurrentLocation } from '@/hooks/use-current-location';
import { useStationSearch } from '@/hooks/use-station-search';
import { useTheme } from '@/hooks/use-theme';

const bannerImage = require('@/assets/images/brand/fueling-banner.jpg');

// Remembers Fuel / Charging in this browser.
const KindStorageKey = 'road-trip-os.station-kind';

// Width from which the map and the list sit side by side.
const SideBySide = 900;

/**
 * Find the nearest fuel station or charger around you, whatever the trip.
 */
export default function StationsScreen() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const { state: location, start: shareLocation } = useCurrentLocation();
  const position = location.status === 'tracking' ? location.position : null;

  // The last choice, or Charging when every vehicle is electric.
  const [chosen, setChosen] = useState<StationKind | null>(readStoredKind);
  const [vehiclesState] = useAsync(() => listVehicles(), []);
  const allElectric =
    vehiclesState.status === 'success' &&
    vehiclesState.data.length > 0 &&
    vehiclesState.data.every((vehicle) => vehicle.fuel_type === 'electric');
  const kind: StationKind = chosen ?? (allElectric ? 'charging' : 'fuel');
  const info = StationKindInfo[kind];

  const { search, find, reset } = useStationSearch({ position, shareLocation });
  const busy = search.status === 'searching' || search.status === 'waiting';

  function switchKind(next: StationKind) {
    if (next === kind) return;

    setChosen(next);
    storeKind(next);

    // After a search, look for the other kind straight away.
    if (search.status !== 'idle' && position) {
      find(next);
    } else {
      reset();
    }
  }

  return (
    <Screen maxWidth={1200}>
      <ImageBackground
        source={bannerImage}
        resizeMode="cover"
        style={styles.hero}
        imageStyle={styles.heroPhoto}>
        <View style={styles.heroShade} />

        <View style={styles.heroText}>
          <ThemedText type="title" style={styles.title}>
            Find me{' '}
            <ThemedText
              type="title"
              style={[styles.title, { color: info.tint }]}>
              {kind === 'fuel' ? 'fuel' : 'charging'}
            </ThemedText>
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            The nearest {info.noun} around you. The search starts 1 km around
            you and grows 1 km at a time until it finds one.
          </ThemedText>
        </View>

        <View style={styles.controls}>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="What to look for"
            style={styles.toggle}>
            {(['fuel', 'charging'] as const).map((option) => {
              const selected = option === kind;
              const optionInfo = StationKindInfo[option];

              return (
                <Pressable
                  key={option}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => switchKind(option)}
                  style={({ hovered }) => [
                    styles.toggleOption,
                    selected && { backgroundColor: optionInfo.tint },
                    hovered && !selected && styles.toggleHover,
                  ]}>
                  <MaterialCommunityIcons
                    name={optionInfo.icon}
                    size={20}
                    color="#FFFFFF"
                  />
                  <ThemedText type="smallBold" style={styles.toggleText}>
                    {optionInfo.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => find(kind)}
            style={({ hovered, pressed }) => [
              styles.findButton,
              { backgroundColor: info.tint },
              (hovered || pressed) && styles.pressed,
              busy && styles.busy,
            ]}>
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <MaterialCommunityIcons
                name="crosshairs-gps"
                size={20}
                color="#FFFFFF"
              />
            )}
            <ThemedText type="smallBold" style={styles.findText}>
              {search.status === 'done' || search.status === 'error'
                ? 'Search again'
                : info.button}
            </ThemedText>
          </Pressable>
        </View>
      </ImageBackground>

      <View
        style={[
          styles.results,
          {
            borderColor: colors.border,
            backgroundColor: colors.backgroundElement,
          },
        ]}>
        <View style={styles.resultsHeader}>
          <View
            style={[styles.resultsIcon, { backgroundColor: `${info.tint}2E` }]}>
            <MaterialCommunityIcons
              name={info.icon}
              size={22}
              color={info.tint}
            />
          </View>
          <View style={styles.resultsText}>
            <ThemedText type="smallBold" style={styles.resultsTitle}>
              Nearest {info.noun}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {searchSummary(search)}
            </ThemedText>
          </View>
        </View>

        <StationSearchBody
          search={search}
          kind={kind}
          tint={info.tint}
          locationDenied={location.status === 'denied'}
          onRetry={() => find(kind)}
          sideBySide={width >= SideBySide}
          mapHeight={440}
          idleText={
            position
              ? `Press "${info.button}" to see the nearest ones on a map.`
              : `Press "${info.button}". Your browser will ask to share your location; it's only used for this search.`
          }
        />
      </View>
    </Screen>
  );
}

function readStoredKind(): StationKind | null {
  try {
    const value = localStorage.getItem(KindStorageKey);
    return value === 'fuel' || value === 'charging' ? value : null;
  } catch {
    return null;
  }
}

function storeKind(kind: StationKind) {
  try {
    localStorage.setItem(KindStorageKey, kind);
  } catch {
    // Storage unavailable: the choice lasts until the page closes.
  }
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 240,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: Spacing.four,
    padding: Spacing.four,
  },

  heroPhoto: {
    width: '100%',
    height: '100%',
  },

  heroShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 12, 25, 0.55)',
  },

  heroText: {
    gap: Spacing.two,
    maxWidth: 620,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
  },

  subtitle: {
    color: '#E2E8F0',
  },

  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },

  toggle: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: Spacing.one,
    backgroundColor: 'rgba(3, 12, 25, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },

  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
  },

  toggleHover: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },

  toggleText: {
    color: '#FFFFFF',
    fontSize: 15,
  },

  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },

  findText: {
    color: '#FFFFFF',
    fontSize: 15,
  },

  pressed: {
    opacity: 0.88,
  },

  busy: {
    opacity: 0.75,
  },

  results: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },

  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  resultsIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  resultsText: {
    flex: 1,
  },

  resultsTitle: {
    fontSize: 18,
  },
});
