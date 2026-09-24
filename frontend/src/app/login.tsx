import { useRouter } from 'expo-router';
import { useState } from 'react';

import { errorMessage } from '@/api/client';
import { AuthScreen } from '@/components/auth/auth-screen';
import { TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { useSession } from '@/hooks/use-session';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) {
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await signIn(email.trim(), password);
      router.replace('/');
    } catch (error) {
      setFormError(errorMessage(error));
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

      <PrimaryButton
        label="Sign in"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      />
    </AuthScreen>
  );
}
