import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { type ComponentProps, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';

import { errorMessage } from '@/api/client';
import { deleteTrip, listTrips, type Trip } from '@/api/trips';
import { BannerScrim } from '@/components/dashboard/banner-scrim';
import { GradientFill } from '@/components/gradient-fill';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, pluralize, tripEndDate } from '@/utils/dates';

type IconName = ComponentProps<typeof Ionicons>['name'];

const bannerImage = require('@/assets/images/brand/trips-banner.jpg');
const travelPack = require('@/assets/images/brand/travelpack.png');

// Trips have no photos; each card gets one of these, picked by trip id.
const Thumbnails = [
  require('@/assets/images/brand/trip-thumbs/coast.jpg'),
  require('@/assets/images/brand/trip-thumbs/lake.jpg'),
  require('@/assets/images/brand/trip-thumbs/forest.jpg'),
  require('@/assets/images/brand/trip-thumbs/together.jpg'),
];

// Banner photo is a 1920 × 640 strip of newtrip.png; the banner keeps that
// shape so it is never cropped or stretched.
const BannerAspectRatio = 1920 / 640;
// Fade colours taken from the photo's own warm grey (≈ rgb 115, 105, 104),
// darkened / lightened, so the fade blends into the picture.
const ScrimColors = { dark: '30, 26, 25', light: '246, 242, 240' };

// A long, gradual fade so there's no visible edge.
const ScrimStops = [
  [0, 0.9],
  [22, 0.72],
  [42, 0.4],
  [60, 0.12],
  [75, 0],
] as const;

// Below this width the banner is too short for its text, which moves below.
const MinOverlayWidth = 780;

// Web: drop the browser focus ring; the search field has its own border.
const NoOutline = { outlineStyle: 'none' } as unknown as TextStyle;

type Status = 'upcoming' | 'ongoing' | 'completed';
type Filter = 'all' | Status;
type Sort = 'newest' | 'oldest' | 'departure' | 'name';

const Filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All Trips' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
];

const Sorts: { value: Sort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'departure', label: 'Departure date' },
  { value: 'name', label: 'Name (A–Z)' },
];

export default function TripsScreen() {
  const router = useRouter();
  const colors = useTheme();

  // Refetch when coming back (e.g. after creating or editing a trip).
  const [refreshKey, setRefreshKey] = useState(0);
  const focusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        setRefreshKey((key) => key + 1);
      }
      focusedBefore.current = true;
    }, []),
  );

  const [state, reload] = useAsync(() => listTrips(), [refreshKey]);
  const refresh = () => setRefreshKey((key) => key + 1);

  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('newest');

  const trips = state.status === 'success' ? state.data : [];
  const text = query.trim().toLowerCase();
  const visible = sortTrips(
    trips.filter(
      (trip) =>
        (filter === 'all' || tripStatus(trip) === filter) &&
        (!text ||
          [trip.name, trip.start_location, trip.destination].some((value) =>
            value.toLowerCase().includes(text),
          )),
    ),
    sort,
  );

  return (
    <Screen hasTabBar fullWidth>
      <TripsBanner />

      <PlanTripCard onPress={() => router.push('/trips/new')} />

      <ThemedText style={styles.sectionTitle}>Your Trips</ThemedText>

      <View style={styles.controls}>
        <View style={styles.filters}>
          {Filters.map((option) => (
            <FilterPill
              key={option.value}
              label={option.label}
              active={filter === option.value}
              onPress={() => setFilter(option.value)}
            />
          ))}
        </View>

        <View style={styles.tools}>
          <View
            style={[
              styles.search,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              accessibilityLabel="Search trips"
              placeholder="Search trips…"
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, NoOutline, { color: colors.text }]}
            />
          </View>
          <SortMenu value={sort} onChange={setSort} />
        </View>
      </View>

      {state.status === 'loading' && (
        <ActivityIndicator color={colors.brand} style={styles.loading} />
      )}

      {state.status === 'error' && (
        <ThemedView type="card" style={[styles.message, { borderColor: colors.border }]}>
          <ThemedText type="smallBold">Couldn&apos;t load trips</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {state.message}
          </ThemedText>
          <ThemedText type="linkPrimary" onPress={reload}>
            Try again
          </ThemedText>
        </ThemedView>
      )}

      {state.status === 'success' && visible.length === 0 && (
        <ThemedView type="card" style={[styles.message, { borderColor: colors.border }]}>
          <ThemedText type="smallBold">
            {trips.length === 0 ? 'No trips yet' : 'No trips match'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {trips.length === 0
              ? 'Your planned road trips will appear here. Plan your first one above.'
              : 'Try another filter or search.'}
          </ThemedText>
        </ThemedView>
      )}

      <View style={styles.list}>
        {visible.map((trip) => (
          <TripCard key={trip.id} trip={trip} onChanged={refresh} />
        ))}
      </View>
    </Screen>
  );
}

