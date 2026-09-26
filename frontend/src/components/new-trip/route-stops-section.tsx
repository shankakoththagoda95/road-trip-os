import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import type { RouteLeg } from '@/api/routes';
import type { TripType } from '@/api/trips';
import { inputStyle, withoutSidePadding } from '@/components/form/form-field';
import { ModalDialog } from '@/components/modal-dialog';
import { PlaceCard, PlaceCardWidth } from '@/components/new-trip/place-card';
import { MaxStops } from '@/components/new-trip/stops-list';
import { RouteMap } from '@/components/route-map/route-map';
import type { MapPoint } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { lookupPlaceCached } from '@/hooks/use-place-lookup';
import { useTheme } from '@/hooks/use-theme';
import type { RoutePlace } from '@/hooks/use-trip-draft';
import { placeKey } from '@/utils/place-key';
import { formatDistance, formatDuration } from '@/utils/units';

type RouteStopsSectionProps = {
  startLocation: string;
  stops: string[];
  tripType: TripType;
  places: Record<string, RoutePlace>;
  onChangeStart: (start: string) => void;
  onChangeStops: (stops: string[]) => void;
  rememberPlace: (place: RoutePlace) => void;
  startError?: string;
  stopsError?: string;
  // Calculated legs in route order (start → stop 1, …, and back to the
  // start on a round trip); shown between the cards.
  legs?: RouteLeg[];
  // Hide where the page already shows a map.
  showMapButton?: boolean;
  // Nights at each stop (keyed by placeKey); steppers show when given.
  stayNights?: Record<string, number>;
  onChangeStayNights?: (stayNights: Record<string, number>) => void;
};

/**
 * The route as photo cards (start first, then the stops in order) with a
 * place search to add more.
 */
