import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  type AdminUser,
  type AdminUserCreate,
  createUser,
  listUsers,
} from '@/api/admin';
import { ApiError, errorMessage } from '@/api/client';
import { PasswordRequirements } from '@/components/auth/password-requirements';
import { TextField } from '@/components/form/form-field';
import { PrimaryButton } from '@/components/form/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { isValidEmail, passwordIsValid } from '@/utils/password';

// Width from which the form and the account list sit side by side.
const TwoColumns = 960;

/**
 * Administrator console: create accounts and see who has one. Reached only
 * by typing /admin (it isn't linked from the app), and the admin API only
 * answers on this computer.
 */
export default function AdminScreen() {
  const colors = useTheme();
  const { session, signOut } = useSession();

  const user = session.status === 'signedIn' ? session.user : null;

  return (
    <ThemedView style={styles.page}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.topBar}>
            <View style={styles.brand}>
              <View
                style={[styles.brandIcon, { backgroundColor: colors.primary }]}>
                <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
              </View>
              <View>
                <ThemedText type="smallBold" style={styles.brandTitle}>
                  Road-Trip OS · Admin
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Account management
                </ThemedText>
              </View>
            </View>

            {user && (
              <View style={styles.account}>
                <ThemedText type="small" themeColor="textSecondary">
                  {user.email}
                </ThemedText>
                <Pressable
                  accessibilityRole="button"
                  onPress={signOut}
                  style={({ hovered }) => [
                    styles.outlineButton,
                    { borderColor: colors.border },
                    hovered && { backgroundColor: colors.backgroundSelected },
                  ]}>
                  <Ionicons
                    name="log-out-outline"
                    size={16}
                    color={colors.text}
                  />
                  <ThemedText type="smallBold">Sign out</ThemedText>
                </Pressable>
              </View>
            )}
          </View>

          {session.status === 'loading' ? (
            <ActivityIndicator style={styles.loading} />
          ) : session.status === 'signedOut' ? (
            <AdminSignIn />
          ) : user?.is_admin ? (
            <AdminConsole />
          ) : (
            <Notice
              icon="lock-closed-outline"
              title="This account isn't an administrator"
              text={`You're signed in as ${user?.email ?? 'another user'}. Sign out, then sign in with the administrator account.`}
              action={{ label: 'Sign out', onPress: signOut }}
            />
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function AdminSignIn() {
  const colors = useTheme();
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter the administrator email and password.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
    } catch (signInError) {
      setError(errorMessage(signInError));
      setSubmitting(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        styles.signInCard,
        {
          borderColor: colors.border,
          backgroundColor: colors.backgroundElement,
        },
      ]}>
      <View style={styles.cardHeader}>
        <Ionicons name="shield-outline" size={28} color={colors.primary} />
        <View style={styles.cardHeaderText}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            Administrator sign-in
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Only administrator accounts can use this page.
          </ThemedText>
        </View>
      </View>

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      )}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        onSubmitEditing={submit}
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        onSubmitEditing={submit}
      />
      <PrimaryButton label="Sign in" onPress={submit} loading={submitting} />
    </View>
  );
}

const emptyForm: AdminUserCreate = {
  first_name: '',
  last_name: '',
  email: '',
  password: '',
  is_admin: false,
};

type FormErrors = Partial<Record<keyof AdminUserCreate, string>>;