// --- Banner ---

const Features: { icon: IconName; color: string; label: string }[] = [
  { icon: 'git-branch-outline', color: '#86E08F', label: 'Plan\nRoutes' },
  { icon: 'location', color: '#F0506E', label: 'Discover\nPlaces' },
  { icon: 'wallet', color: '#F59E0B', label: 'Track\nBudget' },
  { icon: 'document-text', color: '#FACC15', label: 'Keep\nItineraries' },
];

function TripsBanner() {
  const colors = useTheme();
  const { theme } = useAppTheme();
  const dark = theme === 'dark';
  const [width, setWidth] = useState(0);
  const overlay = width >= MinOverlayWidth;

  const textColor = overlay ? (dark ? '#FFFFFF' : colors.text) : colors.text;
  const subtleColor = overlay
    ? dark
      ? '#D7E0EA'
      : '#334155'
    : colors.textSecondary;

  const content = (
    <View style={[styles.bannerContent, !overlay && styles.bannerContentBelow]}>
      <View style={styles.eyebrowRow}>
        <Text style={[styles.eyebrow, { color: textColor }]}>TRIPS</Text>
        <View style={[styles.eyebrowLine, { backgroundColor: colors.brand }]} />
      </View>
      <Text style={[styles.bannerTitle, { color: textColor }]}>
        Your <Text style={{ color: colors.brand }}>Trips</Text>
      </Text>
      <Text style={[styles.bannerSubtitle, { color: subtleColor }]}>
        Plan, manage, and explore your road adventures.
      </Text>

      <View style={styles.features}>
        {Features.map((feature, index) => (
          <View key={feature.label} style={styles.feature}>
            {index > 0 && (
              <View style={[styles.featureDivider, { backgroundColor: subtleColor }]} />
            )}
            <View
              style={[
                styles.featureIcon,
                {
                  backgroundColor: dark
                    ? 'rgba(10, 20, 32, 0.6)'
                    : 'rgba(255, 255, 255, 0.85)',
                  borderColor: dark
                    ? 'rgba(255, 255, 255, 0.18)'
                    : 'rgba(15, 23, 42, 0.12)',
                },
              ]}>
              <Ionicons name={feature.icon} size={20} color={feature.color} />
            </View>
            <Text style={[styles.featureLabel, { color: textColor }]}>
              {feature.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <View
      style={styles.banner}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ImageBackground
        source={bannerImage}
        resizeMode="cover"
        style={styles.bannerImage}
        imageStyle={styles.bannerPhoto}
        accessibilityIgnoresInvertColors>
        {overlay && (
          <>
            <BannerScrim
              color={dark ? ScrimColors.dark : ScrimColors.light}
              stops={ScrimStops}
            />
            {content}
          </>
        )}
      </ImageBackground>
      {!overlay && <View style={{ backgroundColor: colors.card }}>{content}</View>}
    </View>
  );
}

// --- Plan a new trip ---

function PlanTripCard({ onPress }: { onPress: () => void }) {
  const { width } = useWindowDimensions();
  const stacked = width < 720;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Plan a new trip"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.planCard,
        stacked && styles.planCardStacked,
        (hovered || pressed) && styles.lift,
      ]}>
      <GradientFill from="#6FB1FB" to="#3B82F6" />
      <Image
        source={travelPack}
        resizeMode="contain"
        style={[styles.planImage, stacked && styles.planImageStacked]}
        accessibilityIgnoresInvertColors
      />
      <View style={styles.planText}>
        <Text style={styles.planTitle}>Plan a New Trip</Text>
        <Text style={styles.planSubtitle}>
          Build your route, destinations, budget, and itinerary.
        </Text>
      </View>
      <View style={styles.planButton}>
        <Ionicons name="add" size={20} color="#0F172A" />
        <Text style={styles.planButtonText}>Plan a New Trip</Text>
        <Ionicons name="chevron-forward" size={18} color="#0F172A" />
      </View>
    </Pressable>
  );
}

// --- Controls ---

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ hovered }) => [
        styles.pill,
        active
          ? { backgroundColor: colors.brand, borderColor: colors.brand }
          : {
              backgroundColor: hovered
                ? colors.backgroundSelected
                : colors.backgroundElement,
              borderColor: colors.border,
            },
      ]}>
      <Text
        style={[
          styles.pillText,
          { color: active ? colors.onBrand : colors.text },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: Sort;
  onChange: (value: Sort) => void;
}) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const current = Sorts.find((option) => option.value === value)!;

  return (
    <View style={styles.anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Sort: ${current.label}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((isOpen) => !isOpen)}
        style={[
          styles.sortButton,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ]}>
        <Ionicons name="options-outline" size={16} color={colors.text} />
        <ThemedText type="smallBold">{current.label}</ThemedText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View
          style={[
            styles.menu,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          {Sorts.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="menuitem"
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={({ hovered }) => [
                styles.menuItem,
                hovered && { backgroundColor: colors.backgroundSelected },
              ]}>
              <ThemedText
                type={option.value === value ? 'smallBold' : 'small'}>
                {option.label}
              </ThemedText>
              {option.value === value && (
                <Ionicons name="checkmark" size={16} color={colors.brand} />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// --- Trip card ---

const StatusStyles: Record<
  Status,
  { label: string; icon: IconName; tone: 'brand' | 'textSecondary' | 'warning' }
> = {
  upcoming: { label: 'Upcoming', icon: 'time-outline', tone: 'textSecondary' },
  ongoing: { label: 'Ongoing', icon: 'navigate-outline', tone: 'brand' },
  completed: {
    label: 'Completed',
    icon: 'checkmark-circle-outline',
    tone: 'textSecondary',
  },
};

function TripCard({ trip, onChanged }: { trip: Trip; onChanged: () => void }) {
  const router = useRouter();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const stacked = width < 760;

  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departure = new Date(trip.departure_at);
  const end = tripEndDate(departure, trip.duration_days);
  const status = tripStatus(trip);
  const statusStyle = StatusStyles[status];
  const progress = tripProgress(trip);
  const daysUntil = Math.ceil(
    (startOfDay(departure).getTime() - startOfDay(new Date()).getTime()) /
      86_400_000,
  );

  const open = () =>
    router.push({ pathname: '/trips/[id]', params: { id: String(trip.id) } });

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    try {
      await deleteTrip(trip.id);
      onChanged();
    } catch (deleteError) {
      setError(errorMessage(deleteError));
      setDeleting(false);
    }
  }

  return (
    <ThemedView
      type="card"
      style={[
        styles.card,
        stacked && styles.cardStacked,
        { borderColor: colors.border },
        // Keep an open menu above the cards below it.
        menuOpen && styles.cardRaised,
      ]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Open ${trip.name}`}
        onPress={open}>
        <Image
          source={Thumbnails[trip.id % Thumbnails.length]}
          resizeMode="cover"
          style={[styles.thumb, stacked && styles.thumbStacked]}
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Pressable
            accessibilityRole="link"
            onPress={open}
            style={styles.cardTitleBlock}>
            <ThemedText style={styles.tripName} numberOfLines={1}>
              {trip.name}
            </ThemedText>
            <ThemedText themeColor="textSecondary" numberOfLines={1}>
              {trip.start_location}{' '}
              {trip.trip_type === 'round_trip' ? '⇄' : '→'} {trip.destination}
            </ThemedText>
          </Pressable>

          <View style={styles.cardCorner}>
            <View
              style={[
                styles.statusPill,
                { borderColor: colors.border, backgroundColor: colors.backgroundSelected },
              ]}>
              <Ionicons
                name={statusStyle.icon}
                size={14}
                color={colors[statusStyle.tone]}
              />
              <ThemedText type="smallBold" themeColor={statusStyle.tone}>
                {statusStyle.label}
              </ThemedText>
            </View>

            <View style={styles.anchor}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Trip actions"
                accessibilityState={{ expanded: menuOpen }}
                onPress={() => setMenuOpen((isOpen) => !isOpen)}
                style={({ hovered }) => [
                  styles.moreButton,
                  hovered && { backgroundColor: colors.backgroundSelected },
                ]}>
                <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
              </Pressable>
              {menuOpen && (
                <View
                  style={[
                    styles.menu,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}>
                  <MenuItem
                    icon="create-outline"
                    label="Edit trip"
                    onPress={() => {
                      setMenuOpen(false);
                      router.push({
                        pathname: '/trips/[id]/edit',
                        params: { id: String(trip.id) },
                      });
                    }}
                  />
                  <MenuItem
                    icon="trash-outline"
                    label="Delete trip"
                    danger
                    onPress={() => {
                      setMenuOpen(false);
                      setConfirmingDelete(true);
                    }}
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.meta}>
          <Meta
            icon="calendar-outline"
            label={`${formatShortDate(departure)} – ${formatShortDate(end)}`}
          />
          <Meta icon="time-outline" label={pluralize(trip.duration_days, 'day', 'days')} />
          <Meta
            icon="people-outline"
            label={pluralize(trip.travelers, 'traveler', 'travelers')}
          />
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.progressBlock}>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: colors.brand },
                ]}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {status === 'upcoming'
                ? daysUntil <= 1
                  ? daysUntil === 1
                    ? 'Starts tomorrow'
                    : 'Starts today'
                  : `Starts in ${daysUntil} days`
                : status === 'ongoing'
                  ? `Day ${Math.min(trip.duration_days, Math.floor(progress * trip.duration_days) + 1)} of ${trip.duration_days}`
                  : 'Trip completed'}
            </ThemedText>
          </View>

          {confirmingDelete ? (
            <View style={styles.confirm}>
              <ThemedText type="small">Delete this trip?</ThemedText>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={handleDelete}
                style={[styles.detailsButton, { backgroundColor: colors.danger, borderColor: colors.danger }]}>
                <Text style={styles.dangerText}>{deleting ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={deleting}
                onPress={() => setConfirmingDelete(false)}
                style={[styles.detailsButton, { borderColor: colors.border }]}>
                <ThemedText type="smallBold">Cancel</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="link"
              onPress={open}
              style={({ hovered }) => [
                styles.detailsButton,
                {
                  borderColor: colors.border,
                  backgroundColor: hovered
                    ? colors.backgroundSelected
                    : colors.backgroundElement,
                },
              ]}>
              <ThemedText type="smallBold">View details →</ThemedText>
            </Pressable>
          )}
        </View>

        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
      </View>
    </ThemedView>
  );
}

function Meta({ icon, label }: { icon: IconName; label: string }) {
  const colors = useTheme();

  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={16} color={colors.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  danger = false,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();
  const color = danger ? colors.danger : colors.text;

  return (
    <Pressable
      accessibilityRole="menuitem"
      onPress={onPress}
      style={({ hovered }) => [
        styles.menuItem,
        hovered && { backgroundColor: colors.backgroundSelected },
      ]}>
      <Ionicons name={icon} size={16} color={color} />
      <ThemedText type="small" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// --- Helpers ---

function startOfDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function tripStatus(trip: Trip): Status {
  const today = startOfDay(new Date());
  const start = startOfDay(new Date(trip.departure_at));
  const end = tripEndDate(start, trip.duration_days);

  if (today < start) return 'upcoming';
  if (today > end) return 'completed';
  return 'ongoing';
}

// Share of the trip's days that have passed (0–1).
function tripProgress(trip: Trip) {
  const status = tripStatus(trip);

  if (status === 'upcoming') return 0;
  if (status === 'completed') return 1;

  const start = startOfDay(new Date(trip.departure_at)).getTime();
  const elapsedDays = (startOfDay(new Date()).getTime() - start) / 86_400_000 + 1;

  return Math.min(1, elapsedDays / trip.duration_days);
}

function sortTrips(trips: Trip[], sort: Sort) {
  const time = (trip: Trip) => new Date(trip.departure_at).getTime();
  const sorted = [...trips];

  switch (sort) {
    case 'newest':
      // Trip ids increase as trips are created.
      return sorted.sort((a, b) => b.id - a.id);
    case 'oldest':
      return sorted.sort((a, b) => a.id - b.id);
    case 'departure':
      return sorted.sort((a, b) => time(a) - time(b));
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
}

const styles = StyleSheet.create({
  // Edge to edge: cancels the page's side padding (see Screen).
  banner: {
    marginHorizontal: -Spacing.four,
  },

  bannerImage: {
    width: '100%',
    aspectRatio: BannerAspectRatio,
    justifyContent: 'center',
    // Clip the photo to the banner so it can't spill past the shading.
    overflow: 'hidden',
  },

  // Exactly the banner's box: same area as the shading on top of it.
  bannerPhoto: {
    width: '100%',
    height: '100%',
  },

  bannerContent: {
    // Above the scrim.
    position: 'relative',
    zIndex: 1,
    padding: Spacing.five,
    gap: Spacing.two,
    maxWidth: 640,
  },

  bannerContentBelow: {
    maxWidth: undefined,
    padding: Spacing.four,
  },

  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },

  eyebrowLine: {
    width: 32,
    height: 3,
    borderRadius: 2,
  },

  bannerTitle: {
    fontSize: 52,
    lineHeight: 60,
    fontWeight: '800',
  },

  bannerSubtitle: {
    fontSize: 17,
    lineHeight: 24,
  },

  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: Spacing.three,
    marginTop: Spacing.three,
  },

  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  featureDivider: {
    width: 1,
    height: 32,
    opacity: 0.35,
    marginHorizontal: Spacing.three,
  },

  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  featureLabel: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },

  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    minHeight: 130,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    overflow: 'hidden',
  },

  planCardStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },

  planImage: {
    width: 120,
    height: 120,
  },

  planImageStacked: {
    alignSelf: 'center',
  },

  planText: {
    flex: 1,
    gap: Spacing.one,
  },

  planTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },

  planSubtitle: {
    color: '#F1F6FF',
    fontSize: 16,
    lineHeight: 22,
  },

  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 52,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    boxShadow: '0 6px 18px rgba(15, 23, 42, 0.18)',
  },

  planButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
  },

  lift: {
    opacity: 0.95,
    transform: [{ translateY: -1 }],
  },

  sectionTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    marginBottom: -Spacing.two,
  },

  controls: {
    // Keep the sort menu above the trip list.
    position: 'relative',
    zIndex: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  pill: {
    height: 40,
    paddingHorizontal: Spacing.four,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },

  tools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  search: {
    height: 42,
    minWidth: 240,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 21,
    borderWidth: 1,
  },

  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
  },

  anchor: {
    position: 'relative',
  },

  sortButton: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 21,
    borderWidth: 1,
  },

  menu: {
    position: 'absolute',
    top: 48,
    right: 0,
    minWidth: 190,
    padding: Spacing.one,
    borderRadius: 14,
    borderWidth: 1,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.2)',
    zIndex: 20,
  },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
  },

  loading: {
    marginTop: Spacing.four,
  },

  message: {
    padding: Spacing.four,
    borderRadius: 18,
    borderWidth: 1,
    gap: Spacing.one,
  },

  list: {
    gap: Spacing.three,
  },

  card: {
    flexDirection: 'row',
    gap: Spacing.four,
    padding: Spacing.three,
    borderRadius: 20,
    borderWidth: 1,
  },

  cardStacked: {
    flexDirection: 'column',
  },

  cardRaised: {
    zIndex: 5,
  },

  thumb: {
    width: 230,
    height: 150,
    borderRadius: 14,
  },

  thumbStacked: {
    width: '100%',
    height: 180,
  },

  cardBody: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.two,
    justifyContent: 'space-between',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },

  cardTitleBlock: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },

  tripName: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  },

  cardCorner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 32,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
  },

  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.one,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  cardBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  progressBlock: {
    flex: 1,
    minWidth: 180,
    gap: Spacing.one,
  },

  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  detailsButton: {
    height: 44,
    paddingHorizontal: Spacing.four,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  dangerText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
