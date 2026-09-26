import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import {
  type ComponentProps,
  type PropsWithChildren,
  useCallback,
  useRef,
  useState,
} from 'react';
import {
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ApiError } from '@/api/client';
import {
  getSavedItinerary,
  getTripBudget,
  listTrips,
  type Trip,
} from '@/api/trips';
import { listVehicles, type Vehicle } from '@/api/vehicles';
import { BannerScrim } from '@/components/dashboard/banner-scrim';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PopularDestinations } from '@/constants/destinations';
import { Spacing } from '@/constants/theme';
import { type AppTheme, useAppTheme } from '@/hooks/use-app-theme';
import { useAsync } from '@/hooks/use-async';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate, pluralize, tripEndDate } from '@/utils/dates';
import { formatMoney } from '@/utils/numbers';
import { formatDistance } from '@/utils/units';

type IconName = ComponentProps<typeof Ionicons>['name'];

const Images: Record<AppTheme, { banner: number; trip: number; quote: number }> = {
  light: {
    banner: require('@/assets/images/brand/banner-light.jpg'),
    trip: require('@/assets/images/brand/trip-thumb-light.jpg'),
    quote: require('@/assets/images/brand/quote-light.jpg'),
  },
  dark: {
    banner: require('@/assets/images/brand/banner-dark.jpg'),
    trip: require('@/assets/images/brand/trip-thumb-dark.jpg'),
    quote: require('@/assets/images/brand/quote-dark.jpg'),
  },
};

// Card tints from the design mockups.
type Accent = 'green' | 'blue' | 'amber' | 'purple' | 'orange';
type AccentColors = { card: string; border: string; tile: string; icon: string };

const Accents: Record<AppTheme, Record<Accent, AccentColors>> = {
  light: {
    green: { card: '#F3FAF1', border: '#E1F0DC', tile: '#E3F2DF', icon: '#2F7D3A' },
    blue: { card: '#F2F7FE', border: '#DCE9FB', tile: '#DDEBFD', icon: '#2563EB' },
    amber: { card: '#FFF8EE', border: '#F6E7CF', tile: '#FDEBD0', icon: '#D97706' },
    purple: { card: '#F7F3FE', border: '#E8DEFB', tile: '#EDE3FE', icon: '#7C3AED' },
    orange: { card: '#FFF5EE', border: '#F9E2D2', tile: '#FDE6D6', icon: '#EA7C1E' },
  },
  dark: {
    green: { card: '#0F2219', border: '#1C3A2A', tile: '#23553A', icon: '#9BE8A2' },
    blue: { card: '#0F1E33', border: '#1B3151', tile: '#1E4379', icon: '#A8C8FF' },
    amber: { card: '#231B12', border: '#3B2E1B', tile: '#6A4816', icon: '#F8C15C' },
    purple: { card: '#1A1730', border: '#2C2650', tile: '#4B3C8F', icon: '#D3C6FF' },
    orange: { card: '#26190F', border: '#402A18', tile: '#8C4A18', icon: '#FFC58F' },
  },
};

type DashboardData = {
  trips: Trip[];
  vehicles: Vehicle[];
};

