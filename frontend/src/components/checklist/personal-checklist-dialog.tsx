import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { inputStyle } from '@/components/form/form-field';
import { ModalDialog } from '@/components/modal-dialog';
import { ThemedText } from '@/components/themed-text';
import {
  PersonalChecklistSuggestions,
  PersonalChecklistTint,
  PersonalItemMaxLength,
} from '@/constants/checklist';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type PersonalItem = { key: string; name: string };

/**
 * Popup for listing the things the traveller wants to take along.
 * Works on the planner draft or on a saved trip; the parent decides what
 * adding and removing do.
 */
export function PersonalChecklistDialog({
  visible,
  onClose,
  items,
  onAdd,
  onRemove,
}: {
  visible: boolean;
  onClose: () => void;
  items: PersonalItem[];
  // May be async (saved trips); errors are shown in the popup.
  onAdd: (name: string) => void | Promise<void>;
  onRemove: (key: string) => void | Promise<void>;
}) {
  const colors = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const names = new Set(items.map((item) => item.name.trim().toLowerCase()));
  const suggestions = PersonalChecklistSuggestions.filter(
    (suggestion) => !names.has(suggestion.toLowerCase()),
  );

  async function run(action: () => void | Promise<void>) {
    setBusy(true);
    setError(null);

    try {
      await action();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  }

  function add(name: string) {
    const trimmed = name.trim();

    if (!trimmed || busy) {
      return;
    }

    if (names.has(trimmed.toLowerCase())) {
      setError(`“${trimmed}” is already on your list.`);
      return;
    }

    void run(async () => {
      await onAdd(trimmed);
      setText('');
    });
  }

  return (
    <ModalDialog
      visible={visible}
      title="Personal checklist"
      subtitle="List what you want to take with you. You'll tick these off in the trip details once you're on the road."
      onClose={onClose}>
      <View style={styles.addRow}>
        <TextInput
          accessibilityLabel="Item to bring"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setError(null);
          }}
          onSubmitEditing={() => add(text)}
          placeholder="e.g. Camera"
          placeholderTextColor={colors.textSecondary}
          maxLength={PersonalItemMaxLength}
          returnKeyType="done"
          blurOnSubmit={false}
          autoFocus
          style={[inputStyle(colors, Boolean(error)), styles.input]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={!text.trim() || busy}
          onPress={() => add(text)}
          style={({ hovered, pressed }) => [
            styles.addButton,
            { backgroundColor: colors.primary },
            (hovered || pressed) && styles.pressed,
            (!text.trim() || busy) && styles.disabled,
          ]}>
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
              <ThemedText type="smallBold" style={styles.addText}>
                Add
              </ThemedText>
            </>
          )}
        </Pressable>
      </View>

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      )}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          <ThemedText type="small" themeColor="textSecondary">
            Quick add
          </ThemedText>
          <View style={styles.chips}>
            {suggestions.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                accessibilityLabel={`Add ${suggestion}`}
                disabled={busy}
                onPress={() => add(suggestion)}
                style={({ hovered }) => [
                  styles.chip,
                  { borderColor: colors.border },
                  hovered && { backgroundColor: colors.backgroundSelected },
                ]}>
                <MaterialCommunityIcons name="plus" size={14} color={colors.textSecondary} />
                <ThemedText type="small">{suggestion}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.list}>
        <ThemedText type="smallBold">
          Your list ({items.length})
        </ThemedText>
        {items.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Nothing yet. Add the things you don&apos;t want to forget.
          </ThemedText>
        ) : (
          items.map((item) => (
            <View
              key={item.key}
              style={[styles.item, { borderColor: colors.border }]}>
              <MaterialCommunityIcons
                name="bag-personal-outline"
                size={18}
                color={PersonalChecklistTint}
              />
              <ThemedText style={styles.itemName}>{item.name}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                disabled={busy}
                onPress={() => void run(() => onRemove(item.key))}
                style={({ hovered }) => [
                  styles.remove,
                  hovered && { backgroundColor: colors.backgroundSelected },
                ]}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={onClose}
        style={({ hovered, pressed }) => [
          styles.done,
          { borderColor: colors.border },
          (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
        ]}>
        <ThemedText type="smallBold">Done</ThemedText>
      </Pressable>
    </ModalDialog>
  );
}

const styles = StyleSheet.create({
  addRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },

  input: {
    flex: 1,
  },

  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    minWidth: 96,
  },

  addText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },

  disabled: {
    opacity: 0.5,
  },

  suggestions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },

  list: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: 1,
    paddingVertical: Spacing.two,
  },

  itemName: {
    flex: 1,
  },

  remove: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  done: {
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
  },
});
