import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import { listTrips, type Trip } from '@/api/trips';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  formatDateTime,
  formatShortDate,
  pluralize,
  tripEndDate,
} from '@/utils/dates';

type TripsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; trips: Trip[] };

export default function TripsScreen() {
  const router = useRouter();
  const colors = useTheme();
  const [state, setState] = useState<TripsState>({ status: 'loading' });

  const loadTrips = useCallback(() => {
    let cancelled = false;

    listTrips()
      .then((trips) => {
        if (!cancelled) {
          setState({ status: 'loaded', trips: sortTrips(trips) });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({ status: 'error', message: errorMessage(error) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Reload whenever the tab comes into view, e.g. after creating a trip.
  useFocusEffect(loadTrips);

  function retry() {
    setState({ status: 'loading' });
    loadTrips();
  }

  return (
    <Screen hasTabBar>
      <View style={styles.header}>
        <ThemedText type="title">Your Trips</ThemedText>
        <ThemedText themeColor="textSecondary">
          Plan, manage, and explore your road adventures.
        </ThemedText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan a new trip"
        onPress={() => router.push('/trips/new')}
        style={({ pressed }) => pressed && styles.pressed}>
        <ThemedView type="primary" style={styles.createCard}>
          <ThemedText style={styles.createTitle}>
            Plan a New Trip
          </ThemedText>

          <ThemedText style={styles.createDescription}>
            Build your route, destinations, budget, and itinerary.
          </ThemedText>
        </ThemedView>
      </Pressable>

      {state.status === 'loading' && (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      )}

      {state.status === 'error' && (
        <ThemedView type="card" style={styles.messageCard}>
          <ThemedText type="subtitle">Couldn&apos;t load trips</ThemedText>
          <ThemedText themeColor="textSecondary">{state.message}</ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {state.status === 'loaded' && state.trips.length === 0 && (
        <ThemedView type="card" style={styles.messageCard}>
          <ThemedText type="subtitle">No trips yet</ThemedText>
          <ThemedText themeColor="textSecondary">
            Your planned road trips will appear here.
          </ThemedText>
        </ThemedView>
      )}

      {state.status === 'loaded' && state.trips.length > 0 && (
        <View style={styles.list}>
          {state.trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TripCard({ trip }: { trip: Trip }) {
  const colors = useTheme();
  const departure = new Date(trip.departure_at);
  const isPast = tripEndDate(departure, trip.duration_days) < startOfToday();

  return (
    <ThemedView
      type="card"
      style={[
        styles.tripCard,
        { borderColor: colors.border },
        isPast && styles.pastTrip,
      ]}>
      <View style={styles.tripHeader}>
        <ThemedText type="smallBold" style={styles.tripName}>
          {trip.name}
        </ThemedText>

        {isPast && (
          <ThemedText type="small" themeColor="textSecondary">
            Completed
          </ThemedText>
        )}
      </View>

      <ThemedText>
        {trip.start_location} {trip.trip_type === 'round_trip' ? '⇄' : '→'}{' '}
        {trip.destination}
      </ThemedText>

      <View style={styles.tripMeta}>
        <ThemedText type="small" themeColor="textSecondary">
          📅 {formatDateTime(trip.departure_at)}
          {trip.duration_days > 1
            ? ` – ${formatShortDate(tripEndDate(departure, trip.duration_days))}`
            : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          🕒 {pluralize(trip.duration_days, 'day', 'days')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          👥 {pluralize(trip.travelers, 'traveler', 'travelers')}
        </ThemedText>
      </View>
    </ThemedView>
  );
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

// Upcoming trips first (soonest at the top), then past trips (most recent first).
function sortTrips(trips: Trip[]) {
  const today = startOfToday();
  const isPast = (trip: Trip) =>
    tripEndDate(new Date(trip.departure_at), trip.duration_days) < today;
  const time = (trip: Trip) => new Date(trip.departure_at).getTime();

  const upcoming = trips.filter((trip) => !isPast(trip));
  const past = trips.filter(isPast);

  return [
    ...upcoming.sort((a, b) => time(a) - time(b)),
    ...past.sort((a, b) => time(b) - time(a)),
  ];
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },

  createCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },

  createTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },

  createDescription: {
    color: '#FFFFFF',
  },

  loading: {
    marginTop: Spacing.four,
  },

  messageCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },

  list: {
    gap: Spacing.three,
  },

  tripCard: {
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    gap: Spacing.one,
  },

  pastTrip: {
    opacity: 0.7,
  },

  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },

  tripName: {
    flex: 1,
    fontSize: 18,
  },

  tripMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.three,
  },

  pressed: {
    opacity: 0.8,
  },
});
