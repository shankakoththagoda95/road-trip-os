import {
  Image,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipSelectProps<T extends string> = {
  options: readonly {
    value: T;
    label: string;
    emoji?: string;
    // Small picture shown before the label.
    image?: ImageSourcePropType;
  }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Single choice from a wrapping row of chips. Use instead of
 * SegmentedControl when there are more than ~3 options.
 */
export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: ChipSelectProps<T>) {
  const colors = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={styles.container}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected
                  ? colors.primary
                  : colors.backgroundElement,
                borderColor: selected ? colors.primary : colors.border,
              },
              pressed && styles.pressed,
            ]}>
            {option.image && (
              <Image
                source={option.image}
                style={styles.image}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            )}
            <ThemedText
              type="smallBold"
              style={selected ? styles.selectedText : undefined}
              themeColor={selected ? undefined : 'textSecondary'}>
              {option.emoji ? `${option.emoji} ` : ''}
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 24,
    height: 24,
  },

  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },

  selectedText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.8,
  },
});
