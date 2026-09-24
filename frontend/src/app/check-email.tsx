import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthScreen } from '@/components/auth/auth-screen';
import { ResendVerification } from '@/components/auth/resend-verification';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

/**
 * Shown after sign-up until the user clicks the link in their inbox.
 */
export default function CheckEmailScreen() {
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();

  return (
    <AuthScreen
      title="Check your inbox"
      subtitle="One more step to activate your account."
      footerText="Wrong email address?"
      footerLinkLabel="Sign up again"
      footerHref="/register">
      <ThemedText style={styles.icon}>📬</ThemedText>

      <ThemedText style={styles.centered}>
        We sent a confirmation link to{' '}
        <ThemedText type="smallBold" style={styles.email}>
          {email || 'your email address'}
        </ThemedText>
        . Click it to activate your account. The link is valid for 24
        hours.
      </ThemedText>

      <View style={styles.tips}>
        <ThemedText type="small" themeColor="textSecondary">
          Can&apos;t find it? Check your spam or promotions folder.
        </ThemedText>
        {email ? <ResendVerification email={email} startWithCooldown /> : null}
      </View>

      <PrimaryButton
        label="Back to sign in"
        onPress={() =>
          router.replace({
            pathname: '/login',
            params: email ? { email } : {},
          })
        }
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 48,
    lineHeight: 56,
    textAlign: 'center',
  },

  centered: {
    textAlign: 'center',
  },

  email: {
    fontSize: 16,
  },

  tips: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
