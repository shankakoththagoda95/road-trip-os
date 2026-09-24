import type { DateInputProps } from '@/components/form/date-input';
import { inputStyle } from '@/components/form/form-field';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Uses the browser's built-in date / time picker.
 */
export function DateInput({
  mode,
  value,
  onChange,
  accessibilityLabel,
  min,
  hasError,
}: DateInputProps) {
  const colors = useTheme();
  const { theme } = useAppTheme();
  const base = inputStyle(colors, hasError);

  return (
    <input
      type={mode}
      aria-label={accessibilityLabel}
      aria-invalid={hasError}
      value={value}
      min={min}
      onChange={(event) => onChange(event.target.value)}
      style={{
        height: base.height,
        borderWidth: base.borderWidth,
        borderStyle: 'solid',
        borderColor: base.borderColor,
        borderRadius: base.borderRadius,
        paddingLeft: base.paddingHorizontal,
        paddingRight: base.paddingHorizontal,
        fontSize: base.fontSize,
        fontFamily: 'inherit',
        color: base.color,
        backgroundColor: base.backgroundColor,
        // Makes the picker icon and popup follow the app theme.
        colorScheme: theme,
        boxSizing: 'border-box',
        width: '100%',
      }}
    />
  );
}
