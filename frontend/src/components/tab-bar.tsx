import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TabItem<T extends string> = {
  id: T;
  label: string;
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
};

/**
 * Row of tabs (scrolls sideways on narrow screens). The selected tab is
 * filled with the primary colour.
 */
export function TabBar<T extends string>({
  tabs,
  selected,
  onSelect,
  accessibilityLabel,
}: {
  tabs: TabItem<T>[];
  selected: T;
  onSelect: (id: T) => void;
  accessibilityLabel: string;
}) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.frame,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
      ]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
        contentContainerStyle={styles.tabs}>
        {tabs.map((tab) => {
          const active = tab.id === selected;

          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              aria-selected={active}
              onPress={() => onSelect(tab.id)}
              style={({ hovered }) => [
                styles.tab,
                active && { backgroundColor: colors.primary },
                hovered && !active && { backgroundColor: colors.backgroundSelected },
              ]}>
              <MaterialCommunityIcons
                name={tab.icon}
                size={18}
                color={active ? '#FFFFFF' : colors.textSecondary}
              />
              <ThemedText
                type="smallBold"
                style={{ color: active ? '#FFFFFF' : colors.textSecondary }}>
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.one,
  },

  tabs: {
    flexGrow: 1,
    gap: Spacing.one,
  },

  tab: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },
});
