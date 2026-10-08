import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageStyle,
} from 'react-native';

import { StepProgress } from '@/components/new-trip/step-progress';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { type TripStep, TripSteps } from '@/constants/trip-steps';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';

// Web: ease the opacity change on hover.
const BackgroundFade = {
  transitionProperty: 'opacity',
  transitionDuration: '250ms',
} as unknown as ImageStyle;

const backgroundImage = require('@/assets/images/back.jpeg');

// Below this width step cards use a smaller thumbnail and drop the arrow.
const CompactBreakpoint = 640;

// Background behind the step icons (see assets/images/step-icons).
export default function NewTripScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < CompactBreakpoint;
  const { completedSteps, draft, isPristine, restored, reset } = useTripDraft();
  const [confirmingReset, setConfirmingReset] = useState(false);

  // First unfinished step that has been built.
  const nextStep = TripSteps.find(
    (step) => step.href && !completedSteps.has(step.id),
  );

  function exit() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  return (
    <Screen
      backgroundImage={backgroundImage}
      overlayOpacity={0.48}
      maxWidth={1000}>
      <Pressable
        accessibilityRole="link"
        onPress={exit}
        style={({ pressed }) => [styles.exitLink, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={styles.lightText}>
          ← Exit
        </ThemedText>
      </Pressable>

      <View style={styles.header}>
        <ThemedText style={[styles.title, compact && styles.titleCompact]}>
          Plan a New Trip
        </ThemedText>

        <ThemedText style={styles.subtitle}>
          Let&apos;s build your road adventure step by step.
        </ThemedText>
      </View>

      <StepProgress />

      {!isPristine && (
        <View style={styles.draftBar}>
          {confirmingReset ? (
            <>
              <ThemedText type="small" style={styles.mutedLightText}>
                Discard this draft and start again?
              </ThemedText>
              <View style={styles.draftActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    reset();
                    setConfirmingReset(false);
                  }}>
                  <ThemedText type="smallBold" style={styles.dangerText}>
                    Discard
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmingReset(false)}>
                  <ThemedText type="smallBold" style={styles.lightText}>
                    Keep it
                  </ThemedText>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <ThemedText type="small" style={styles.mutedLightText}>
                {restored
                  ? `Welcome back! Your draft${draft.details.name ? ` “${draft.details.name}”` : ''} was restored.`
                  : 'Your draft is saved on this device.'}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => setConfirmingReset(true)}>
                <ThemedText type="smallBold" style={styles.lightText}>
                  Start over
                </ThemedText>
              </Pressable>
            </>
          )}
        </View>
      )}

      {nextStep?.href && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(nextStep.href!)}
          style={({ pressed }) => [
            styles.nextButton,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}>
          <ThemedText style={styles.nextButtonText}>
            {completedSteps.size === 0
              ? 'Start planning'
              : `Continue: ${nextStep.title}`}{' '}
            →
          </ThemedText>
        </Pressable>
      )}

      <View style={styles.cards}>
        {TripSteps.map((step, index) => (
          <TripStepCard
            key={step.id}
            step={step}
            number={index + 1}
            complete={completedSteps.has(step.id)}
            colors={colors}
            compact={compact}
            onPress={step.href ? () => router.push(step.href!) : undefined}
          />
        ))}
      </View>
    </Screen>
  );
}

type ThemeColors = (typeof Colors)[keyof typeof Colors];