export default function HomeScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const { session, signOut } = useSession();
  const user = session.status === 'signedIn' ? session.user : null;
  const narrow = width < 640;

  const scrollRef = useRef<ScrollView>(null);
  const destinationsY = useRef(0);

  // Refetch when coming back to Home (e.g. after creating a trip).
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

  const [dataState] = useAsync<DashboardData>(
    () =>
      Promise.all([listTrips(), listVehicles()]).then(([trips, vehicles]) => ({
        trips,
        vehicles,
      })),
    [refreshKey],
  );
  const data = dataState.status === 'success' ? dataState.data : null;

  const upcoming = (data?.trips ?? [])
    .filter((trip) => !isPast(trip))
    .sort((a, b) => time(a) - time(b));
  // The trip to feature: the next one, or the most recent past one.
  const featured =
    upcoming[0] ??
    [...(data?.trips ?? [])].sort((a, b) => time(b) - time(a))[0] ??
    null;

  const [budgetState] = useAsync(
    () =>
      featured
        ? getTripBudget(featured.id).catch((error) => {
            if (error instanceof ApiError && error.status === 404) {
              return null;
            }
            throw error;
          })
        : Promise.resolve(null),
    [featured?.id, refreshKey],
  );
  const budget = budgetState.status === 'success' ? budgetState.data : null;

  function planTo(destination: string) {
    router.push({ pathname: '/trips/new/details', params: { destination } });
  }

  const weatherHref: Href = featured
    ? { pathname: '/trips/[id]', params: { id: String(featured.id) } }
    : '/trips/new/conditions';

  return (
    <Screen hasTabBar scrollRef={scrollRef} fullWidth>
      <Hero
        theme={theme}
        narrow={narrow}
        onStart={() => router.push('/trips/new')}
        onExplore={() =>
          scrollRef.current?.scrollTo({
            y: destinationsY.current,
            animated: true,
          })
        }
      />

      <SectionTitle title="Your Road-Trip Overview" />
      <View style={styles.cardRow}>
        <StatCard
          accent="green"
          icon="map"
          value={data ? String(upcoming.length) : '…'}
          label="Planned Trips"
          onPress={() => router.navigate('/trips')}
        />
        <StatCard
          accent="blue"
          icon="car-sport"
          value={data ? String(data.vehicles.length) : '…'}
          label="Vehicles"
          onPress={() => router.push('/vehicles')}
        />
        <StatCard
          accent="amber"
          icon="cash"
          value={budget ? formatMoney(budget.estimated_total, budget.currency) : '—'}
          label={featured && budget ? `Trip Budget · ${featured.name}` : 'Trip Budget'}
          onPress={
            featured
              ? () =>
                  router.push({
                    pathname: '/trips/[id]',
                    params: { id: String(featured.id) },
                  })
              : undefined
          }
        />
      </View>

      <SectionTitle title="Quick Actions" />
      <View style={styles.cardRow}>
        <ActionCard
          accent="green"
          icon="map"
          title="Plan a Trip"
          description="Create a new road trip in minutes."
          onPress={() => router.push('/trips/new')}
        />
        <ActionCard
          accent="blue"
          icon="car-sport"
          title="Manage Vehicles"
          description="Add and manage your vehicles."
          onPress={() => router.push('/vehicles')}
        />
        <ActionCard
          accent="purple"
          icon="flash"
          title="EV Mode"
          description="Plan with charging stations."
          onPress={() => router.push('/trips/new/energy')}
        />
        <ActionCard
          accent="orange"
          icon="partly-sunny"
          title="Check Weather"
          description="See conditions along your route."
          onPress={() => router.push(weatherHref)}
        />
      </View>

      <View style={styles.bottomRow}>
        <Panel
          title="Recent Trips"
          style={styles.recentPanel}
          action={
            data && data.trips.length > 0
              ? { label: 'View all', onPress: () => router.navigate('/trips') }
              : undefined
          }>
          {featured ? (
            <FeaturedTrip
              trip={featured}
              vehicle={data?.vehicles.find((v) => v.id === featured.vehicle_id)}
              image={Images[theme].trip}
              refreshKey={refreshKey}
            />
          ) : (
            <View style={styles.emptyTrips}>
              <ThemedText type="small" themeColor="textSecondary">
                {data ? 'No trips yet. Your next adventure starts here.' : 'Loading…'}
              </ThemedText>
              {data && (
                <ThemedText
                  type="linkPrimary"
                  onPress={() => router.push('/trips/new')}>
                  Plan your first trip →
                </ThemedText>
              )}
            </View>
          )}
        </Panel>

        <View
          style={styles.destinationsPanel}
          onLayout={(event) => {
            destinationsY.current = event.nativeEvent.layout.y;
          }}>
          <Panel title="Popular Destinations">
            <View style={styles.destinations}>
              {PopularDestinations.map((destination) => (
                <DestinationTile
                  key={destination.name}
                  name={destination.name}
                  country={destination.country}
                  image={destination.image}
                  onPress={() => planTo(destination.name)}
                />
              ))}
            </View>
          </Panel>
        </View>

        <ImageBackground
          source={Images[theme].quote}
          resizeMode="cover"
          style={styles.quote}
          imageStyle={styles.quoteImage}>
          <View style={styles.quoteShade} />
          <Text style={styles.quoteText}>
            “Good roads{'\n'}lead to great{'\n'}stories.”
          </Text>
          <View style={[styles.quoteBar, { backgroundColor: colors.brand }]} />
        </ImageBackground>
      </View>

      {/* Web has sign out in the header's account menu. */}
      {Platform.OS !== 'web' && user && (
        <ThemedText type="linkPrimary" onPress={signOut} style={styles.signOut}>
          Sign out
        </ThemedText>
      )}
    </Screen>
  );
}

