import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, usePathname, useRouter } from 'expo-router';
import { type ComponentProps, type PropsWithChildren, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { AppHeader } from '@/components/app-header';
import { BrandLogo } from '@/components/brand-logo';
import { Spacing } from '@/constants/theme';
import { type AppTheme, useAppTheme } from '@/hooks/use-app-theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

// Below this width the sidebar becomes a slide-in drawer behind a top bar.
const SidebarBreakpoint = 900;
const SidebarWidth = 248;

// Sidebar colours per theme (from the design mockups).
const Palettes: Record<
  AppTheme,
  {
    background: string;
    border: string;
    activeBackground: string;
    activeBorder: string;
    activeIcon: string;
    activeText: string;
    text: string;
    icon: string;
    muted: string;
    tagline: string;
    hover: string;
    // RGB of `background`, for the artwork fade.
    fadeRgb: string;
    art: number;
  }
> = {
  light: {
    background: '#FFFFFF',
    border: '#E6EBF1',
    activeBackground: '#E6F4E4',
    activeBorder: '#E6F4E4',
    activeIcon: '#2F7D3A',
    activeText: '#1F3B24',
    text: '#2B3645',
    icon: '#4B5563',
    muted: '#A0AEC0',
    tagline: '#1F2937',
    hover: 'rgba(15, 23, 42, 0.05)',
    fadeRgb: '255, 255, 255',
    art: require('@/assets/images/brand/sidebar-art-light.jpg'),
  },
  dark: {
    background: '#0A1724',
    border: '#16273A',
    activeBackground: '#142628',
    activeBorder: '#234134',
    activeIcon: '#8BD17C',
    activeText: '#FFFFFF',
    text: '#D2DBE2',
    icon: '#A9B6C6',
    muted: '#5D6C7E',
    tagline: '#E2E9F2',
    hover: 'rgba(255, 255, 255, 0.06)',
    fadeRgb: '10, 23, 36',
    art: require('@/assets/images/brand/sidebar-art-dark.jpg'),
  },
};

type Palette = (typeof Palettes)[AppTheme];
type IconName = ComponentProps<typeof Ionicons>['name'];

type NavItem = {
  label: string;
  icon: IconName;
  // Items without an href are not built yet.
  href?: Href;
  isActive?: (pathname: string) => boolean;
};

const SignedInItems: NavItem[] = [
  { label: 'Home', icon: 'home-outline', href: '/', isActive: (p) => p === '/' },
  {
    label: 'Trips',
    icon: 'car-outline',
    href: '/trips',
    // Trip list, saved trips and the planner.
    isActive: (p) => p.startsWith('/trips'),
  },
  { label: 'Map', icon: 'map-outline' },
  {
    label: 'Vehicles',
    icon: 'car-sport-outline',
    href: '/vehicles',
    isActive: (p) => p.startsWith('/vehicles'),
  },
  { label: 'Budget', icon: 'wallet-outline' },
  {
    label: 'Find me fuel/charging',
    icon: 'flash-outline',
    href: '/stations',
    isActive: (p) => p.startsWith('/stations'),
  },
  { label: 'Weather', icon: 'cloud-outline' },
  { label: 'Settings', icon: 'settings-outline' },
];

const SignedOutItems: NavItem[] = [
  {
    label: 'Sign in',
    icon: 'log-in-outline',
    href: '/login',
    isActive: (p) => p === '/login' || p === '/forgot-password',
  },
  {
    label: 'Create account',
    icon: 'person-add-outline',
    href: '/register',
    isActive: (p) => p === '/register' || p === '/check-email',
  },
];

/**
 * Web layout: sidebar + header around every page, or a top bar with a
 * slide-in drawer on narrow windows.
 */
export function AppShell({ children }: PropsWithChildren) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const colors = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const wide = width >= SidebarBreakpoint;
  const palette = Palettes[theme];

  if (wide) {
    return (
      <View style={[styles.row, { backgroundColor: colors.background }]}>
        <View style={styles.sidebarSlot}>
          <SidebarContent palette={palette} floating />
        </View>
        <View style={styles.content}>
          <AppHeader />
          <View style={styles.page}>{children}</View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.column, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          { backgroundColor: palette.background, borderBottomColor: palette.border },
        ]}>
        <BrandLogo height={32} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open menu"
          accessibilityState={{ expanded: drawerOpen }}
          onPress={() => setDrawerOpen(true)}
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
          <Ionicons name="menu" size={26} color={palette.text} />
        </Pressable>
      </View>

      <AppHeader compact />
      <View style={styles.page}>{children}</View>

      {drawerOpen && (
        <View style={styles.drawerLayer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            onPress={() => setDrawerOpen(false)}
            style={styles.backdrop}
          />
          <View style={styles.drawer}>
            <SidebarContent
              palette={palette}
              onNavigate={() => setDrawerOpen(false)}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function SidebarContent({
  palette,
  floating = false,
  onNavigate,
}: {
  palette: Palette;
  floating?: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();

  const signedIn = session.status === 'signedIn';
  const items = signedIn ? SignedInItems : SignedOutItems;

  function go(href: Href) {
    onNavigate?.();
    router.navigate(href);
  }

  const fade = `rgba(${palette.fadeRgb}, 1)`;
  const fadeHalf = `rgba(${palette.fadeRgb}, 0.25)`;

  return (
    <View
      role="navigation"
      style={[
        styles.sidebar,
        floating && styles.sidebarFloating,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Road-Trip OS home"
        onPress={() => go(signedIn ? '/' : '/login')}
        style={({ pressed }) => [styles.logo, pressed && styles.pressed]}>
        <BrandLogo height={64} />
      </Pressable>

      <ScrollView style={styles.itemsScroll} contentContainerStyle={styles.items}>
        {items.map((item) => (
          <SidebarItem
            key={item.label}
            item={item}
            palette={palette}
            active={item.isActive?.(pathname) ?? false}
            onPress={item.href ? () => go(item.href!) : undefined}
          />
        ))}
      </ScrollView>

      <View style={styles.art}>
        <Image
          source={palette.art}
          resizeMode="cover"
          style={styles.artImage}
          accessibilityIgnoresInvertColors
        />
        {/* Fade the picture into the sidebar colour at both ends. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom, ${fade} 0%, ${fadeHalf} 30%, ${fadeHalf} 55%, ${fade} 92%)`,
          }}
        />
        <Text style={[styles.tagline, { color: palette.tagline }]}>
          Plan Smarter.{'\n'}Drive Farther.
        </Text>
      </View>
    </View>
  );
}

function SidebarItem({
  item,
  palette,
  active,
  onPress,
}: {
  item: NavItem;
  palette: Palette;
  active: boolean;
  onPress?: () => void;
}) {
  const disabled = !onPress;

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={disabled ? `${item.label} (coming soon)` : item.label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.item,
        active && {
          backgroundColor: palette.activeBackground,
          borderColor: palette.activeBorder,
        },
        !active && hovered && !disabled && { backgroundColor: palette.hover },
        pressed && styles.pressed,
      ]}>
      <Ionicons
        name={item.icon}
        size={22}
        color={active ? palette.activeIcon : disabled ? palette.muted : palette.icon}
      />
      <Text
        style={[
          styles.itemLabel,
          {
            color: active
              ? palette.activeText
              : disabled
                ? palette.muted
                : palette.text,
          },
          active && styles.itemLabelActive,
        ]}>
        {item.label}
      </Text>
      {active && (
        <Ionicons name="chevron-forward" size={18} color={palette.activeText} />
      )}
      {disabled && (
        <Text style={[styles.soon, { color: palette.muted }]}>Soon</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
  },

  column: {
    flex: 1,
  },

  sidebarSlot: {
    padding: Spacing.three,
    paddingRight: 0,
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  page: {
    flex: 1,
    minHeight: 0,
  },

  sidebar: {
    width: SidebarWidth,
    height: '100%',
    borderRightWidth: 1,
    overflow: 'hidden',
  },

  // Wide screens: a rounded panel, like the mockups.
  sidebarFloating: {
    borderWidth: 1,
    borderRadius: 24,
    boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)',
  },

  logo: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: Spacing.five,
    paddingHorizontal: Spacing.three,
  },

  itemsScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },

  items: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
    paddingHorizontal: Spacing.three,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  itemLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },

  itemLabelActive: {
    fontWeight: '700',
  },

  soon: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  pressed: {
    opacity: 0.75,
  },

  art: {
    flex: 1,
    minHeight: 220,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },

  artImage: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },

  tagline: {
    // Above the picture and its fade.
    position: 'relative',
    zIndex: 1,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '500',
    padding: Spacing.four,
  },

  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: 1,
  },

  menuButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  drawerLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    zIndex: 30,
  },

  drawer: {
    // Above the backdrop.
    position: 'relative',
    zIndex: 1,
    height: '100%',
    boxShadow: '8px 0 32px rgba(0, 0, 0, 0.35)',
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 12, 25, 0.5)',
  },
});
