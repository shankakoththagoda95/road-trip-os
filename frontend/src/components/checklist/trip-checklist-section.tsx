import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { errorMessage } from '@/api/client';
import {
  addTripChecklistItem,
  deleteTripChecklistItem,
  getTripChecklist,
  type TripChecklistItem,
  updateTripChecklistItem,
} from '@/api/trip-checklist';
import { PersonalChecklistDialog } from '@/components/checklist/personal-checklist-dialog';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChecklistCategories, PersonalChecklistTint } from '@/constants/checklist';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * The trip's saved checklist with checkboxes, for ticking things off while
 * travelling, plus the traveller's personal items.
 */
export function TripChecklistSection({
  tripId,
  refreshKey,
}: {
  tripId: number;
  refreshKey: number;
}) {
  const colors = useTheme();
  const [state, reload] = useAsync(
    () => getTripChecklist(tripId),
    [tripId, refreshKey],
  );
  const [personalOpen, setPersonalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Local changes on top of the last load; a reload replaces them.
  const loaded = state.status === 'success' ? state.data : null;
  const [edits, setEdits] = useState<{
    source: TripChecklistItem[];
    items: TripChecklistItem[];
  } | null>(null);
  const items = edits && edits.source === loaded ? edits.items : loaded;

  function setItems(update: (current: TripChecklistItem[]) => TripChecklistItem[]) {
    if (!loaded) return;
    setEdits((current) => ({
      source: loaded,
      items: update(current && current.source === loaded ? current.items : loaded),
    }));
  }

  async function toggle(item: TripChecklistItem) {
    const checked = !item.checked;
    setActionError(null);
    setItems((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, checked } : entry)),
    );

    try {
      await updateTripChecklistItem(tripId, item.id, { checked });
    } catch (error) {
      // Undo the tick so the list matches what's saved.
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, checked: item.checked } : entry,
        ),
      );
      setActionError(`Couldn't update “${item.name}”: ${errorMessage(error)}`);
    }
  }

  async function addPersonal(name: string) {
    const created = await addTripChecklistItem(tripId, { name, personal: true });
    setItems((current) => [...current, created]);
  }

  async function removePersonal(key: string) {
    const id = Number(key);
    await deleteTripChecklistItem(tripId, id);
    setItems((current) => current.filter((entry) => entry.id !== id));
  }

  const title = (
    <View style={styles.header}>
      <ThemedText type="smallBold" style={styles.title}>
        ✅ Travel checklist
      </ThemedText>
    </View>
  );

  if (state.status === 'loading' || !items) {
    return (
      <ThemedView type="card" style={styles.section}>
        {title}
        {state.status === 'error' ? (
          <View style={styles.gap}>
            <ThemedText type="small" themeColor="danger">
              {state.message}
            </ThemedText>
            <Pressable accessibilityRole="button" onPress={reload}>
              <ThemedText type="linkPrimary">Try again</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <ThemedText type="small" themeColor="textSecondary">
              Loading your checklist…
            </ThemedText>
          </View>
        )}
      </ThemedView>
    );
  }

  const generated = items.filter((item) => !item.personal);
  const personal = items.filter((item) => item.personal);
  const done = items.filter((item) => item.checked).length;
  const required = generated.filter((item) => item.required);
  const requiredDone = required.filter((item) => item.checked).length;

  return (
    <ThemedView type="card" style={styles.section}>
      {title}

      {items.length > 0 ? (
        <View style={styles.progress}>
          <View style={styles.progressText}>
            <ThemedText type="smallBold">
              {done === items.length
                ? 'All packed and ready 🎉'
                : `${done} of ${items.length} done`}
            </ThemedText>
            {required.length > 0 && (
              <ThemedText type="small" themeColor="textSecondary">
                Required: {requiredDone} of {required.length}
              </ThemedText>
            )}
          </View>
          <View
            style={[styles.track, { backgroundColor: colors.border }]}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: items.length, now: done }}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.success,
                  width: `${(done / items.length) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          No checklist was saved with this trip. Add your own items below.
        </ThemedText>
      )}

      {actionError && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          {actionError}
        </ThemedText>
      )}

      {ChecklistCategories.map((category) => {
        const categoryItems = generated.filter((item) => item.category === category.id);

        if (categoryItems.length === 0) {
          return null;
        }

        return (
          <Group
            key={category.id}
            icon={category.icon}
            tint={category.tint}
            title={category.title}
            count={`${categoryItems.filter((item) => item.checked).length}/${categoryItems.length}`}>
            {categoryItems.map((item) => (
              <CheckRow key={item.id} item={item} onToggle={() => void toggle(item)} />
            ))}
          </Group>
        );
      })}

      <Group
        icon="bag-personal-outline"
        tint={PersonalChecklistTint}
        title="Personal checklist"
        count={
          personal.length > 0
            ? `${personal.filter((item) => item.checked).length}/${personal.length}`
            : undefined
        }
        action={
          <Pressable
            accessibilityRole="button"
            onPress={() => setPersonalOpen(true)}
            style={({ hovered, pressed }) => [
              styles.personalButton,
              { backgroundColor: colors.primary },
              (hovered || pressed) && styles.pressed,
            ]}>
            <MaterialCommunityIcons
              name={personal.length === 0 ? 'plus' : 'pencil-outline'}
              size={16}
              color="#FFFFFF"
            />
            <ThemedText type="smallBold" style={styles.personalButtonText}>
              {personal.length === 0 ? 'Add personal checklist' : 'Edit personal checklist'}
            </ThemedText>
          </Pressable>
        }>
        {personal.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            List the things you want to take with you.
          </ThemedText>
        ) : (
          personal.map((item) => (
            <CheckRow key={item.id} item={item} onToggle={() => void toggle(item)} />
          ))
        )}
      </Group>

      <PersonalChecklistDialog
        visible={personalOpen}
        onClose={() => setPersonalOpen(false)}
        items={personal.map((item) => ({ key: String(item.id), name: item.name }))}
        onAdd={addPersonal}
        onRemove={removePersonal}
      />
    </ThemedView>
  );
}

function Group({
  icon,
  tint,
  title,
  count,
  action,
  children,
}: {
  icon: IconName;
  tint: string;
  title: string;
  count?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const colors = useTheme();

  return (
    <View style={[styles.group, { borderColor: colors.border }]}>
      <View style={styles.groupHeader}>
        <View style={[styles.groupIcon, { backgroundColor: `${tint}2E` }]}>
          <MaterialCommunityIcons name={icon} size={20} color={tint} />
        </View>
        <ThemedText type="smallBold" style={styles.groupTitle}>
          {title}
        </ThemedText>
        {count && (
          <ThemedText type="small" themeColor="textSecondary">
            {count}
          </ThemedText>
        )}
        {action}
      </View>
      {children}
    </View>
  );
}

function CheckRow({
  item,
  onToggle,
}: {
  item: TripChecklistItem;
  onToggle: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: item.checked }}
      accessibilityLabel={item.name}
      onPress={onToggle}
      style={({ hovered, pressed }) => [
        styles.row,
        (hovered || pressed) && { backgroundColor: colors.backgroundSelected },
      ]}>
      <View
        style={[
          styles.checkbox,
          {
            borderColor: item.checked ? colors.success : colors.border,
            backgroundColor: item.checked ? colors.success : 'transparent',
          },
        ]}>
        {item.checked && <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />}
      </View>

      <View style={styles.rowText}>
        <View style={styles.rowTitle}>
          <ThemedText
            type="smallBold"
            themeColor={item.checked ? 'textSecondary' : 'text'}
            style={item.checked && styles.checkedText}>
            {item.name}
          </ThemedText>
          {item.required && (
            <View style={styles.badge}>
              <ThemedText type="small" style={styles.badgeText}>
                Required
              </ThemedText>
            </View>
          )}
        </View>
        {item.description && (
          <ThemedText type="small" themeColor="textSecondary">
            {item.description}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    padding: Spacing.four,
    borderRadius: 18,
    gap: Spacing.three,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  title: {
    fontSize: 18,
  },

  gap: {
    gap: Spacing.two,
  },

  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  progress: {
    gap: Spacing.two,
  },

  progressText: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    columnGap: Spacing.three,
  },

  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },

  fill: {
    height: '100%',
    borderRadius: 4,
  },

  group: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.one,
  },

  groupHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
    marginBottom: Spacing.one,
  },

  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  groupTitle: {
    flex: 1,
    minWidth: 140,
    fontSize: 16,
  },

  personalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },

  personalButtonText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },

  rowText: {
    flex: 1,
    gap: Spacing.half,
  },

  rowTitle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },

  checkedText: {
    textDecorationLine: 'line-through',
  },

  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    backgroundColor: 'rgba(239, 68, 68, 0.14)',
  },

  badgeText: {
    color: '#EF4444',
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '700',
  },
});
