import type { PropsWithChildren } from 'react';
import {
  ImageBackground,
  type ImageSourcePropType,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';

// Height reserved for the floating web tab bar (see app-tabs.web.tsx).
const WebTabBarInset = 88;

type ScreenProps = PropsWithChildren<{
  maxWidth?: number;
  backgroundImage?: ImageSourcePropType;
  overlayOpacity?: number;
  // Screens inside the tab navigator need room for the tab bar
  // (floating at the top on web, at the bottom on native).
  hasTabBar?: boolean;
}>;

/**
 * Scrollable, width-constrained page container that works on web and mobile.
 */
export function Screen({
  children,
  maxWidth = 1100,
  backgroundImage,
  overlayOpacity = 0.5,
  hasTabBar = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const paddingTop =
    Platform.OS === 'web'
      ? hasTabBar
        ? WebTabBarInset
        : Spacing.five
      : insets.top + Spacing.three;
  const paddingBottom =
    Spacing.five + (hasTabBar ? BottomTabInset : insets.bottom);

  const content = (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      keyboardShouldPersistTaps="handled">
      <View style={[styles.content, { maxWidth }]}>{children}</View>
    </ScrollView>
  );

  if (backgroundImage) {
    return (
      <ImageBackground
        source={backgroundImage}
        resizeMode="cover"
        style={styles.container}>
        <View
          style={[
            styles.overlay,
            { backgroundColor: `rgba(3, 12, 25, ${overlayOpacity})` },
          ]}
        />
        {content}
      </ImageBackground>
    );
  }

  return <ThemedView style={styles.container}>{content}</ThemedView>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFill,
  },

  scroll: {
    flex: 1,
  },

  content: {
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
});
