import { useRouter } from 'expo-router';
import {
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { StepProgress } from '@/components/new-trip/step-progress';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { type TripStep, TripSteps } from '@/constants/trip-steps';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';

const backgroundImage = require('@/assets/images/back.jpeg');

// Below this width step cards use a smaller thumbnail and drop the arrow.
const CompactBreakpoint = 640;

export default function NewTripScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < CompactBreakpoint;
  const { completedSteps } = useTripDraft();

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
      <View
        style={[
          styles.thumbnail,
          compact && styles.thumbnailCompact,
          { backgroundColor: colors.backgroundSelected },
        ]}>
        {step.image ? (
          <Image
            source={step.image}
            resizeMode="contain"
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
        <ThemedText themeColor="textSecondary" style={styles.arrow}>
          ›
        </ThemedText>
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

  card: {
    borderWidth: 1,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.two,
    paddingRight: Spacing.three,
    gap: Spacing.three,
  },

  thumbnail: {
    width: 120,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  thumbnailCompact: {
    width: 64,
    height: 64,
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

  arrow: {
    fontSize: 32,
    lineHeight: 36,
  },

  pressed: {
    opacity: 0.8,
  },

  disabled: {
    opacity: 0.6,
  },
});
