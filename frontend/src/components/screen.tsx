import type { PropsWithChildren, Ref } from 'react';
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

type ScreenProps = PropsWithChildren<{
  maxWidth?: number;
  backgroundImage?: ImageSourcePropType;
  overlayOpacity?: number;
  // Screens inside the tab navigator need room for the native bottom tab
  // bar. (On web the sidebar sits beside the page instead.)
  hasTabBar?: boolean;
  // For pages that scroll programmatically (e.g. "jump to section").
  scrollRef?: Ref<ScrollView>;
  // Use the whole width (no max width) and start right under the header.
  fullWidth?: boolean;
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
  scrollRef,
  fullWidth = false,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  const paddingTop =
    Platform.OS === 'web'
      ? fullWidth
        ? Spacing.two
        : Spacing.five
      : insets.top + Spacing.three;
  const paddingBottom =
    Spacing.five + (hasTabBar ? BottomTabInset : insets.bottom);

  const content = (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={{ paddingTop, paddingBottom }}
      keyboardShouldPersistTaps="handled">
      <View style={[styles.content, !fullWidth && { maxWidth }]}>
        {children}
      </View>
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
