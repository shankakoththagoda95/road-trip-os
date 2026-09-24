import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { listTrips } from '@/api/trips';
import { listVehicles } from '@/api/vehicles';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useSession } from '@/hooks/use-session';

type Counts = { trips: number; vehicles: number };

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = Colors[theme];
  const { session, signOut } = useSession();
  const user = session.status === 'signedIn' ? session.user : null;

  const [counts, setCounts] = useState<Counts | null>(null);

  // Refresh whenever Home comes back into view (e.g. after creating a trip).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      Promise.all([listTrips(), listVehicles()])
        .then(([trips, vehicles]) => {
          if (!cancelled) {
            setCounts({ trips: trips.length, vehicles: vehicles.length });
          }
        })
        .catch(() => {
          // Leave the placeholders; the cards show "—" until data loads.
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <Screen hasTabBar>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <ThemedText type="title">Road-Trip OS</ThemedText>
          <ThemedText
            themeColor="textSecondary"
            style={styles.subtitle}>
            {user
              ? `Hi ${user.first_name}! Plan smarter. Drive farther. Explore more.`
              : 'Plan smarter. Drive farther. Explore more.'}
          </ThemedText>

          {/* Web has a sign-out button in the top tab bar. */}
          {Platform.OS !== 'web' && (
            <Pressable
              accessibilityRole="button"
              onPress={signOut}
              style={({ pressed }) => [
                styles.signOut,
                pressed && styles.pressed,
              ]}>
              <ThemedText type="linkPrimary">Sign out</ThemedText>
            </Pressable>
          )}
        </View>

        <View
          style={[
            styles.logoBadge,
            { backgroundColor: colors.primary },
          ]}>
          <ThemedText style={styles.logoText}>🧭</ThemedText>
        </View>
      </View>

      {/* Primary action */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Plan a new trip"
        onPress={() => router.push('/trips/new')}
        style={({ pressed }) => [
          styles.heroCard,
          { backgroundColor: colors.primary },
          pressed && styles.pressed,
        ]}>
        <View style={styles.heroContent}>
          <ThemedText style={styles.heroEmoji}>🚗</ThemedText>
      
          <View style={styles.heroText}>
            <ThemedText style={styles.heroTitle}>
              Plan a New Trip
            </ThemedText>
      
            <ThemedText style={styles.heroDescription}>
              Build your route, destinations, budget, and itinerary.
            </ThemedText>
          </View>
      
          <ThemedText style={styles.arrow}>→</ThemedText>
        </View>
      </Pressable>

      {/* Summary */}
      <View style={styles.section}>
        <ThemedText type="subtitle">Your Road-Trip Overview</ThemedText>

        <View style={styles.summaryGrid}>
          <SummaryCard
            emoji="🗺️"
            value={counts ? String(counts.trips) : '—'}
            label="Planned Trips"
            colors={colors}
          />

          <SummaryCard
            emoji="🚙"
            value={counts ? String(counts.vehicles) : '—'}
            label="Vehicles"
            colors={colors}
          />

          <SummaryCard
            emoji="💰"
            value="—"
            label="Trip Budget"
            colors={colors}
          />
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <ThemedText type="subtitle">Quick Actions</ThemedText>

        <View style={styles.quickActions}>
          <QuickAction
            emoji="⛽"
            title="Fuel"
            description="Track fuel needs"
            colors={colors}
          />

          <QuickAction
            emoji="⚡"
            title="EV Mode"
            description="Plan charging"
            colors={colors}
          />

          <QuickAction
            emoji="🌦️"
            title="Weather"
            description="Check conditions"
            colors={colors}
          />

          <QuickAction
            emoji="🚙"
            title="Vehicles"
            description="Manage vehicles"
            colors={colors}
          />
        </View>
      </View>
    </Screen>
  );
}

type ThemeColors = (typeof Colors)[keyof typeof Colors];

function SummaryCard({
  emoji,
  value,
  label,
  colors,
}: {
  emoji: string;
  value: string;
  label: string;
  colors: ThemeColors;
}) {
  return (
    <ThemedView
      type="card"
      style={[
        styles.summaryCard,
        { borderColor: colors.border },
      ]}>
      <ThemedText style={styles.cardEmoji}>{emoji}</ThemedText>

      <ThemedText type="subtitle">{value}</ThemedText>

      <ThemedText
        themeColor="textSecondary"
        style={styles.cardLabel}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function QuickAction({
  emoji,
  title,
  description,
  colors,
  onPress,
}: {
  emoji: string;
  title: string;
  description: string;
  colors: ThemeColors;
  onPress?: () => void;
}) {
  const disabled = !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quickAction,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText style={styles.quickEmoji}>{emoji}</ThemedText>

      <ThemedText type="smallBold">{title}</ThemedText>

      <ThemedText
        themeColor="textSecondary"
        style={styles.quickDescription}>
        {disabled ? 'Coming soon' : description}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  subtitle: {
    marginTop: Spacing.one,
  },

  signOut: {
    alignSelf: 'flex-start',
  },

  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoText: {
    fontSize: 25,
  },

  heroCard: {
    borderRadius: 20,
    padding: Spacing.four,
  },

  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  heroEmoji: {
    fontSize: 36,
  },

  heroText: {
    flex: 1,
    gap: Spacing.one,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },

  heroDescription: {
    color: '#FFFFFF',
    opacity: 0.9,
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '600',
  },

  section: {
    gap: Spacing.two,
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  summaryCard: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: 130,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    gap: Spacing.one,
  },

  cardEmoji: {
    fontSize: 25,
  },

  cardLabel: {
    fontSize: 13,
  },

  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  quickAction: {
    flexGrow: 1,
    flexBasis: 210,
    minHeight: 125,
    padding: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    gap: Spacing.one,
  },

  quickEmoji: {
    fontSize: 28,
  },

  quickDescription: {
    fontSize: 13,
  },

  pressed: {
    opacity: 0.8,
  },

  disabled: {
    opacity: 0.55,
  },
});