export function RouteStopsSection({
  startLocation,
  stops,
  tripType,
  places,
  onChangeStart,
  onChangeStops,
  rememberPlace,
  startError,
  stopsError,
  legs,
  showMapButton = true,
  stayNights,
  onChangeStayNights,
}: RouteStopsSectionProps) {
  const colors = useTheme();
  const searchRef = useRef<TextInput>(null);

  const start = startLocation.trim();
  const named = stops.map((stop) => stop.trim()).filter(Boolean);
  const roundTrip = tripType === 'round_trip';
  const known = (text: string) => places[placeKey(text)] ?? null;

  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  // Without a start, the search sets it first.
  const settingStart = !start;
  const full = named.length >= MaxStops;

  function setStops(next: string[]) {
    onChangeStops(next.length > 0 ? next : ['']);
  }

  function move(index: number, offset: -1 | 1) {
    const next = [...named];
    const [stop] = next.splice(index, 1);
    next.splice(index + offset, 0, stop);
    setStops(next);
  }

  function add(text: string) {
    if (settingStart) {
      onChangeStart(text);
    } else {
      setStops([...named, text]);
    }
    setSearch('');
  }

  async function handleAdd() {
    const query = search.trim();

    if (!query || adding || (full && !settingStart)) {
      return;
    }

    setAdding(true);
    setSearchError(null);

    try {
      const found = await lookupPlaceCached(query);

      if (!found) {
        setSearchError(`Couldn't find “${query}”. Try a town or city name.`);
        return;
      }

      rememberPlace({
        location: found.name,
        displayName: found.address || found.name,
        latitude: found.latitude,
        longitude: found.longitude,
      });
      add(found.name);
    } catch {
      // Place search unavailable: add it as typed; the Route step looks it up.
      add(query);
    } finally {
      setAdding(false);
    }
  }

  // Map pins for every place with known coordinates.
  const mapPoints: MapPoint[] = [
    ...(start && known(start) ? [pointFor(known(start)!, 'start')] : []),
    ...named.flatMap((text, index) => {
      const place = known(text);
      const kind =
        !roundTrip && index === named.length - 1 ? 'destination' : 'stop';
      return place ? [pointFor(place, kind)] : [];
    }),
  ];

  const locations = named.length + (start ? 1 : 0);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={[styles.icon, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
          <Ionicons name="navigate" size={20} color="#2563EB" />
        </View>
        <View style={styles.headerText}>
          <ThemedText type="smallBold" style={styles.heading}>
            Route & Stops
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {named.length} {named.length === 1 ? 'stop' : 'stops'} •{' '}
            {locations} {locations === 1 ? 'location' : 'locations'}
          </ThemedText>
        </View>
        {showMapButton && (
        <Pressable
          accessibilityRole="button"
          disabled={mapPoints.length === 0}
          onPress={() => setMapOpen(true)}
          style={({ hovered }) => [
            styles.mapButton,
            { borderColor: colors.border },
            hovered && { backgroundColor: colors.backgroundSelected },
            mapPoints.length === 0 && styles.disabled,
          ]}>
          <Ionicons name="map-outline" size={16} color={colors.primary} />
          <ThemedText type="smallBold" style={{ color: colors.primary }}>
            View on map
          </ThemedText>
        </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.cards}>
        {start ? (
          <PlaceCard
            text={start}
            badge="S"
            kind="start"
            known={known(start)}
            onFound={rememberPlace}
            onRemove={() => onChangeStart('')}
          />
        ) : (
          <AddCard
            label="Set starting point"
            error={Boolean(startError)}
            onPress={() => searchRef.current?.focus()}
          />
        )}

        {named.map((text, index) => (
          <Fragment key={`${placeKey(text)}-${index}`}>
            <Arrow leg={legs?.[index]} />
            <PlaceCard
              text={text}
              badge={String(index + 1)}
              kind={
                !roundTrip && index === named.length - 1 ? 'destination' : 'stop'
              }
              known={known(text)}
              onFound={rememberPlace}
              onRemove={() => setStops(named.filter((_, i) => i !== index))}
              onMoveLeft={index > 0 ? () => move(index, -1) : undefined}
              onMoveRight={
                index < named.length - 1 ? () => move(index, 1) : undefined
              }
              nights={stayNights?.[placeKey(text)] ?? 0}
              onNightsChange={
                stayNights && onChangeStayNights
                  ? (nights) =>
                      onChangeStayNights({ ...stayNights, [placeKey(text)]: nights })
                  : undefined
              }
            />
          </Fragment>
        ))}

        {!full && Boolean(start) && (
          <>
            <Arrow />
            <AddCard
              label="Add stop"
              error={Boolean(stopsError)}
              onPress={() => searchRef.current?.focus()}
            />
          </>
        )}

        {roundTrip && Boolean(start) && named.length > 0 && (
          <>
            <Arrow leg={legs?.[named.length]} />
            <View
              style={[
                styles.returnCard,
                { borderColor: colors.border, backgroundColor: colors.backgroundSelected },
              ]}>
              <Ionicons name="sync" size={26} color={colors.success} />
              <ThemedText type="smallBold" style={styles.center}>
                Back to
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                numberOfLines={2}
                style={styles.center}>
                {start}
              </ThemedText>
            </View>
          </>
        )}
      </ScrollView>

      {(startError || stopsError) && (
        <ThemedText type="small" themeColor="danger">
          {startError ?? stopsError}
        </ThemedText>
      )}

      <View
        style={[
          styles.searchBox,
          { borderColor: colors.border, backgroundColor: colors.backgroundSelected },
        ]}>
        <ThemedText type="smallBold">
          {settingStart ? 'Where does your trip start?' : 'Add more places'}
        </ThemedText>
        <View style={styles.searchRow}>
          <View style={styles.searchField}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              ref={searchRef}
              value={search}
              onChangeText={(text) => {
                setSearch(text);
                setSearchError(null);
              }}
              onSubmitEditing={handleAdd}
              editable={!full || settingStart}
              placeholder={
                full && !settingStart
                  ? `Up to ${MaxStops} stops`
                  : settingStart
                    ? 'e.g. Stockholm'
                    : 'Search a city, town or landmark'
              }
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={settingStart ? 'Starting point' : 'Add a stop'}
              returnKeyType="done"
              style={[
                withoutSidePadding(inputStyle(colors, Boolean(searchError))),
                styles.searchInput,
              ]}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={!search.trim() || adding}
            onPress={handleAdd}
            style={({ hovered, pressed }) => [
              styles.addButton,
              { backgroundColor: colors.primary },
              (hovered || pressed) && styles.pressed,
              (!search.trim() || adding) && styles.disabled,
            ]}>
            {adding ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <ThemedText type="smallBold" style={styles.addText}>
                  {settingStart ? 'Set start' : 'Add'}
                </ThemedText>
              </>
            )}
          </Pressable>
        </View>
        {searchError && (
          <ThemedText type="small" themeColor="danger">
            {searchError}
          </ThemedText>
        )}
      </View>

      <ModalDialog
        visible={mapOpen}
        title="Your route"
        subtitle="Places found so far. The Route step draws the roads."
        onClose={() => setMapOpen(false)}>
        <RouteMap points={mapPoints} height={420} />
      </ModalDialog>
    </View>
  );
}

function pointFor(place: RoutePlace, kind: MapPoint['kind']): MapPoint {
  return {
    label: place.location,
    latitude: place.latitude,
    longitude: place.longitude,
    kind,
  };
}

// Arrow between two cards, with the leg's distance and time when known.
function Arrow({ leg }: { leg?: RouteLeg }) {
  const colors = useTheme();

  if (!leg) {
    return (
      <View style={styles.arrow}>
        <Ionicons name="arrow-forward" size={18} color={colors.textSecondary} />
      </View>
    );
  }

  return (
    <View
      style={[styles.arrow, styles.legArrow]}
      accessibilityLabel={`${formatDistance(leg.distance_meters)}, ${formatDuration(leg.duration_seconds)} from ${leg.from_location} to ${leg.to_location}`}>
      <ThemedText type="smallBold" style={[styles.legText, { color: colors.primary }]}>
        {formatDistance(leg.distance_meters)}
      </ThemedText>
      <View style={styles.legLine}>
        <View style={[styles.legRule, { backgroundColor: colors.primary }]} />
        <Ionicons name="caret-forward" size={14} color={colors.primary} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.legText}>
        {formatDuration(leg.duration_seconds)}
      </ThemedText>
    </View>
  );
}