function TripStepCard({
  step,
  number,
  complete,
  colors,
  compact,
  onPress,
}: {
  step: TripStep;
  number: number;
  complete: boolean;
  colors: ThemeColors;
  compact: boolean;
  onPress?: () => void;
}) {
  const disabled = !onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Step ${number}: ${step.title}${complete ? ', completed' : ''}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: `${colors.card}E6`,
          borderColor: complete ? colors.success : colors.border,
        },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      {({ hovered }) => (
        <>
          {step.background && (
            <Image
              source={step.background}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
              style={[
                styles.background,
                compact && styles.backgroundCompact,
                BackgroundFade,
                { opacity: hovered && !disabled ? 0.5 : 0.2 },
              ]}
            />
          )}

          <View
            style={[
              styles.thumbnail,
              compact && styles.thumbnailCompact,
              // The scene fades into the card on its own; emojis get a tile.
              !step.image && [
                styles.emojiTile,
                { backgroundColor: colors.backgroundSelected },
              ],
            ]}>
            {step.image ? (
              <Image
                source={step.image}
                resizeMode="cover"
                style={styles.thumbnailImage}
              />
            ) : (
              <ThemedText style={compact ? styles.emojiCompact : styles.emoji}>
                {step.emoji}
              </ThemedText>
            )}
          </View>

          <View style={styles.cardContent}>
            <View style={styles.cardTitleRow}>
              <View
                style={[
                  styles.numberBadge,
                  {
                    backgroundColor: complete ? colors.success : colors.primary,
                  },
                ]}>
                <ThemedText type="smallBold" style={styles.numberText}>
                  {complete ? '✓' : number}
                </ThemedText>
              </View>

              <ThemedText type="smallBold" style={styles.cardTitle}>
                {step.title}
              </ThemedText>
            </View>

            <ThemedText type="small" themeColor="textSecondary">
              {disabled ? 'Coming soon' : step.description}
            </ThemedText>
          </View>

          {!compact && !disabled && (
            <View
              style={[
                styles.arrow,
                {
                  borderColor: colors.border,
                  backgroundColor: hovered
                    ? colors.primary
                    : `${colors.card}CC`,
                },
              ]}>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={hovered ? '#FFFFFF' : colors.text}
              />
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  exitLink: {
    alignSelf: 'flex-start',
  },

  lightText: {
    color: '#F8FAFC',
  },

  mutedLightText: {
    color: '#CBD5E1',
    flexShrink: 1,
  },

  dangerText: {
    color: '#FCA5A5',
  },

  draftBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },

  draftActions: {
    flexDirection: 'row',
    gap: Spacing.four,
  },

  header: {
    gap: Spacing.one,
  },

  title: {
    color: '#F8FAFC',
    fontSize: 52,
    lineHeight: 60,
    fontWeight: '800',
  },

  titleCompact: {
    fontSize: 34,
    lineHeight: 40,
  },

  subtitle: {
    color: '#CBD5E1',
    fontSize: 19,
    fontWeight: '600',
  },

  nextButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },

  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  cards: {
    gap: Spacing.two,
  },

  // The picture runs to the card's left edge, so the card clips it.
  card: {
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingRight: Spacing.three,
    gap: Spacing.two,
  },

  thumbnail: {
    width: 200,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
  },

  thumbnailCompact: {
    width: 128,
    height: 72,
  },

  emojiTile: {
    width: 88,
    height: 88,
    margin: Spacing.two,
    borderRadius: 16,
  },

  thumbnailImage: {
    width: '100%',
    height: '100%',
  },

  emoji: {
    fontSize: 36,
    lineHeight: 44,
  },

  emojiCompact: {
    fontSize: 28,
    lineHeight: 34,
  },

  cardContent: {
    flex: 1,
    gap: Spacing.half,
  },

  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  numberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  numberText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
  },

  cardTitle: {
    flex: 1,
    fontSize: 17,
  },

  // Round button over the picture, as in the design.
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Right-aligned scene behind the text (it fades in from the left).
  background: {
    position: 'absolute',
    // Clicks go to the card.
    pointerEvents: 'none',
    top: 0,
    right: 0,
    bottom: 0,
    // Images don't stretch to top/bottom on their own.
    height: '100%',
    width: '62%',
  },

  backgroundCompact: {
    width: '80%',
  },

  pressed: {
    opacity: 0.8,
  },

  disabled: {
    opacity: 0.6,
  },
});
