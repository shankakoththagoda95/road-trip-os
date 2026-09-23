import { StyleSheet, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export default function TripsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">Your Trips</ThemedText>
        <ThemedText themeColor="textSecondary">
          Plan, manage, and explore your road adventures.
        </ThemedText>
      </ThemedView>

      <Pressable>
        <ThemedView type="primary" style={styles.createCard}>
          <ThemedText style={styles.createTitle}>
            Plan a New Trip
          </ThemedText>

          <ThemedText style={styles.createDescription}>
            Build your route, destinations, budget, and itinerary.
          </ThemedText>
        </ThemedView>
      </Pressable>

      <ThemedView type="card" style={styles.emptyCard}>
        <ThemedText type="subtitle">No trips yet</ThemedText>

        <ThemedText themeColor="textSecondary">
          Your planned road trips will appear here.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.four,
  },

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

  emptyCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    gap: Spacing.two,
  },
});