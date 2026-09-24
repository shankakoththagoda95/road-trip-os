import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/form/primary-button';
import { StepProgress } from '@/components/new-trip/step-progress';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getTripStep, type TripStepId } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';

const backgroundImage = require('@/assets/images/back1.jpeg');

type WizardStepScreenProps = PropsWithChildren<{
  stepId: TripStepId;
  onContinue: () => void;
  continueLabel?: string;
  continueLoading?: boolean;
  continueDisabled?: boolean;
}>;

/**
 * Shared frame for every new-trip step: progress, title, form card and
 * Back / Continue buttons.
 */
export function WizardStepScreen({
  stepId,
  onContinue,
  continueLabel = 'Continue',
  continueLoading = false,
  continueDisabled = false,
  children,
}: WizardStepScreenProps) {
  const router = useRouter();
  const { step, previous } = getTripStep(stepId);

  function goBack() {
    if (previous?.href) {
      router.navigate(previous.href);
    } else {
      router.navigate('/trips/new');
    }
  }

  return (
    <Screen
      backgroundImage={backgroundImage}
      overlayOpacity={0.55}
      maxWidth={800}>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.navigate('/trips/new')}
        style={({ pressed }) => [styles.overviewLink, pressed && styles.pressed]}>
        <ThemedText type="smallBold" style={styles.lightText}>
          ← All steps
        </ThemedText>
      </Pressable>

      <StepProgress currentStepId={stepId} />

      <View style={styles.header}>
        <ThemedText type="title" style={styles.title}>
          {step.emoji} {step.title}
        </ThemedText>

        <ThemedText style={styles.subtitle}>{step.description}</ThemedText>
      </View>

      <ThemedView type="card" style={styles.card}>
        {children}
      </ThemedView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={goBack}
          style={({ pressed }) => [
            styles.button,
            styles.backButton,
            pressed && styles.pressed,
          ]}>
          <ThemedText style={styles.buttonText}>Back</ThemedText>
        </Pressable>

        <View style={styles.continueButton}>
          <PrimaryButton
            label={continueLabel}
            onPress={onContinue}
            loading={continueLoading}
            disabled={continueDisabled}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  overviewLink: {
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
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
  },

  subtitle: {
    color: '#CBD5E1',
  },

  card: {
    padding: Spacing.four,
    borderRadius: 18,
    gap: Spacing.three,
  },

  footer: {
    flexDirection: 'row',
    gap: Spacing.three,
  },

  button: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },

  backButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },

  continueButton: {
    flex: 1,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.8,
  },
});
