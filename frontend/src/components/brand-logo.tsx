import { Image, StyleSheet } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

// Trimmed copies of assets/images/logo-{light,dark}.png.
const Logos = {
  // Dark artwork, for light backgrounds.
  light: require('@/assets/images/brand/logo-light.png'),
  // Light artwork, for dark backgrounds.
  dark: require('@/assets/images/brand/logo-dark.png'),
};

// Width : height of the logo artwork.
const AspectRatio = 2.55;

/**
 * Road-Trip OS logo in the version that fits the current theme, or a fixed
 * `variant` on surfaces that don't follow the theme (e.g. the dark sidebar).
 */
export function BrandLogo({
  height,
  variant,
}: {
  height: number;
  variant?: 'light' | 'dark';
}) {
  const { theme } = useAppTheme();

  return (
    <Image
      source={Logos[variant ?? theme]}
      accessibilityRole="image"
      accessibilityLabel="Road-Trip OS"
      resizeMode="contain"
      style={[styles.logo, { height, width: height * AspectRatio }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    maxWidth: '100%',
  },
});
