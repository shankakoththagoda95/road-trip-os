import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type TripStepId, TripSteps } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';

type StepProgressProps = {
  // The step being edited. Omit on the overview to show overall progress.
  currentStepId?: TripStepId;
};

/**
 * One segment per wizard step: filled when complete, outlined when current.
 * Meant to sit on the dark background overlay, so text is light.
 */
export function StepProgress({ currentStepId }: StepProgressProps) {
  const colors = useTheme();
  const { completedSteps } = useTripDraft();

  const currentIndex = TripSteps.findIndex(
    (step) => step.id === currentStepId,
  );
  const label =
    currentIndex >= 0
      ? `Step ${currentIndex + 1} of ${TripSteps.length}`
      : `${completedSteps.size} of ${TripSteps.length} steps completed`;

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold" style={styles.label}>
        {label}
      </ThemedText>

      <View
        style={styles.segments}
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: TripSteps.length,
          now: completedSteps.size,
        }}>
        {TripSteps.map((step) => {
          const complete = completedSteps.has(step.id);
          const current = step.id === currentStepId;

          return (
            <View
              key={step.id}
              style={[
                styles.segment,
                complete && { backgroundColor: colors.success },
                current && {
                  backgroundColor: colors.primary,
                  borderColor: '#FFFFFF',
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },

  label: {
    color: '#CBD5E1',
  },

  segments: {
    flexDirection: 'row',
    gap: Spacing.one,
  },

  segment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
});
