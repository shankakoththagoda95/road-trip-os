import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { errorMessage } from '@/api/client';
import { geocode, previewRoute, type GeocodeResult } from '@/api/routes';
import { inputStyle } from '@/components/form/form-field';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { RouteMap } from '@/components/route-map/route-map';
import {
  type MapPoint,
  type MapPointKind,
  MarkerColors,
} from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type RoutePlace, useTripDraft } from '@/hooks/use-trip-draft';
import {
  buildPreviewRequest,
  currentRoutePreview,
  placeMatches,
  previewKey,
} from '@/utils/route-draft';
import { formatDistance, formatDuration } from '@/utils/units';

type Failure = { key: string; message: string };

function toPlace(location: string, result: GeocodeResult): RoutePlace {
  return {
    location,
    displayName: result.display_name,
    latitude: result.latitude,
    longitude: result.longitude,
  };
}

export default function RouteStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, updateRoute, completeStep } = useTripDraft();
  const { details, route } = draft;

  // Retrying bumps this so the effects below run again.
  const [attempt, setAttempt] = useState(0);

  // --- 1. Geocode start and destination (one at a time: the geocoder
  //        allows about one request per second). ---
  const startText = details.startLocation.trim();
  const destinationText = details.destination.trim();

  const pendingField = !placeMatches(route.start, startText)
    ? 'start'
    : !placeMatches(route.destination, destinationText)
      ? 'destination'
      : null;
  const pendingText = pendingField === 'start' ? startText : destinationText;
  const lookupKey = `${pendingField}:${pendingText}:${attempt}`;

  const [lookupFailure, setLookupFailure] = useState<Failure | null>(null);
  const lookupError =
    lookupFailure?.key === lookupKey ? lookupFailure.message : null;

  useEffect(() => {
    if (!pendingField || !pendingText) {
      return;
    }

    let cancelled = false;

    geocode(pendingText)
      .then((result) => {
        if (!cancelled) {
          updateRoute({ [pendingField]: toPlace(pendingText, result) });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLookupFailure({ key: lookupKey, message: errorMessage(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pendingField, pendingText, lookupKey, updateRoute]);

  // --- 2. Calculate the route once every place has coordinates. ---
  const request = buildPreviewRequest(draft);
  const requestKey = request ? previewKey(request) : null;
  const preview = currentRoutePreview(draft);
  const hasPreview = preview !== null;

  const [previewFailure, setPreviewFailure] = useState<Failure | null>(null);
  const previewErrorKey = `${requestKey}:${attempt}`;
  const previewError =
    previewFailure?.key === previewErrorKey ? previewFailure.message : null;

  useEffect(() => {
    if (!requestKey || hasPreview) {
      return;
    }

    let cancelled = false;

    previewRoute(JSON.parse(requestKey))
      .then((data) => {
        if (!cancelled) {
          updateRoute({ preview: { key: requestKey, data } });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPreviewFailure({
            key: previewErrorKey,
            message: errorMessage(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestKey, hasPreview, previewErrorKey, updateRoute]);

  const error = lookupError ?? previewError;
  const calculating = !error && !hasPreview;

  // --- Stops ---
  function moveStop(index: number, offset: -1 | 1) {
    const stops = [...route.stops];
    const [stop] = stops.splice(index, 1);
    stops.splice(index + offset, 0, stop);
    updateRoute({ stops });
  }

  function removeStop(index: number) {
    updateRoute({ stops: route.stops.filter((_, i) => i !== index) });
  }

  function addStop(stop: RoutePlace) {
    updateRoute({ stops: [...route.stops, stop] });
  }

  function handleContinue() {
    completeStep('route');

    const { next } = getTripStep('route');
    router.navigate(next?.href ?? '/trips/new');
  }

  if (!startText || !destinationText) {
    return (
      <WizardStepScreen
        stepId="route"
        onContinue={handleContinue}
        continueDisabled>
        <ThemedText type="smallBold">Start and destination are missing</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Add where your trip starts and ends in Trip Details first.
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.navigate('/trips/new/details')}>
          <ThemedText type="linkPrimary">Go to Trip Details →</ThemedText>
        </Pressable>
      </WizardStepScreen>
    );
  }

  // --- Map ---
  const mapPoints: MapPoint[] = [];

  if (placeMatches(route.start, startText)) {
    mapPoints.push(toMapPoint(route.start!, 'start'));
  }

  mapPoints.push(...route.stops.map((stop) => toMapPoint(stop, 'stop')));

  if (placeMatches(route.destination, destinationText)) {
    mapPoints.push(toMapPoint(route.destination!, 'destination'));
  }

  return (
    <WizardStepScreen
      stepId="route"
      onContinue={handleContinue}
      continueDisabled={request === null}>
      <RouteMap points={mapPoints} line={preview?.geometry.coordinates} />

      <View style={styles.legend}>
        <LegendItem kind="start" label="Start" />
        <LegendItem kind="stop" label="Stops" />
        <LegendItem kind="destination" label="Destination" />
      </View>

      <View style={styles.stats}>
        <StatTile
          label="Distance"
          value={preview ? formatDistance(preview.distance_meters) : '—'}
        />
        <StatTile
          label="Driving time"
          value={preview ? formatDuration(preview.duration_seconds) : '—'}
        />
        <StatTile label="Stops" value={String(route.stops.length)} />
      </View>

      {calculating && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            {pendingField ? `Finding ${pendingText}…` : 'Calculating route…'}
          </ThemedText>
        </View>
      )}

      {error && (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.errorBox}>
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
          <View style={styles.errorActions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setAttempt((value) => value + 1)}>
              <ThemedText type="linkPrimary">Try again</ThemedText>
            </Pressable>
            {lookupError && (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate('/trips/new/details')}>
                <ThemedText type="linkPrimary">Edit Trip Details</ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>
      )}

      <View style={styles.places}>
        <PlaceRow
          kind="start"
          title={startText}
          subtitle={
            placeMatches(route.start, startText)
              ? route.start!.displayName
              : undefined
          }
        />

        {route.stops.map((stop, index) => (
          <PlaceRow
            key={`${stop.location}-${index}`}
            kind="stop"
            number={index + 1}
            title={stop.location}
            subtitle={stop.displayName}
            onMoveUp={index > 0 ? () => moveStop(index, -1) : undefined}
            onMoveDown={
              index < route.stops.length - 1
                ? () => moveStop(index, 1)
                : undefined
            }
            onRemove={() => removeStop(index)}
          />
        ))}

        <PlaceRow
          kind="destination"
          title={destinationText}
          subtitle={
            placeMatches(route.destination, destinationText)
              ? route.destination!.displayName
              : undefined
          }
        />

        {details.tripType === 'round_trip' && (
          <ThemedText type="small" themeColor="textSecondary">
            ⇄ Round trip: the route returns to {startText} at the end.
          </ThemedText>
        )}
      </View>

      <AddStopForm onAdd={addStop} />

      {preview && preview.legs.length > 0 && (
        <View style={styles.legs}>
          <ThemedText type="smallBold">Legs</ThemedText>
          {preview.legs.map((leg, index) => (
            <View key={index} style={styles.leg}>
              <ThemedText type="small" style={styles.legRoute}>
                {leg.from_location} → {leg.to_location}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDistance(leg.distance_meters)} ·{' '}
                {formatDuration(leg.duration_seconds)}
              </ThemedText>
            </View>
          ))}
        </View>
      )}
    </WizardStepScreen>
  );
}

function toMapPoint(place: RoutePlace, kind: MapPointKind): MapPoint {
  return {
    label: place.location,
    latitude: place.latitude,
    longitude: place.longitude,
    kind,
  };
}

function AddStopForm({ onAdd }: { onAdd: (stop: RoutePlace) => void }) {
  const colors = useTheme();
  const [text, setText] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = text.trim();

  async function handleAdd() {
    if (!query || adding) {
      return;
    }

    setAdding(true);
    setError(null);

    try {
      onAdd(toPlace(query, await geocode(query)));
      setText('');
    } catch (addError) {
      setError(errorMessage(addError));
    } finally {
      setAdding(false);
    }
  }

  return (
    <View style={styles.addStop}>
      <ThemedText type="smallBold">Add a stop</ThemedText>

      <View style={styles.addStopRow}>
        <TextInput
          accessibilityLabel="Stop location"
          placeholder="e.g. Karlstad"
          placeholderTextColor={colors.textSecondary}
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
          }}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          style={[inputStyle(colors, Boolean(error)), styles.addStopInput]}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add stop"
          accessibilityState={{ disabled: !query || adding, busy: adding }}
          disabled={!query || adding}
          onPress={handleAdd}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
            !query && styles.disabled,
          ]}>
          {adding ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <ThemedText style={styles.addButtonText}>Add</ThemedText>
          )}
        </Pressable>
      </View>

      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

function PlaceRow({
  kind,
  number,
  title,
  subtitle,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  kind: MapPointKind;
  number?: number;
  title: string;
  subtitle?: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}) {
  const colors = useTheme();

  return (
    <View style={[styles.placeRow, { borderColor: colors.border }]}>
      <View style={[styles.dot, { backgroundColor: MarkerColors[kind] }]}>
        {number !== undefined && (
          <ThemedText style={styles.dotText}>{number}</ThemedText>
        )}
      </View>

      <View style={styles.placeText}>
        <ThemedText type="smallBold">{title}</ThemedText>
        {subtitle ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {onRemove && (
        <View style={styles.placeActions}>
          <IconButton
            label={`Move ${title} up`}
            symbol="↑"
            onPress={onMoveUp}
          />
          <IconButton
            label={`Move ${title} down`}
            symbol="↓"
            onPress={onMoveDown}
          />
          <IconButton label={`Remove ${title}`} symbol="✕" onPress={onRemove} />
        </View>
      )}
    </View>
  );
}

function IconButton({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: string;
  onPress?: () => void;
}) {
  const colors = useTheme();
  const disabled = !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: colors.backgroundSelected },
        pressed && styles.pressed,
        disabled && styles.inactive,
      ]}>
      <ThemedText type="smallBold">{symbol}</ThemedText>
    </Pressable>
  );
}

function LegendItem({ kind, label }: { kind: MapPointKind; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[styles.legendDot, { backgroundColor: MarkerColors[kind] }]}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundSelected" style={styles.statTile}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  statTile: {
    flexGrow: 1,
    flexBasis: 120,
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.half,
  },

  statValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
  },

  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  errorBox: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },

  errorActions: {
    flexDirection: 'row',
    gap: Spacing.four,
  },

  places: {
    gap: Spacing.two,
  },

  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  dotText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },

  placeText: {
    flex: 1,
    minWidth: 0,
  },

  placeActions: {
    flexDirection: 'row',
    gap: Spacing.one,
  },

  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addStop: {
    gap: Spacing.one,
  },

  addStopRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  addStopInput: {
    flex: 1,
    minWidth: 0,
  },

  addButton: {
    height: 52,
    minWidth: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  legs: {
    gap: Spacing.two,
  },

  leg: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: Spacing.three,
  },

  legRoute: {
    flexShrink: 1,
  },

  pressed: {
    opacity: 0.75,
  },

  disabled: {
    opacity: 0.5,
  },

  inactive: {
    opacity: 0.25,
  },
});
