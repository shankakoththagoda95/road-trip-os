import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { verifyEmail } from '@/api/auth';
import { ApiError, errorMessage } from '@/api/client';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ResendVerification } from '@/components/auth/resend-verification';
import { TextField } from '@/components/form/form-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

type State =
  | { status: 'verifying' }
  | { status: 'failed'; code: string | null; message: string };

/**
 * Target of the link in the confirmation email: confirms the address and
 * signs the user in.
 */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { signInWithToken } = useSession();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [state, setState] = useState<State>(
    token
      ? { status: 'verifying' }
      : {
          status: 'failed',
          code: 'invalid_token',
          message: 'This link is incomplete.',
        },
  );
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    verifyEmail(token)
      .then(async ({ access_token }) => {
        if (!cancelled) {
          await signInWithToken(access_token);
          router.replace('/');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            status: 'failed',
            code: error instanceof ApiError ? error.code : null,
            message: errorMessage(error),
          });
        }
      });

    return () => {
      cancelled = true;
    };
    // Run once per link; signInWithToken/router are not stable identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state.status === 'verifying') {
    return (
      <AuthScreen title="Confirming your email" subtitle="Just a moment…">
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </AuthScreen>
    );
  }

  const expired = state.code === 'token_expired';

  return (
    <AuthScreen
      title={expired ? 'This link has expired' : "We couldn't confirm your email"}
      subtitle={
        expired
          ? 'Confirmation links are valid for 24 hours.'
          : state.message
      }
      footerText="Already confirmed?"
      footerLinkLabel="Sign in"
      footerHref="/login">
      <ThemedText type="small" themeColor="textSecondary">
        Enter your email address and we&apos;ll send you a new confirmation
        link.
      </ThemedText>

      <TextField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <View style={styles.resend}>
        <ResendVerification email={email.trim()} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },

  resend: {
    alignItems: 'center',
    gap: Spacing.one,
  },
});