// --- Hero ---

// The banner photo is 2752 × 1536; the banner always keeps that shape so the
// whole picture is visible.
const BannerAspectRatio = 2752 / 1536;

// Below this banner height the text doesn't fit on the photo, so it moves
// underneath it.
const MinOverlayHeight = 300;

function Hero({
  theme,
  narrow,
  onStart,
  onExplore,
}: {
  theme: AppTheme;
  narrow: boolean;
  onStart: () => void;
  onExplore: () => void;
}) {
  const colors = useTheme();
  const dark = theme === 'dark';
  const [bannerWidth, setBannerWidth] = useState(0);
  const overlay = bannerWidth / BannerAspectRatio >= MinOverlayHeight;

  const content = (
    <View style={[styles.heroContent, !overlay && styles.heroContentBelow]}>
      <Text style={[styles.eyebrow, { color: colors.brand }]}>
        READY FOR YOUR NEXT ADVENTURE?
      </Text>
      <Text
        style={[
          styles.heroTitle,
          narrow && styles.heroTitleNarrow,
          { color: dark ? '#FFFFFF' : colors.text },
        ]}>
        Plan a{' '}
        <Text style={dark ? { color: colors.brand } : undefined}>New Trip</Text>
      </Text>
      <Text
        style={[styles.heroSubtitle, { color: dark ? '#D7E0EA' : '#334155' }]}>
        Build your route, destinations, budget, and itinerary — all in one
        place.
      </Text>

      <View style={styles.heroButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          style={({ hovered, pressed }) => [
            styles.heroButton,
            { backgroundColor: colors.brand },
            (hovered || pressed) && styles.hoverLift,
          ]}>
          <Ionicons name="map-outline" size={20} color={colors.onBrand} />
          <Text style={[styles.heroButtonText, { color: colors.onBrand }]}>
            Start Planning
          </Text>
          <Ionicons name="arrow-forward" size={18} color={colors.onBrand} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={onExplore}
          style={({ hovered, pressed }) => [
            styles.heroButton,
            dark ? styles.exploreDark : styles.exploreLight,
            (hovered || pressed) && styles.hoverLift,
          ]}>
          <Ionicons
            name="compass-outline"
            size={20}
            color={dark ? '#FFFFFF' : colors.text}
          />
          <Text
            style={[
              styles.heroButtonText,
              { color: dark ? '#FFFFFF' : colors.text },
            ]}>
            Explore Destinations
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View
      style={styles.hero}
      onLayout={(event) => setBannerWidth(event.nativeEvent.layout.width)}>
      <ImageBackground
        source={Images[theme].banner}
        resizeMode="cover"
        style={styles.heroImage}
        imageStyle={styles.bannerPhoto}
        accessibilityIgnoresInvertColors>
        {overlay && (
          <>
            <BannerScrim color={dark ? '10, 20, 32' : '255, 255, 255'} />
            {content}
          </>
        )}
      </ImageBackground>

      {!overlay && (
        <View style={{ backgroundColor: colors.card }}>{content}</View>
      )}
    </View>
  );
}

// --- Cards ---

function SectionTitle({ title }: { title: string }) {
  return <Text style={[styles.sectionTitle, { color: useTheme().text }]}>{title}</Text>;
}

function useAccent(accent: Accent) {
  const { theme } = useAppTheme();
  return Accents[theme][accent];
}

function IconTile({ accent, icon }: { accent: Accent; icon: IconName }) {
  const tint = useAccent(accent);

  return (
    <View style={[styles.iconTile, { backgroundColor: tint.tile }]}>
      <Ionicons name={icon} size={28} color={tint.icon} />
    </View>
  );
}

function TintedCard({
  accent,
  onPress,
  children,
}: PropsWithChildren<{ accent: Accent; onPress?: () => void }>) {
  const tint = useAccent(accent);
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.tintedCard,
        { backgroundColor: tint.card, borderColor: tint.border },
        onPress && (hovered || pressed) && styles.hoverLift,
      ]}>
      {children}
      {onPress ? (
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      ) : (
        <Text style={[styles.soon, { color: colors.textSecondary }]}>SOON</Text>
      )}
    </Pressable>
  );
}

