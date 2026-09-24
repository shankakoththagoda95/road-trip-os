import { TextInput } from 'react-native';

import { inputStyle } from '@/components/form/form-field';
import { useTheme } from '@/hooks/use-theme';

export type DateInputProps = {
  mode: 'date' | 'time';
  // `YYYY-MM-DD` for dates, `HH:MM` for times.
  value: string;
  onChange: (value: string) => void;
  accessibilityLabel: string;
  min?: string;
  hasError?: boolean;
};

/**
 * Native fallback: typed input. The web version uses the browser's picker.
 * TODO: switch to a native date picker when mobile gets its polish pass.
 */
export function DateInput({
  mode,
  value,
  onChange,
  accessibilityLabel,
  hasError,
}: DateInputProps) {
  const colors = useTheme();

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      value={value}
      onChangeText={onChange}
      placeholder={mode === 'date' ? 'YYYY-MM-DD' : 'HH:MM'}
      placeholderTextColor={colors.textSecondary}
      keyboardType="numbers-and-punctuation"
      maxLength={mode === 'date' ? 10 : 5}
      style={inputStyle(colors, hasError)}
    />
  );
}
