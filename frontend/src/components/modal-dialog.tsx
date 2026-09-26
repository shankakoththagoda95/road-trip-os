import Ionicons from '@expo/vector-icons/Ionicons';
import { type PropsWithChildren, useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  type ImageSourcePropType,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { BlurBackdrop } from '@/components/blur-backdrop';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Open / close animation length (matches the backdrop's CSS transition).
const AnimationMs = 240;

/**
 * Centred popup over a dimmed, blurred page. Closes with the ✕ button, a
 * click on the backdrop, or Escape (web) / back button (Android).
 */
export function ModalDialog({
  visible,
  title,
  subtitle,
  onClose,
  maxWidth = 640,
  headerImage,
  children,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  // Wider for charts and maps.
  maxWidth?: number;
  // Photo behind the title (shaded, with white text).
  headerImage?: ImageSourcePropType;
}>) {
  const colors = useTheme();

  // 0 = hidden, 1 = shown. Drives the card's fade / scale.
  const [progress] = useState(() => new Animated.Value(0));

  // Stay mounted while the closing animation runs.
  const [closing, setClosing] = useState(false);
  const [previousVisible, setPreviousVisible] = useState(visible);

  if (visible !== previousVisible) {
    setPreviousVisible(visible);
    setClosing(!visible);
  }

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: AnimationMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !visible) {
        setClosing(false);
      }
    });

    return () => animation.stop();
  }, [visible, progress]);

  return (
    <Modal
      visible={visible || closing}
      transparent
      // Animated here instead: the built-in fade makes the blur pop in.
      animationType="none"
      onRequestClose={onClose}>
      <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.backdrop}>
          <BlurBackdrop open={visible} progress={progress} />
        </Pressable>

        <Animated.View
          style={[
            styles.dialogFrame,
            {
              maxWidth,
              opacity: progress,
              transform: [
                {
                  scale: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [12, 0],
                  }),
                },
              ],
            },
          ]}>
          <ThemedView
            type="card"
            accessibilityViewIsModal
            style={[styles.dialog, { borderColor: colors.border }]}>
            {headerImage ? (
              <ImageBackground
                source={headerImage}
                resizeMode="cover"
                style={styles.imageHeader}
                imageStyle={styles.imageHeaderPhoto}>
                <View style={styles.imageHeaderShade} />
                <View style={styles.headerText}>
                  <ThemedText
                    type="smallBold"
                    style={[styles.title, styles.imageTitle]}>
                    {title}
                  </ThemedText>
                  {subtitle && (
                    <ThemedText type="small" style={styles.imageSubtitle}>
                      {subtitle}
                    </ThemedText>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  style={({ hovered, pressed }) => [
                    styles.close,
                    styles.imageClose,
                    (hovered || pressed) && styles.imageCloseHover,
                  ]}>
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </ImageBackground>
            ) : (
              <View
                style={[styles.header, { borderBottomColor: colors.border }]}>
                <View style={styles.headerText}>
                  <ThemedText type="smallBold" style={styles.title}>
                    {title}
                  </ThemedText>
                  {subtitle && (
                    <ThemedText type="small" themeColor="textSecondary">
                      {subtitle}
                    </ThemedText>
                  )}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  style={({ hovered, pressed }) => [
                    styles.close,
                    (hovered || pressed) && {
                      backgroundColor: colors.backgroundSelected,
                    },
                  ]}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
            )}

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </ThemedView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  imageHeader: {
    minHeight: 150,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
    padding: Spacing.four,
  },

  imageHeaderPhoto: {
    width: '100%',
    height: '100%',
  },

  imageHeaderShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(3, 12, 25, 0.5)',
  },

  imageTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 30,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowRadius: 6,
  },

  imageSubtitle: {
    color: '#E2E8F0',
  },

  imageClose: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(3, 12, 25, 0.45)',
  },

  imageCloseHover: {
    backgroundColor: 'rgba(3, 12, 25, 0.7)',
  },

  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },

  backdrop: {
    ...StyleSheet.absoluteFill,
  },

  dialogFrame: {
    width: '100%',
    maxHeight: '92%',
  },

  dialog: {
    width: '100%',
    // Shrinks to the frame's max height so the body scrolls.
    flexShrink: 1,
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.35)',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.three,
    borderBottomWidth: 1,
  },

  headerText: {
    flex: 1,
    gap: Spacing.half,
  },

  title: {
    fontSize: 20,
    lineHeight: 26,
  },

  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  body: {
    flexGrow: 0,
    flexShrink: 1,
  },

  bodyContent: {
    padding: Spacing.four,
  },
});