function StatCard({
  accent,
  icon,
  value,
  label,
  onPress,
}: {
  accent: Accent;
  icon: IconName;
  value: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.statSlot}>
      <TintedCard accent={accent} onPress={onPress}>
        <IconTile accent={accent} icon={icon} />
        <View style={styles.cardText}>
          <ThemedText style={styles.statValue} numberOfLines={1}>
            {value}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {label}
          </ThemedText>
        </View>
      </TintedCard>
    </View>
  );
}

function ActionCard({
  accent,
  icon,
  title,
  description,
  onPress,
}: {
  accent: Accent;
  icon: IconName;
  title: string;
  description: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.actionSlot}>
      <TintedCard accent={accent} onPress={onPress}>
        <IconTile accent={accent} icon={icon} />
        <View style={styles.cardText}>
          <ThemedText type="smallBold" style={styles.actionTitle}>
            {title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        </View>
      </TintedCard>
    </View>
  );
}

function Panel({
  title,
  action,
  style,
  children,
}: PropsWithChildren<{
  title: string;
  action?: { label: string; onPress: () => void };
  style?: object;
}>) {
  const colors = useTheme();

  return (
    <ThemedView
      type="card"
      style={[styles.panel, { borderColor: colors.border }, style]}>
      <View style={styles.panelHeader}>
        <ThemedText type="smallBold" style={styles.panelTitle}>
          {title}
        </ThemedText>
        {action && (
          <Pressable accessibilityRole="link" onPress={action.onPress}>
            <ThemedText type="small" themeColor="textSecondary">
              {action.label} →
            </ThemedText>
          </Pressable>
        )}
      </View>
      {children}
    </ThemedView>
  );
}

function FeaturedTrip({
  trip,
  vehicle,
  image,
  refreshKey,
}: {
  trip: Trip;
  vehicle?: Vehicle;
  image: number;
  refreshKey: number;
}) {
  const router = useRouter();
  const colors = useTheme();
  const departure = new Date(trip.departure_at);
  const end = tripEndDate(departure, trip.duration_days);

  // Distance from the saved itinerary (no routing call needed).
  const [itineraryState] = useAsync(
    () => getSavedItinerary(trip.id).catch(() => null),
    [trip.id, refreshKey],
  );
  const distanceMeters =
    itineraryState.status === 'success' && itineraryState.data
      ? itineraryState.data.days.reduce(
          (sum, day) => sum + day.total_distance_meters,
          0,
        )
      : null;

  const open = () =>
    router.push({ pathname: '/trips/[id]', params: { id: String(trip.id) } });

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open ${trip.name}`}
      onPress={open}
      style={({ hovered }) => [
        styles.featured,
        { backgroundColor: colors.backgroundSelected },
        hovered && styles.hoverLift,
      ]}>
      <View style={styles.featuredTop}>
        <Image source={image} style={styles.featuredImage} resizeMode="cover" />
        <View style={styles.featuredText}>
          <ThemedText type="smallBold" style={styles.featuredName} numberOfLines={2}>
            {trip.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {formatShortDate(departure)} – {formatShortDate(end)}
          </ThemedText>
        </View>
        <View style={[styles.featuredChevron, { backgroundColor: colors.card }]}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </View>
      </View>

      <View style={styles.featuredMeta}>
        <MetaItem
          icon="location-outline"
          label={distanceMeters ? formatDistance(distanceMeters) : `${trip.start_location} → ${trip.destination}`}
        />
        <MetaItem
          icon="calendar-outline"
          label={pluralize(trip.duration_days, 'day', 'days')}
        />
        {vehicle && <MetaItem icon="car-outline" label={vehicle.name} />}
      </View>
    </Pressable>
  );
}

function MetaItem({ icon, label }: { icon: IconName; label: string }) {
  const colors = useTheme();

  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <ThemedText type="small" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function DestinationTile({
  name,
  country,
  image,
  onPress,
}: {
  name: string;
  country: string;
  image?: ComponentProps<typeof Image>['source'];
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Plan a trip to ${name}`}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.destination,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
        (hovered || pressed) && styles.hoverLift,
      ]}>
      {image ? (
        <Image source={image} style={styles.destinationImage} resizeMode="cover" />
      ) : (
        <View
          style={[
            styles.destinationImage,
            styles.destinationPlaceholder,
            { backgroundColor: colors.brandSoft },
          ]}>
          <Ionicons name="image-outline" size={28} color={colors.brand} />
        </View>
      )}
      <View style={styles.destinationText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {country}
        </ThemedText>
      </View>
    </Pressable>
  );
}

