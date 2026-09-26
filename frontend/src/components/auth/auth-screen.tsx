import { Link, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const backgroundImage = require('@/assets/images/login.jpeg');

type AuthScreenProps = PropsWithChildren<{
  title: string;
  subtitle: string;
  // Error that isn't tied to a single field, e.g. "Invalid email or password".
  formError?: string | null;
  footerText?: string;
  footerLinkLabel?: string;
  footerHref?: Href;
}>;

/**
 * Shared frame for the login and register screens.
 */
export function AuthScreen({
  title,
  subtitle,
  formError,
  footerText,
  footerLinkLabel,
  footerHref,
  children,
}: AuthScreenProps) {
  return (
    <Screen
      backgroundImage={backgroundImage}
      overlayOpacity={0.55}
      maxWidth={480}>
      {/* On web the top bar already shows the brand. */}
      {Platform.OS !== 'web' && (
        <View style={styles.brand}>
          <ThemedText style={styles.brandText}>🧭 Road-Trip OS</ThemedText>
        </View>
      )}

      <View style={styles.header}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
      </View>

      <ThemedView type="card" style={styles.card}>
        {formError ? (
          <ThemedView
            type="backgroundSelected"
            accessibilityRole="alert"
            style={styles.formError}>
            <ThemedText type="small" themeColor="danger">
              {formError}
            </ThemedText>
          </ThemedView>
        ) : null}

        {children}
      </ThemedView>

      {footerHref && footerLinkLabel ? (
        <View style={styles.footer}>
          {footerText ? (
            <ThemedText style={styles.footerText}>{footerText}</ThemedText>
          ) : null}
          <Link href={footerHref} replace>
            <ThemedText style={styles.footerLink}>{footerLinkLabel}</ThemedText>
          </Link>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: {
    alignItems: 'center',
  },

  brandText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
  },

  header: {
    alignItems: 'center',
    gap: Spacing.one,
  },

  title: {
    color: '#F8FAFC',
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    textAlign: 'center',
  },

  subtitle: {
    color: '#CBD5E1',
    textAlign: 'center',
  },

  card: {
    padding: Spacing.four,
    borderRadius: 18,
    gap: Spacing.three,
  },

  formError: {
    padding: Spacing.three,
    borderRadius: 12,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },

  footerText: {
    color: '#CBD5E1',
  },

  footerLink: {
    color: '#F8FAFC',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
