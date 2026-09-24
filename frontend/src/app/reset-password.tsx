import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { resetPassword } from '@/api/auth';
import { ApiError, errorMessage } from '@/api/client';
import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import { TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/hooks/use-session';
import { passwordIsValid } from '@/utils/password';

// Link problems that need a fresh email rather than a retry.
const LinkErrorCodes = new Set(['token_expired', 'token_used', 'invalid_token']);

/**
 * Target of the link in the password reset email.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { signInWithToken } = useSession();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(
    token ? null : 'This link is incomplete.',
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting || !token) {
      return;
    }

    const nextErrors: typeof errors = {};

    if (!passwordIsValid(password)) {
      nextErrors.password = 'Choose a password that meets the requirements.';
    }

    if (confirm !== password) {
      nextErrors.confirm = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const { access_token } = await resetPassword(token, password);
      await signInWithToken(access_token);
      router.replace('/');
    } catch (error) {
      if (error instanceof ApiError && LinkErrorCodes.has(error.code ?? '')) {
        setLinkError(error.message);
      } else if (error instanceof ApiError && error.fieldErrors.password) {
        setErrors({ password: error.fieldErrors.password });
      } else {
        setFormError(errorMessage(error));
      }

      setSubmitting(false);
    }
  }

  if (linkError) {
    return (
      <AuthScreen
        title="This reset link doesn't work"
        subtitle={linkError}
        footerLinkLabel="Back to sign in"
        footerHref="/login">
        <ThemedText type="small" themeColor="textSecondary">
          Reset links are valid for 60 minutes and can be used once.
        </ThemedText>
        <Link href="/forgot-password" replace>
          <ThemedText type="linkPrimary">Send me a new link →</ThemedText>
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Choose a new password"
      subtitle="You'll be signed in right after."
      formError={formError}
      footerLinkLabel="Back to sign in"
      footerHref="/login">
      <TextField
        label="New password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors((current) => ({ ...current, password: undefined }));
        }}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <PasswordRequirements password={password} />

      <TextField
        label="Confirm new password"
        value={confirm}
        onChangeText={(value) => {
          setConfirm(value);
          setErrors((current) => ({ ...current, confirm: undefined }));
        }}
        error={errors.confirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      <PrimaryButton
        label="Set new password"
        onPress={handleSubmit}
        loading={submitting}
      />
    </AuthScreen>
  );
}
