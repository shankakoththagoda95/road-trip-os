import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { type TripStepId, TripSteps } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';

/**
 * Numbered circles for all planner steps, joined by lines. The current step
 * is blue, finished steps show a tick. Scrolls sideways on narrow screens.
 */
export function PlannerStepper({ currentStepId }: { currentStepId: TripStepId }) {
  const colors = useTheme();
  const router = useRouter();
  const { completedSteps } = useTripDraft();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.track}>
      {TripSteps.map((step, index) => {
        const current = step.id === currentStepId;
        const complete = completedSteps.has(step.id) && !current;
        const reachable =
          current || complete || completedSteps.has(TripSteps[index - 1]?.id);

        const circleColor = current
          ? colors.primary
          : complete
            ? colors.success
            : 'transparent';

        return (
          <Fragment key={step.id}>
            {index > 0 && (
              <View
                style={[
                  styles.line,
                  {
                    backgroundColor:
                      complete || current ? colors.primary : colors.border,
                  },
                ]}
              />
            )}

            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Step ${index + 1}: ${step.title}`}
              accessibilityState={{ selected: current, disabled: !reachable }}
              disabled={!reachable || !step.href || current}
              onPress={() => step.href && router.navigate(step.href)}
              style={({ hovered }) => [
                styles.step,
                hovered && reachable && !current && styles.hovered,
              ]}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: circleColor,
                    borderColor:
                      current || complete ? circleColor : colors.border,
                  },
                  current && styles.currentCircle,
                ]}>
                {complete ? (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                ) : (
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: current ? '#FFFFFF' : colors.textSecondary,
                    }}>
                    {index + 1}
                  </ThemedText>
                )}
              </View>
              <ThemedText
                type="small"
                numberOfLines={2}
                style={[
                  styles.label,
                  {
                    color: current ? colors.primary : colors.textSecondary,
                    fontWeight: current ? '700' : '500',
                  },
                ]}>
                {step.title}
              </ThemedText>
            </Pressable>
          </Fragment>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  track: {
    flexGrow: 1,
    alignItems: 'flex-start',
    paddingVertical: Spacing.one,
  },

  step: {
    width: 84,
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    paddingVertical: Spacing.one,
  },

  hovered: {
    opacity: 0.75,
  },

  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  currentCircle: {
    boxShadow: '0 0 0 5px rgba(37, 99, 235, 0.18)',
  },

  label: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },

  line: {
    flexGrow: 1,
    minWidth: 12,
    height: 2,
    marginTop: Spacing.one + 17,
    borderRadius: 1,
  },
});
