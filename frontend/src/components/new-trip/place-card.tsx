import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { MarkerColors } from '@/components/route-map/types';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { usePlaceLookup } from '@/hooks/use-place-lookup';
import { MaxStayNights } from '@/utils/stays';
import { useTheme } from '@/hooks/use-theme';
import type { RoutePlace } from '@/hooks/use-trip-draft';

export const PlaceCardWidth = 190;

type PlaceCardProps = {
  // The place as typed in the draft.
  text: string;
  // "S" for the start, or the stop number.
  badge: string;
  kind: 'start' | 'stop' | 'destination';
  // Coordinates already known for this place, if any.
  known: RoutePlace | null;
  // Stores the coordinates Google found, so the Route step can skip
  // looking the place up again.
  onFound: (place: RoutePlace) => void;
  onRemove?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  // Nights spent here; the stepper shows when onNightsChange is given.
  nights?: number;
  onNightsChange?: (nights: number) => void;
};

/**
 * A place in the route with its Google photo (or a placeholder), name and
 * country. Photo credits are shown as Google requires.
 */
export function PlaceCard({
  text,
  badge,
  kind,
  known,
  onFound,
  onRemove,
  onMoveLeft,
  onMoveRight,
  nights = 0,
  onNightsChange,
}: PlaceCardProps) {
  const colors = useTheme();
  const { status, place } = usePlaceLookup(text);

  useEffect(() => {
    if (place && !known) {
      onFound({
        location: text,
        displayName: place.address || place.name,
        latitude: place.latitude,
        longitude: place.longitude,
      });
    }
  }, [place, known, text, onFound]);

  const country = place?.country ?? known?.displayName.split(',').at(-1)?.trim();
  const credit = place?.photo_url ? place.photo_attributions[0] : undefined;

  return (
    <View
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
      ]}>
      <View style={[styles.photo, { backgroundColor: colors.backgroundSelected }]}>
        {place?.photo_url ? (
          <Image
            source={{ uri: place.photo_url }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={`Photo of ${place.name}`}
          />
        ) : status === 'loading' ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons
            name={kind === 'start' ? 'home-outline' : 'image-outline'}
            size={34}
            color={colors.textSecondary}
          />
        )}

        <View style={[styles.badge, { backgroundColor: MarkerColors[kind] }]}>
          <ThemedText type="smallBold" style={styles.badgeText}>
            {badge}
          </ThemedText>
        </View>

        {onRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${text}`}
            onPress={onRemove}
            style={({ hovered }) => [styles.remove, hovered && styles.removeHover]}>
            <Ionicons name="close" size={16} color="#FFFFFF" />
          </Pressable>
        )}
      </View>

      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {place?.name ?? text}
        </ThemedText>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={styles.meta}>
            {kind === 'start' ? 'Starting point' : country || 'Stop'}
          </ThemedText>
        </View>

        {credit ? (
          <Pressable
            accessibilityRole="link"
            disabled={!credit.url}
            onPress={() => credit.url && Linking.openURL(credit.url)}>
            <ThemedText
              numberOfLines={1}
              style={[styles.credit, { color: colors.textSecondary }]}>
              Photo: {credit.name} · Google
            </ThemedText>
          </Pressable>
        ) : (
          <View style={styles.creditSpace} />
        )}

        {onNightsChange && (
          <NightsStepper
            place={place?.name ?? text}
            nights={nights}
            onChange={onNightsChange}
          />
        )}

        {(onMoveLeft || onMoveRight) && (
          <View style={styles.moveRow}>
            <MoveButton
              icon="chevron-back"
              label={`Move ${text} earlier`}
              onPress={onMoveLeft}
            />
            <MoveButton
              icon="chevron-forward"
              label={`Move ${text} later`}
              onPress={onMoveRight}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * − / + for the nights spent at a place. 0 means driving straight through.
 */
function NightsStepper({
  place,
  nights,
  onChange,
}: {
  place: string;
  nights: number;
  onChange: (nights: number) => void;
}) {
  const colors = useTheme();
  const staying = nights > 0;

  return (
    <View
      style={[
        styles.nights,
        {
          borderColor: staying ? 'rgba(129, 140, 248, 0.55)' : colors.border,
          backgroundColor: staying ? 'rgba(129, 140, 248, 0.12)' : 'transparent',
        },
      ]}>
      <NightsButton
        icon="minus"
        label={`Fewer nights in ${place}`}
        disabled={nights <= 0}
        onPress={() => onChange(nights - 1)}
      />
      <View
        style={styles.nightsValue}
        accessible
        accessibilityLabel={`${nights} ${nights === 1 ? 'night' : 'nights'} in ${place}`}>
        <MaterialCommunityIcons
          name={staying ? 'weather-night' : 'car-arrow-right'}
          size={15}
          color={staying ? '#818CF8' : colors.textSecondary}
        />
        <ThemedText
          type="smallBold"
          style={[styles.nightsText, !staying && { color: colors.textSecondary }]}>
          {staying ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : 'Pass through'}
        </ThemedText>
      </View>
      <NightsButton
        icon="plus"
        label={`More nights in ${place}`}
        disabled={nights >= MaxStayNights}
        onPress={() => onChange(nights + 1)}
      />
    </View>
  );
}

function NightsButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'minus' | 'plus';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered }) => [
        styles.nightsButton,
        { backgroundColor: colors.backgroundSelected },
        hovered && !disabled && { backgroundColor: colors.border },
        disabled && styles.moveDisabled,
      ]}>
      <MaterialCommunityIcons name={icon} size={14} color={colors.text} />
    </Pressable>
  );
}

function MoveButton({
  icon,
  label,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  onPress?: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ hovered }) => [
        styles.move,
        { borderColor: colors.border },
        hovered && { backgroundColor: colors.backgroundSelected },
        !onPress && styles.moveDisabled,
      ]}>
      <Ionicons name={icon} size={14} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: PlaceCardWidth,
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },

  photo: {
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },

  badge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
  },

  remove: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3, 12, 25, 0.55)',
  },

  removeHover: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },

  info: {
    padding: Spacing.two + Spacing.one,
    gap: Spacing.half,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },

  meta: {
    flex: 1,
  },

  credit: {
    fontSize: 10,
    lineHeight: 14,
    textDecorationLine: 'underline',
  },

  creditSpace: {
    height: 14,
  },

  nights: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    padding: Spacing.half,
    marginTop: Spacing.one,
  },

  nightsButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  nightsValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },

  nightsText: {
    fontSize: 13,
  },

  moveRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },

  move: {
    width: 28,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moveDisabled: {
    opacity: 0.35,
  },
});
