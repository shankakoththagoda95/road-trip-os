import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { forgotPassword } from '@/api/auth';
import { errorMessage } from '@/api/client';
import { AuthScreen } from '@/components/auth/auth-screen';
import { TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { isValidEmail } from '@/utils/password';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();

  const [email, setEmail] = useState(params.email ?? '');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await forgotPassword(email.trim());
      setSentTo(email.trim());
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthScreen
        title="Check your inbox"
        subtitle="Password reset requested."
        footerText="Remembered it?"
        footerLinkLabel="Back to sign in"
        footerHref={{ pathname: '/login', params: { email: sentTo } }}>
        <ThemedText style={styles.icon}>🔑</ThemedText>
        <ThemedText style={styles.centered}>
          If an account exists for{' '}
          <ThemedText type="smallBold">{sentTo}</ThemedText>, you&apos;ll get
          an email with a link to choose a new password. The link is valid
          for 60 minutes.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          Can&apos;t find it? Check your spam folder, or try again in a
          minute.
        </ThemedText>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Forgot your password?"
      subtitle="We'll email you a link to choose a new one."
      formError={formError}
      footerText="Remembered it?"
      footerLinkLabel="Back to sign in"
      footerHref="/login">
      <TextField
        label="Email"
        placeholder="you@example.com"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setEmailError(undefined);
        }}
        error={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
      />

      <PrimaryButton
        label="Send reset link"
        onPress={handleSubmit}
        loading={submitting}
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
});
