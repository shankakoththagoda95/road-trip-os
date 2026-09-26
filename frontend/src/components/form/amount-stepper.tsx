import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextStyle,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parseNumber } from '@/utils/numbers';

// Web: drop the browser focus ring; the pill's border shows focus instead.
const NoOutline = { outlineStyle: 'none' } as unknown as TextStyle;

type AmountStepperProps = {
  label: string;
  // The typed text, kept as-is so partial input like "1." survives.
  value: string;
  onChange: (value: string) => void;
  step: number;
  // Decimal places used when − / + rewrite the value.
  decimals?: number;
  // Shown after the number, e.g. "€/L".
  unit?: string;
};

/**
 * Editable amount with − / + buttons. Empty means "not set"; + starts
 * from zero.
 */
export function AmountStepper({
  label,
  value,
  onChange,
  step,
  decimals = 0,
  unit,
}: AmountStepperProps) {
  const colors = useTheme();
  const current = parseNumber(value) ?? 0;
  const [focused, setFocused] = useState(false);

  function change(offset: number) {
    const next = Math.max(0, current + offset);
    onChange(next.toFixed(decimals));
  }

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: focused ? colors.primary : colors.border,
          backgroundColor: colors.backgroundElement,
        },
      ]}>
      <StepButton
        icon="remove"
        label={`Decrease ${label}`}
        disabled={current <= 0}
        onPress={() => change(-step)}
      />

      <View style={styles.middle}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, NoOutline, { color: colors.text }]}
        />
        {unit && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
            {unit}
          </ThemedText>
        )}
      </View>

      <StepButton
        icon="add"
        label={`Increase ${label}`}
        onPress={() => change(step)}
      />
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled = false,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.button,
        { backgroundColor: colors.backgroundSelected },
        (hovered || pressed) && !disabled && { backgroundColor: colors.border },
        disabled && styles.disabled,
      ]}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: Spacing.one,
  },

  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabled: {
    opacity: 0.4,
  },

  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },

  input: {
    flex: 1,
    minWidth: 0,
    height: 48,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },

  unit: {
    minWidth: 32,
    textAlign: 'right',
  },
});
