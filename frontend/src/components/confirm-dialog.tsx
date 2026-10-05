import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ModalDialog } from '@/components/modal-dialog';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/**
 * "Are you sure?" popup over a blurred page, e.g. before deleting
 * something. Cancel, ✕, Escape or a click outside closes it.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  details,
  confirmLabel,
  busyLabel,
  danger = false,
  icon,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: ReactNode;
  // e.g. the item being deleted, shown in a highlighted box.
  details?: ReactNode;
  confirmLabel: string;
  // Shown on the button while `busy`, e.g. "Deleting…".
  busyLabel?: string;
  danger?: boolean;
  icon?: IconName;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useTheme();
  const tint = danger ? colors.danger : colors.primary;

  return (
    <ModalDialog
      visible={visible}
      title={title}
      maxWidth={480}
      // Not while the action is running.
      onClose={busy ? () => {} : onCancel}>
      <View style={styles.content}>
        <View style={styles.messageRow}>
          <View style={[styles.icon, { backgroundColor: `${tint}22` }]}>
            <Ionicons
              name={icon ?? (danger ? 'trash-outline' : 'help-circle-outline')}
              size={26}
              color={tint}
            />
          </View>
          <View style={styles.messageText}>
            {typeof message === 'string' ? (
              <ThemedText themeColor="textSecondary">{message}</ThemedText>
            ) : (
              message
            )}
          </View>
        </View>

        {details && (
          <View
            style={[
              styles.details,
              {
                borderColor: colors.border,
                backgroundColor: colors.backgroundSelected,
              },
            ]}>
            {details}
          </View>
        )}

        {error && (
          <ThemedText
            type="small"
            themeColor="danger"
            accessibilityRole="alert">
            {error}
          </ThemedText>
        )}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onCancel}
            style={({ hovered, pressed }) => [
              styles.button,
              { borderColor: colors.border },
              (hovered || pressed) && {
                backgroundColor: colors.backgroundSelected,
              },
              busy && styles.disabled,
            ]}>
            <ThemedText type="smallBold">Cancel</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onConfirm}
            style={({ hovered, pressed }) => [
              styles.button,
              { backgroundColor: tint, borderColor: tint },
              (hovered || pressed) && styles.pressed,
            ]}>
            {busy && <ActivityIndicator color="#FFFFFF" size="small" />}
            <ThemedText type="smallBold" style={styles.confirmText}>
              {busy ? (busyLabel ?? confirmLabel) : confirmLabel}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ModalDialog>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.three,
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },

  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageText: {
    flex: 1,
    gap: Spacing.one,
  },

  details: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.half,
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 44,
    minWidth: 110,
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
  },

  confirmText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },

  disabled: {
    opacity: 0.5,
  },
});