function AdminConsole() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [usersState, reloadUsers] = useAsync(() => listUsers(), []);

  const [form, setForm] = useState<AdminUserCreate>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<AdminUser | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const localOnly =
    usersState.status === 'error' &&
    usersState.error instanceof ApiError &&
    usersState.error.code === 'admin_local_only';

  if (localOnly) {
    return (
      <Notice
        icon="desktop-outline"
        title="Only on this computer"
        text="The admin panel only works on the computer that runs Road-Trip OS. Open http://localhost:8081/admin there."
      />
    );
  }

  function update<K extends keyof AdminUserCreate>(field: K) {
    return (value: AdminUserCreate[K]) => {
      setForm((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setCreated(null);
    };
  }

  function validate(): FormErrors {
    const next: FormErrors = {};
    if (!form.first_name.trim()) next.first_name = 'Enter a first name.';
    if (!form.last_name.trim()) next.last_name = 'Enter a last name.';
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!passwordIsValid(form.password))
      next.password = "The password doesn't meet the rules below.";
    return next;
  }

  async function submit() {
    const found = validate();
    setErrors(found);
    setFormError(null);

    if (Object.keys(found).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const user = await createUser({
        ...form,
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      });
      setCreated(user);
      setForm(emptyForm);
      setShowPassword(false);
      reloadUsers();
    } catch (createError) {
      if (
        createError instanceof ApiError &&
        Object.keys(createError.fieldErrors).length
      ) {
        setErrors(createError.fieldErrors as FormErrors);
      } else {
        setFormError(errorMessage(createError));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const formCard = (
    <View
      style={[
        styles.card,
        width >= TwoColumns && styles.formColumn,
        {
          borderColor: colors.border,
          backgroundColor: colors.backgroundElement,
        },
      ]}>
      <View style={styles.cardHeader}>
        <Ionicons name="person-add-outline" size={26} color={colors.primary} />
        <View style={styles.cardHeaderText}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            Create an account
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The account is active straight away. Give the person their email and
            password.
          </ThemedText>
        </View>
      </View>

      {created && (
        <View
          style={[styles.success, { borderColor: colors.success }]}
          accessibilityRole="alert">
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <ThemedText type="small" style={styles.successText}>
            Created {created.first_name} {created.last_name} ({created.email}).
            They can sign in now.
          </ThemedText>
        </View>
      )}

      {formError && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {formError}
        </ThemedText>
      )}

      <View style={styles.nameRow}>
        <View style={styles.nameField}>
          <TextField
            label="First name"
            value={form.first_name}
            onChangeText={update('first_name')}
            error={errors.first_name}
          />
        </View>
        <View style={styles.nameField}>
          <TextField
            label="Last name"
            value={form.last_name}
            onChangeText={update('last_name')}
            error={errors.last_name}
          />
        </View>
      </View>

      <TextField
        label="Email"
        value={form.email}
        onChangeText={update('email')}
        autoCapitalize="none"
        keyboardType="email-address"
        error={errors.email}
      />

      <View style={styles.passwordBlock}>
        <TextField
          label="Password"
          value={form.password}
          onChangeText={update('password')}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          error={errors.password}
        />
        <View style={styles.passwordActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPassword((value) => !value)}
            style={({ hovered }) => [
              styles.outlineButton,
              { borderColor: colors.border },
              hovered && { backgroundColor: colors.backgroundSelected },
            ]}>
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={16}
              color={colors.text}
            />
            <ThemedText type="small">
              {showPassword ? 'Hide' : 'Show'}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              update('password')(generatePassword());
              setShowPassword(true);
            }}
            style={({ hovered }) => [
              styles.outlineButton,
              { borderColor: colors.border },
              hovered && { backgroundColor: colors.backgroundSelected },
            ]}>
            <Ionicons name="key-outline" size={16} color={colors.text} />
            <ThemedText type="small">Generate</ThemedText>
          </Pressable>
        </View>
        <PasswordRequirements password={form.password} />
      </View>

      <View style={[styles.adminRow, { borderColor: colors.border }]}>
        <View style={styles.cardHeaderText}>
          <ThemedText type="smallBold">Administrator</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Can open this page and create accounts.
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Administrator"
          value={form.is_admin}
          onValueChange={update('is_admin')}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
        />
      </View>

      <PrimaryButton
        label="Create account"
        onPress={submit}
        loading={submitting}
      />
    </View>
  );

  const listCard = (
    <View
      style={[
        styles.card,
        styles.listColumn,
        {
          borderColor: colors.border,
          backgroundColor: colors.backgroundElement,
        },
      ]}>
      <View style={styles.cardHeader}>
        <Ionicons name="people-outline" size={26} color={colors.primary} />
        <View style={styles.cardHeaderText}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            Accounts
            {usersState.status === 'success'
              ? ` (${usersState.data.length})`
              : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Newest first.
          </ThemedText>
        </View>
      </View>

      {usersState.status === 'loading' ? (
        <ActivityIndicator />
      ) : usersState.status === 'error' ? (
        <ThemedText type="small" themeColor="danger">
          {usersState.message}
        </ThemedText>
      ) : (
        usersState.data.map((account) => (
          <View
            key={account.id}
            style={[styles.userRow, { borderTopColor: colors.border }]}>
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: account.is_admin
                    ? colors.primary
                    : colors.backgroundSelected,
                },
              ]}>
              <ThemedText
                type="smallBold"
                style={{ color: account.is_admin ? '#FFFFFF' : colors.text }}>
                {(account.first_name[0] ?? '?').toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.userText}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {account.first_name} {account.last_name}
              </ThemedText>
              <ThemedText
                type="small"
                themeColor="textSecondary"
                numberOfLines={1}>
                {account.email}
              </ThemedText>
            </View>
            <View style={styles.badges}>
              {account.is_admin && (
                <Badge label="Admin" color={colors.primary} />
              )}
              <Badge
                label={account.email_verified ? 'Active' : 'Unconfirmed'}
                color={account.email_verified ? colors.success : colors.warning}
              />
              <ThemedText type="small" themeColor="textSecondary">
                {new Date(`${account.created_at}Z`).toLocaleDateString()}
              </ThemedText>
            </View>
          </View>
        ))
      )}
    </View>
  );

  return (
    <View style={[styles.console, width >= TwoColumns && styles.consoleWide]}>
      {formCard}
      {listCard}
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
      <ThemedText type="small" style={[styles.badgeText, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function Notice({
  icon,
  title,
  text,
  action,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.card,
        styles.signInCard,
        styles.notice,
        {
          borderColor: colors.border,
          backgroundColor: colors.backgroundElement,
        },
      ]}>
      <Ionicons name={icon} size={40} color={colors.textSecondary} />
      <ThemedText type="smallBold" style={styles.cardTitle}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.noticeText}>
        {text}
      </ThemedText>
      {action && (
        <PrimaryButton label={action.label} onPress={action.onPress} />
      )}
    </View>
  );
}

