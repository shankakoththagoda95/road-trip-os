import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ApiError, errorMessage } from '@/api/client';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ResendVerification } from '@/components/auth/resend-verification';
import { TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Set when the password was right but the email isn't confirmed yet.
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setUnverifiedEmail(null);

    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'email_not_verified') {
        setUnverifiedEmail(email.trim());
      } else {
        setFormError(errorMessage(error));
      }

      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to plan your next road trip."
      formError={formError}
      footerText="New to Road-Trip OS?"
      footerLinkLabel="Create an account"
      footerHref="/register">
      {unverifiedEmail && (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.notice}>
          <ThemedText type="smallBold">📧 Confirm your email first</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            We sent a confirmation link to {unverifiedEmail}. Click it to
            activate your account, then sign in.
          </ThemedText>
          <ResendVerification email={unverifiedEmail} />
        </ThemedView>
      )}

      <TextField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />

      <View style={styles.passwordField}>
        <TextField
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
        <Link
          href={{
            pathname: '/forgot-password',
            params: email.trim() ? { email: email.trim() } : {},
          }}
          style={styles.forgotLink}>
          <ThemedText type="linkPrimary">Forgot password?</ThemedText>
        </Link>
      </View>

      <PrimaryButton
        label="Sign in"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.one,
  },

  passwordField: {
    gap: Spacing.half,
  },

  forgotLink: {
    alignSelf: 'flex-end',
  },
});
