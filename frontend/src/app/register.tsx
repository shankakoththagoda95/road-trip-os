import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { getRegistrationStatus, type RegisterData } from '@/api/auth';
import { ApiError, errorMessage } from '@/api/client';
import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import { TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useSession } from '@/hooks/use-session';
import { isValidEmail, passwordIsValid } from '@/utils/password';

type RegisterForm = RegisterData & { confirm_password: string };
type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

const emptyForm: RegisterForm = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  confirm_password: '',
};

function SignUpForm() {
  const router = useRouter();
  const { register } = useSession();

  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof RegisterForm) {
    return (value: string) => {
      setForm((current) => ({ ...current, [field]: value }));
      // Clear the field's error as soon as the user edits it.
      setErrors((current) => ({ ...current, [field]: undefined }));
    };
  }

  async function handleSubmit() {
    if (submitting) {
      return;
    }

    const validationErrors = validate(form);
    setErrors(validationErrors);
    setFormError(null);

    if (Object.keys(validationErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const user = await register({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      router.replace({
        pathname: '/check-email',
        params: { email: user.email },
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrors({ email: 'An account with this email already exists.' });
      } else if (
        error instanceof ApiError &&
        Object.keys(error.fieldErrors).length > 0
      ) {
        setErrors(error.fieldErrors);
      } else {
        setFormError(errorMessage(error));
      }

      setSubmitting(false);
    }
  }

  return (
    <AuthScreen
      title="Create your account"
      subtitle="Start planning smarter road trips."
      formError={formError}
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref="/login">
      <View style={styles.row}>
        <View style={styles.column}>
          <TextField
            label="First name"
            value={form.first_name}
            onChangeText={update('first_name')}
            error={errors.first_name}
            autoComplete="given-name"
            textContentType="givenName"
          />
        </View>

        <View style={styles.column}>
          <TextField
            label="Last name"
            value={form.last_name}
            onChangeText={update('last_name')}
            error={errors.last_name}
            autoComplete="family-name"
            textContentType="familyName"
          />
        </View>
      </View>

      <TextField
        label="Email"
        placeholder="you@example.com"
        value={form.email}
        onChangeText={update('email')}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />

      <TextField
        label="Password"
        value={form.password}
        onChangeText={update('password')}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <PasswordRequirements password={form.password} />

      <TextField
        label="Confirm password"
        value={form.confirm_password}
        onChangeText={update('confirm_password')}
        error={errors.confirm_password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      <PrimaryButton
        label="Create account"
        onPress={handleSubmit}
        loading={submitting}
      />
    </AuthScreen>
  );
}

function validate(form: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};

  if (!form.first_name.trim()) {
    errors.first_name = 'Enter your first name.';
  }

  if (!form.last_name.trim()) {
    errors.last_name = 'Enter your last name.';
  }

  if (!isValidEmail(form.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!passwordIsValid(form.password)) {
    errors.password = 'Choose a password that meets the requirements below.';
  }

  if (form.confirm_password !== form.password) {
    errors.confirm_password = 'Passwords do not match.';
  }

  return errors;
}

const styles = StyleSheet.create({
  closed: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },

  closedIcon: {
    fontSize: 40,
    lineHeight: 48,
  },

  closedText: {
    textAlign: 'center',
  },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  column: {
    flexGrow: 1,
    flexBasis: 180,
  },
});

/**
 * The sign-up form while self sign-up is open; otherwise a note that the
 * administrator creates accounts.
 */
export default function RegisterScreen() {
  const [registration] = useAsync(() => getRegistrationStatus(), []);

  if (registration.status === 'success' && registration.data.open) {
    return <SignUpForm />;
  }

  return (
    <AuthScreen
      title="Create an account"
      subtitle="Accounts are created by the administrator."
      footerText="Already have an account?"
      footerLinkLabel="Sign in"
      footerHref="/login">
      {registration.status === 'loading' ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.closed}>
          <ThemedText style={styles.closedIcon}>🔒</ThemedText>
          <ThemedText type="smallBold">Sign-up is closed</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.closedText}>
            New accounts are created by the administrator. Ask them to set
            one up for you, then sign in with the email and password they
            give you.
          </ThemedText>
        </View>
      )}
    </AuthScreen>
  );
}
