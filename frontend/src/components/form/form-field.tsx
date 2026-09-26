import type { PropsWithChildren } from 'react';
import {
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ThemeColors = (typeof Colors)[keyof typeof Colors];

type FormFieldProps = PropsWithChildren<{
  label: string;
  error?: string;
  hint?: string;
}>;

/**
 * Label + control + error/hint text. Wrap any form control in this.
 */
export function FormField({ label, error, hint, children }: FormFieldProps) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>

      {children}

      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function inputStyle(colors: ThemeColors, hasError = false) {
  return {
    ...styles.input,
    color: colors.text,
    backgroundColor: colors.backgroundElement,
    borderColor: hasError ? colors.danger : colors.border,
  };
}

// The shared input style sets paddingHorizontal, which beats paddingLeft /
// paddingRight on web; drop it so an icon can sit inside the field.
export function withoutSidePadding<T extends { paddingHorizontal?: unknown }>(
  style: T,
) {
  const { paddingHorizontal: _unused, ...rest } = style;
  return rest;
}

type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({ label, error, hint, ...inputProps }: TextFieldProps) {
  const colors = useTheme();

  return (
    <FormField label={label} error={error} hint={hint}>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={inputStyle(colors, Boolean(error))}
        {...inputProps}
      />
    </FormField>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: Spacing.four,
    fontSize: 16,
  },
});
