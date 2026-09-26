import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { PlannerStepper } from '@/components/new-trip/planner-stepper';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep, type TripStepId } from '@/constants/trip-steps';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const sideImage = require('@/assets/images/brand/planner-side.png');

// Window width from which the photo panel sits beside the form.
const SidePanelMinWidth = 1180;

type PlannerFrameProps = PropsWithChildren<{
  stepId: TripStepId;
  // Shown on the left of the footer, e.g. a journey summary.
  summary?: ReactNode;
  onNext: () => void;
  // Defaults to "Next: <next step>".
  nextLabel?: string;
  nextLoading?: boolean;
  nextDisabled?: boolean;
  // Photo panel beside the form on wide screens.
  showArt?: boolean;
  // A step's own side panel (e.g. a cost breakdown): beside the form on
  // wide screens, below it on narrow ones. Replaces the photo panel.
  aside?: ReactNode;
}>;

/**
 * Page frame for every planner step: title, numbered stepper, the form card
 * (optionally with a photo panel on wide screens) and a footer with
 * Back / Next.
 */
export function PlannerFrame({
  stepId,
  summary,
  onNext,
  nextLabel,
  nextLoading = false,
  nextDisabled = false,
  showArt = false,
  aside,
  children,
}: PlannerFrameProps) {
  const colors = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { step, previous, next } = getTripStep(stepId);

  // "Trip Details" -> "Trip" + "Details" (the last word is highlighted).
  const words = step.title.split(' ');
  const highlighted = words.pop();

  const wide = width >= SidePanelMinWidth;
  const showSidePanel = showArt && !aside && wide;

  return (
    <Screen maxWidth={1240}>
      <View style={styles.header}>
        {step.image && (
          <View
            style={[styles.headerIcon, { backgroundColor: colors.backgroundSelected }]}>
            <Image source={step.image} style={styles.headerIconImage} />
          </View>
        )}
        <View style={styles.headerText}>
          <ThemedText type="title" style={styles.title}>
            {words.join(' ')}{' '}
            <ThemedText
              type="title"
              style={[styles.title, { color: colors.primary }]}>
              {highlighted}
            </ThemedText>
          </ThemedText>
          <ThemedText themeColor="textSecondary">{step.description}</ThemedText>
        </View>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/trips/new')}
          style={({ hovered, pressed }) => [
            styles.allSteps,
            { borderColor: colors.border },
            (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
          ]}>
          <Ionicons name="grid-outline" size={16} color={colors.text} />
          <ThemedText type="smallBold">All steps</ThemedText>
        </Pressable>
      </View>

      <ThemedView
        type="card"
        style={[styles.panel, styles.stepper, { borderColor: colors.border }]}>
        <PlannerStepper currentStepId={stepId} />
      </ThemedView>

      <ThemedView
        type="card"
        style={[
          styles.panel,
          styles.body,
          !wide && styles.stackedBody,
          { borderColor: colors.border },
        ]}>
        <View style={styles.form}>{children}</View>

        {aside && (
          <View style={wide ? styles.aside : styles.stackedAside}>{aside}</View>
        )}

        {showSidePanel && (
          <ImageBackground
            source={sideImage}
            resizeMode="cover"
            style={styles.side}
            imageStyle={styles.sideImage}>
            <View style={styles.sideShade} />
            <View style={styles.sideWords}>
            </View>
            <ThemedText style={styles.sideCaption}>
              Every great road trip starts with a plan.
            </ThemedText>
          </ImageBackground>
        )}
      </ThemedView>

      <ThemedView
        type="card"
        style={[styles.panel, styles.footer, { borderColor: colors.border }]}>
        <View style={styles.summary}>{summary}</View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              router.navigate(previous?.href ?? '/trips/new')
            }
            style={({ hovered, pressed }) => [
              styles.button,
              styles.backButton,
              { borderColor: colors.border },
              (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
            ]}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
            <ThemedText type="smallBold">Back</ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: nextDisabled, busy: nextLoading }}
            disabled={nextDisabled || nextLoading}
            onPress={onNext}
            style={({ hovered, pressed }) => [
              styles.button,
              { backgroundColor: colors.primary },
              (hovered || pressed) && styles.pressed,
              nextDisabled && styles.disabled,
            ]}>
            {nextLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <ThemedText type="smallBold" style={styles.nextText}>
                  {nextLabel ?? (next ? `Next: ${next.title}` : 'Finish')}
                </ThemedText>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </>
            )}
          </Pressable>
        </View>
      </ThemedView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIconImage: {
    width: 46,
    height: 46,
    resizeMode: 'contain',
  },

  headerText: {
    flex: 1,
    gap: Spacing.half,
  },

  title: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '800',
  },

  allSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  panel: {
    borderWidth: 1,
    borderRadius: 20,
  },

  stepper: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },

  body: {
    flexDirection: 'row',
    padding: Spacing.four,
    gap: Spacing.four,
  },

  stackedBody: {
    flexDirection: 'column',
  },

  aside: {
    width: 380,
  },

  stackedAside: {
    alignSelf: 'stretch',
  },

  form: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.four,
  },

  side: {
    width: 300,
    minHeight: 560,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: Spacing.four,
  },

  sideImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },

  sideShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 12, 25, 0.35)',
  },

  sideWords: {
    gap: Spacing.one,
  },

  sideWord: {
    color: '#FFFFFF',
    fontFamily: Fonts?.serif,
    fontStyle: 'italic',
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowRadius: 8,
  },

  sideCaption: {
    color: '#F1F5F9',
    fontSize: 15,
    lineHeight: 22,
  },

  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },

  summary: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 280,
  },

  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },

  button: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },

  backButton: {
    borderWidth: 1,
  },

  nextText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },

  disabled: {
    opacity: 0.5,
  },
});
