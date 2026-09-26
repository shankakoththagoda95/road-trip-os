import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { errorMessage } from '@/api/client';
import { geocode, previewRoute } from '@/api/routes';
import { RouteStopsSection } from '@/components/new-trip/route-stops-section';
import { toPlace } from '@/components/new-trip/stop-editor';
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
  nextPlaceToFind,
  placeFor,
  previewKey,
  routeParts,
} from '@/utils/route-draft';
import { formatDistance, formatDuration } from '@/utils/units';

type Failure = { key: string; message: string };

export default function RouteStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, updateDetails, updateRoute, rememberPlace, completeStep } =
    useTripDraft();
  const { details } = draft;
  const { start, stops, destination } = routeParts(details);
  const roundTrip = details.tripType === 'round_trip';

  // Retrying bumps this so the effects below run again.
  const [attempt, setAttempt] = useState(0);

  // --- 1. Look up the start and each stop, one at a time (the geocoder
  //        allows about one request per second). ---
  const pendingText = nextPlaceToFind(draft);
  const lookupKey = `${pendingText}:${attempt}`;

  const [lookupFailure, setLookupFailure] = useState<Failure | null>(null);
  const lookupError =
    lookupFailure?.key === lookupKey ? lookupFailure.message : null;

  useEffect(() => {
    if (!pendingText) {
      return;
    }

    let cancelled = false;

    geocode(pendingText)
      .then((result) => {
        if (!cancelled) {
          rememberPlace(toPlace(pendingText, result));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLookupFailure({
            key: lookupKey,
            message: `Couldn't find “${pendingText}”: ${errorMessage(error)}`,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pendingText, lookupKey, rememberPlace]);

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

  function handleContinue() {
    completeStep('route');

    const { next } = getTripStep('route');
    router.navigate(next?.href ?? '/trips/new');
  }

  // One-way trips end at the last stop (red); round trips return to the
  // start, so every stop is a regular (blue) stop.
  const stopKind = (index: number): MapPointKind =>
    !roundTrip && index === stops.length - 1 ? 'destination' : 'stop';

  // --- Map ---
  const startPlace = placeFor(draft, start);
  const mapPoints: MapPoint[] = [
    ...(startPlace ? [toMapPoint(startPlace, 'start')] : []),
    ...stops.flatMap((text, index) => {
      const place = placeFor(draft, text);
      return place ? [toMapPoint(place, stopKind(index))] : [];
    }),
  ];

  const ready = Boolean(start && destination);

  return (
    <WizardStepScreen
      stepId="route"
      onContinue={handleContinue}
      continueDisabled={request === null}
      summary={<RouteTotals preview={preview} ready={ready} />}>
      {ready ? (
        <RouteMap points={mapPoints} line={preview?.geometry.coordinates} />
      ) : (
        <ThemedView type="backgroundSelected" style={styles.errorBox}>
          <ThemedText type="smallBold">
            Starting point and stops are missing
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Add where your trip starts and at least one stop below.
          </ThemedText>
        </ThemedView>
      )}

      <View style={styles.legend}>
        <LegendItem
          kind="start"
          label={roundTrip ? 'Start & finish' : 'Start'}
        />
        <LegendItem kind="stop" label="Stops" />
        {!roundTrip && <LegendItem kind="destination" label="Final stop" />}
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
        <StatTile label="Stops" value={String(stops.length)} />
      </View>

      {ready && calculating && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            {pendingText ? `Finding ${pendingText}…` : 'Calculating route…'}
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

      <RouteStopsSection
        startLocation={details.startLocation}
        stops={details.stops}
        tripType={details.tripType}
        places={draft.route.places}
        onChangeStart={(startLocation) => updateDetails({ startLocation })}
        onChangeStops={(next) => updateDetails({ stops: next })}
        rememberPlace={rememberPlace}
        legs={preview?.legs}
        showMapButton={false}
        stayNights={details.stayNights}
        onChangeStayNights={(stayNights) => updateDetails({ stayNights })}
      />
    </WizardStepScreen>
  );
}

/**
 * Total distance and driving time, for the footer.
 */
function RouteTotals({
  preview,
  ready,
}: {
  preview: ReturnType<typeof currentRoutePreview>;
  ready: boolean;
}) {
  const colors = useTheme();

  return (
    <View style={styles.totals}>
      <View style={[styles.totalsIcon, { backgroundColor: 'rgba(37, 99, 235, 0.12)' }]}>
        <Ionicons name="speedometer-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.totalsText}>
        <ThemedText type="smallBold">
          {preview
            ? `${formatDistance(preview.distance_meters)} · ${formatDuration(preview.duration_seconds)} driving`
            : ready
              ? 'Calculating your route…'
              : 'No route yet'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {preview
            ? `${preview.legs.length} ${preview.legs.length === 1 ? 'leg' : 'legs'}, distances shown between the stops.`
            : 'Distances appear once every place is found.'}
        </ThemedText>
      </View>
    </View>
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

  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  totalsIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  totalsText: {
    flex: 1,
  },
});