// --- Helpers ---

function time(trip: Trip) {
  return new Date(trip.departure_at).getTime();
}

function isPast(trip: Trip) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return tripEndDate(new Date(trip.departure_at), trip.duration_days) < today;
}

const styles = StyleSheet.create({
  // Edge to edge: cancels the page's side padding (see Screen).
  hero: {
    marginHorizontal: -Spacing.four,
    overflow: 'hidden',
  },

  // Same shape as the photo, so none of it is cut off.
  heroImage: {
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

  // Text under the photo on narrow banners.
  heroContentBelow: {
    maxWidth: undefined,
    padding: Spacing.four,
  },

  heroContent: {
    // Above the scrim.
    position: 'relative',
    zIndex: 1,
    maxWidth: 560,
    padding: Spacing.five,
    gap: Spacing.two,
  },

  eyebrow: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },

  heroTitle: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '800',
  },

  heroTitleNarrow: {
    fontSize: 38,
    lineHeight: 44,
  },

  heroSubtitle: {
    fontSize: 18,
    lineHeight: 26,
    maxWidth: 460,
  },

  heroButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.three,
  },

  heroButton: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: 16,
  },

  heroButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },

  exploreDark: {
    backgroundColor: 'rgba(10, 20, 32, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },

  exploreLight: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E3E8EF',
  },

  hoverLift: {
    opacity: 0.92,
    transform: [{ translateY: -1 }],
  },

  sectionTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: '700',
    marginBottom: -Spacing.two,
  },

  cardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  statSlot: {
    flexGrow: 1,
    flexBasis: 260,
  },

  actionSlot: {
    flexGrow: 1,
    flexBasis: 230,
  },

  tintedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 100,
  },

  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },

  statValue: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },

  actionTitle: {
    fontSize: 16,
  },

  soon: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  panel: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.three,
  },

  recentPanel: {
    flexGrow: 1.3,
    flexBasis: 340,
  },

  destinationsPanel: {
    flexGrow: 1.3,
    flexBasis: 340,
    display: 'flex',
  },

  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  panelTitle: {
    fontSize: 18,
  },

  emptyTrips: {
    gap: Spacing.two,
  },

  featured: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },

  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  featuredImage: {
    width: 150,
    height: 96,
    borderRadius: 12,
  },

  featuredText: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },

  featuredName: {
    fontSize: 16,
  },

  featuredChevron: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  featuredMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.four,
    rowGap: Spacing.one,
  },

  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    maxWidth: 220,
  },

  destinations: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  destination: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },

  destinationImage: {
    width: '100%',
    height: 100,
  },

  destinationPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  destinationText: {
    padding: Spacing.two,
  },

  quote: {
    flexGrow: 1,
    flexBasis: 260,
    minHeight: 220,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },

  quoteImage: {
    borderRadius: 20,
  },

  quoteShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 12, 20, 0.38)',
  },

  quoteText: {
    // Above the shade.
    position: 'relative',
    zIndex: 1,
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '600',
  },

  quoteBar: {
    position: 'relative',
    zIndex: 1,
    width: 48,
    height: 4,
    borderRadius: 2,
  },

  signOut: {
    alignSelf: 'center',
  },
});
