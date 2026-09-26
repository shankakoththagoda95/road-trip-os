import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';

import { listTrips, type Trip } from '@/api/trips';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

type Popover = 'notifications' | 'account' | null;
type IconName = ComponentProps<typeof Ionicons>['name'];

// Web supports fixed positioning; used to close popovers on outside click.
const FullScreen = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
} as unknown as ViewStyle;

// Web: drop the browser focus ring; the search field has its own border.
const NoOutline = { outlineStyle: 'none' } as unknown as TextStyle;

/**
 * Top bar above every page: search, theme, notifications and account.
 */
export function AppHeader({ compact = false }: { compact?: boolean }) {
  const colors = useTheme();
  const { theme, toggleTheme } = useAppTheme();
  const { session } = useSession();
  const [popover, setPopover] = useState<Popover>(null);

  const signedIn = session.status === 'signedIn';

  function toggle(which: Popover) {
    setPopover((current) => (current === which ? null : which));
  }

  return (
    <View style={[styles.header, compact && styles.headerCompact]}>
      {popover && (
        <Pressable
          accessibilityLabel="Close"
          onPress={() => setPopover(null)}
          style={FullScreen}
        />
      )}

      {signedIn ? <SearchBox /> : <View style={styles.spacer} />}

      {/* Narrow screens: the theme toggle is in the account menu. */}
      {(!compact || !signedIn) && (
        <CircleButton
          label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          icon={theme === 'dark' ? 'sunny-outline' : 'moon-outline'}
          onPress={toggleTheme}
        />
      )}

      {signedIn && (
        <View style={styles.anchor}>
          <CircleButton
            label="Notifications"
            icon="notifications-outline"
            onPress={() => toggle('notifications')}
          />
          {popover === 'notifications' && (
            <View
              style={[
                styles.popover,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}>
              <ThemedText type="smallBold">Notifications</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                You&apos;re all caught up.
              </ThemedText>
            </View>
          )}
        </View>
      )}

      {signedIn && (
        <AccountMenu
          open={popover === 'account'}
          compact={compact}
          onToggle={() => toggle('account')}
          onClose={() => setPopover(null)}
        />
      )}
    </View>
  );
}

function SearchBox() {
  const router = useRouter();
  const colors = useTheme();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [trips, setTrips] = useState<Trip[] | null>(null);

  function loadTrips() {
    // Fetched on first focus; refreshed on later focuses.
    listTrips()
      .then(setTrips)
      .catch(() => setTrips([]));
  }

  const text = query.trim().toLowerCase();
  const matches = text
    ? (trips ?? [])
        .filter((trip) =>
          [trip.name, trip.start_location, trip.destination].some((value) =>
            value.toLowerCase().includes(text),
          ),
        )
        .slice(0, 5)
    : [];

  function openTrip(trip: Trip) {
    setQuery('');
    router.push({ pathname: '/trips/[id]', params: { id: String(trip.id) } });
  }

  function planTo(destination: string) {
    setQuery('');
    router.push({ pathname: '/trips/new/details', params: { destination } });
  }

  function submit() {
    if (matches[0]) {
      openTrip(matches[0]);
    } else if (query.trim()) {
      planTo(query.trim());
    }
  }

  const showResults = focused && text.length > 0;

  return (
    <View style={styles.searchWrap}>
      <View
        style={[
          styles.search,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          accessibilityLabel="Search trips and destinations"
          placeholder="Search destinations, trips, or places…"
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          onFocus={() => {
            setFocused(true);
            loadTrips();
          }}
          // Delay so a click on a result registers before it closes.
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onSubmitEditing={submit}
          returnKeyType="search"
          style={[styles.searchInput, NoOutline, { color: colors.text }]}
        />
      </View>

      {showResults && (
        <View
          style={[
            styles.results,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          {matches.map((trip) => (
            <ResultRow
              key={trip.id}
              icon="car-outline"
              title={trip.name}
              subtitle={`${trip.start_location} → ${trip.destination}`}
              onPress={() => openTrip(trip)}
            />
          ))}
          <ResultRow
            icon="add-circle-outline"
            title={`Plan a trip to “${query.trim()}”`}
            subtitle="Start a new trip with this destination"
            onPress={() => planTo(query.trim())}
          />
        </View>
      )}
    </View>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.resultRow,
        (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
      ]}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <View style={styles.resultText}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function AccountMenu({
  open,
  compact,
  onToggle,
  onClose,
}: {
  open: boolean;
  compact: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const colors = useTheme();
  const { theme, toggleTheme } = useAppTheme();
  const { session, signOut } = useSession();
  const user = session.status === 'signedIn' ? session.user : null;
  const initial = user?.first_name.charAt(0).toUpperCase() ?? '?';

  return (
    <View style={styles.anchor}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={({ hovered, pressed }) => [
          styles.accountButton,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          hovered && { backgroundColor: colors.backgroundSelected },
          pressed && styles.pressed,
        ]}>
        <View style={[styles.avatar, { backgroundColor: colors.brand }]}>
          <ThemedText style={[styles.avatarText, { color: colors.onBrand }]}>
            {initial}
          </ThemedText>
        </View>
        {!compact && user && (
          <ThemedText type="smallBold" numberOfLines={1} style={styles.userName}>
            {user.first_name}
          </ThemedText>
        )}
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {open && (
        <View
          style={[
            styles.popover,
            styles.accountPopover,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}>
          {user && (
            <View style={styles.accountInfo}>
              <ThemedText type="smallBold">
                {user.first_name} {user.last_name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {user.email}
              </ThemedText>
            </View>
          )}
          <MenuRow
            icon="car-outline"
            label="My trips"
            onPress={() => {
              onClose();
              router.navigate('/trips');
            }}
          />
          <MenuRow
            icon={theme === 'dark' ? 'sunny-outline' : 'moon-outline'}
            label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onPress={() => {
              onClose();
              toggleTheme();
            }}
          />
          <MenuRow
            icon="log-out-outline"
            label="Sign out"
            onPress={() => {
              onClose();
              signOut();
            }}
          />
        </View>
      )}
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="menuitem"
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.menuRow,
        (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
      ]}>
      <Ionicons name={icon} size={18} color={colors.textSecondary} />
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

function CircleButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.circle,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        hovered && { backgroundColor: colors.backgroundSelected },
        pressed && styles.pressed,
      ]}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    // Keep popovers above the page.
    position: 'relative',
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },

  headerCompact: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },

  spacer: {
    flex: 1,
  },

  searchWrap: {
    flex: 1,
    maxWidth: 640,
    marginRight: 'auto',
  },

  search: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 23,
    borderWidth: 1,
  },

  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 15,
  },

  results: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.one,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
  },

  resultText: {
    flex: 1,
    minWidth: 0,
  },

  anchor: {
    position: 'relative',
  },

  circle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  accountButton: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.one,
    paddingRight: Spacing.three,
    borderRadius: 23,
    borderWidth: 1,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },

  userName: {
    maxWidth: 140,
  },

  popover: {
    position: 'absolute',
    top: 54,
    right: 0,
    minWidth: 240,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
    boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
  },

  accountPopover: {
    padding: Spacing.one,
  },

  accountInfo: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
  },

  pressed: {
    opacity: 0.8,
  },
});
