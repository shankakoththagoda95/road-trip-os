import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StepperProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: (value: number) => string;
};

/**
 * Number input with − / + buttons that change the value by `step`.
 */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  unit,
}: StepperProps) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: colors.border,
        },
      ]}>
      <StepButton
        symbol="−"
        accessibilityLabel={`Decrease ${label}`}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - step))}
      />

      <ThemedText
        accessibilityLabel={`${label}: ${value}`}
        style={styles.value}>
        {value}
        {unit ? ` ${unit(value)}` : ''}
      </ThemedText>

      <StepButton
        symbol="+"
        accessibilityLabel={`Increase ${label}`}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + step))}
      />
    </View>
  );
}

function StepButton({
  symbol,
  accessibilityLabel,
  disabled,
  onPress,
}: {
  symbol: string;
  accessibilityLabel: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.backgroundSelected },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}>
      <ThemedText style={styles.buttonText}>{symbol}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    borderWidth: 1,
    borderRadius: 26,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
  },

  value: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },

  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
  },

  pressed: {
    opacity: 0.7,
  },

  disabled: {
    opacity: 0.35,
  },
});
