/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#172033',
    background: '#F7F9FC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E8EEF8',
    textSecondary: '#5B6475',

    primary: '#2563EB',
    secondary: '#0D9488',
    accent: '#F97316',
    highlight: '#FBBF24',

    success: '#16A34A',
    warning: '#D97706',
    danger: '#DC2626',
    info: '#0284C7',

    border: '#DCE3EF',
    card: '#FFFFFF',
  },

  dark: {
    text: '#F4F7FB',
    background: '#101827',
    backgroundElement: '#182235',
    backgroundSelected: '#24344D',
    textSecondary: '#AAB6C8',

    primary: '#60A5FA',
    secondary: '#2DD4BF',
    accent: '#FB923C',
    highlight: '#FACC15',

    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#38BDF8',

    border: '#30415C',
    card: '#1C293D',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