// 14 characters with letters, digits and a symbol (meets the rules).
function generatePassword() {
  const letters = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = letters + digits + symbols;
  const random = new Uint32Array(14);
  crypto.getRandomValues(random);

  const chars = Array.from(random, (value, index) => {
    const pool =
      index === 0
        ? letters
        : index === 1
          ? digits
          : index === 2
            ? symbols
            : all;
    return pool[value % pool.length];
  });

  // Shuffle so the required kinds aren't always first.
  for (let index = chars.length - 1; index > 0; index--) {
    const swap = random[index] % (index + 1);
    [chars[index], chars[swap]] = [chars[swap], chars[index]];
  }

  return chars.join('');
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },

  scroll: {
    padding: Spacing.four,
  },

  content: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    gap: Spacing.four,
  },

  topBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },

  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  brandTitle: {
    fontSize: 18,
  },

  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  loading: {
    marginTop: Spacing.six,
  },

  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },

  signInCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginTop: Spacing.five,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },

  cardHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },

  cardTitle: {
    fontSize: 18,
  },

  notice: {
    alignItems: 'center',
  },

  noticeText: {
    textAlign: 'center',
  },

  console: {
    gap: Spacing.four,
  },

  consoleWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },

  formColumn: {
    width: 440,
  },

  listColumn: {
    flex: 1,
    gap: 0,
  },

  success: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },

  successText: {
    flex: 1,
  },

  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  nameField: {
    flexGrow: 1,
    flexBasis: 160,
  },

  passwordBlock: {
    gap: Spacing.two,
  },

  passwordActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
  },

  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: 1,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  userText: {
    flex: 1,
    minWidth: 0,
  },

  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },

  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
  },

  badgeText: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
  },
});