function AddCard({
  label,
  error,
  onPress,
}: {
  label: string;
  error: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ hovered }) => [
        styles.addCard,
        { borderColor: error ? colors.danger : colors.primary },
        hovered && { backgroundColor: colors.backgroundSelected },
      ]}>
      <View style={[styles.addCircle, { backgroundColor: colors.primary }]}>
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </View>
      <ThemedText type="smallBold" style={{ color: colors.primary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: Spacing.three,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerText: {
    flex: 1,
  },

  heading: {
    fontSize: 17,
  },

  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  cards: {
    alignItems: 'stretch',
    paddingBottom: Spacing.two,
  },

  arrow: {
    width: 32,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },

  legArrow: {
    width: 96,
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
  },

  legText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },

  legLine: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },

  legRule: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginRight: -4,
  },

  addCard: {
    width: PlaceCardWidth,
    minHeight: 200,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },

  addCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  returnCard: {
    width: 120,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    padding: Spacing.two,
  },

  center: {
    textAlign: 'center',
  },

  searchBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  searchRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  searchField: {
    flex: 1,
    justifyContent: 'center',
  },

  searchIcon: {
    position: 'absolute',
    left: Spacing.three,
    zIndex: 1,
  },

  searchInput: {
    paddingLeft: Spacing.five + Spacing.two,
    paddingRight: Spacing.three,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    minWidth: 110,
  },

  addText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },

  disabled: {
    opacity: 0.5,
  },
});
