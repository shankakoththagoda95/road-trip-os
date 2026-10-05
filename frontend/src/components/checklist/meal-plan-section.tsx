import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { errorMessage } from '@/api/client';
import {
  getMealPlan,
  type MealKind,
  type MealName,
  type TripMeal,
  updateMeal,
} from '@/api/trip-checklist';
import type { Trip } from '@/api/trips';
import { inputStyle } from '@/components/form/form-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate } from '@/utils/dates';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const MealInfo: Record<
  MealName,
  { label: string; icon: IconName; tint: string }
> = {
  breakfast: { label: 'Breakfast', icon: 'coffee-outline', tint: '#F59E0B' },
  lunch: { label: 'Lunch', icon: 'food-outline', tint: '#22C55E' },
  dinner: { label: 'Dinner', icon: 'silverware-fork-knife', tint: '#8B5CF6' },
  snacks: { label: 'Snacks', icon: 'cookie-outline', tint: '#EC4899' },
};

const Kinds: { value: MealKind; label: string; icon: IconName }[] = [
  { value: 'fast_food', label: 'Fast food', icon: 'hamburger' },
  { value: 'home_prep', label: 'Home prep', icon: 'pot-steam-outline' },
];

// Wait this long after typing stops before saving a description.
const SaveDelayMs = 800;

/**
 * Breakfast, lunch and dinner for each day, and snacks for the whole trip:
 * fast food, or home-prepared with a note of what to make.
 */
export function MealPlanSection({
  trip,
  refreshKey,
}: {
  trip: Trip;
  refreshKey: number;
}) {
  const colors = useTheme();
  const [state, reload] = useAsync(
    () => getMealPlan(trip.id),
    [trip.id, refreshKey],
  );
  const departure = new Date(trip.departure_at);

  const plan = state.status === 'success' ? state.data : null;
  const meals = plan
    ? [
        ...plan.days.flatMap((day) => [day.breakfast, day.lunch, day.dinner]),
        plan.snacks,
      ]
    : [];
  // Choices made since the plan loaded, keyed by mealKey.
  const [kinds, setKinds] = useState<Record<string, MealKind>>({});
  const homePrepared = meals.filter(
    (meal) => (kinds[mealKey(meal)] ?? meal.kind) === 'home_prep',
  ).length;
  const onKindChange = (meal: TripMeal, kind: MealKind) =>
    setKinds((current) => ({ ...current, [mealKey(meal)]: kind }));

  return (
    <ThemedView type="card" style={styles.section}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.title}>
          🍽️ Meal plan
        </ThemedText>
        {plan && (
          <ThemedText type="small" themeColor="textSecondary">
            {homePrepared} of {meals.length} home-prepared
          </ThemedText>
        )}
      </View>

      {state.status === 'loading' ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Loading your meal plan…
          </ThemedText>
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.loading}>
          <ThemedText type="small" themeColor="danger">
            {state.message}
          </ThemedText>
          <Pressable accessibilityRole="button" onPress={reload}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </Pressable>
        </View>
      ) : (
        plan && (
          <>
            <View style={styles.days}>
              {plan.days.map((day) => {
                const date = new Date(departure);
                date.setDate(date.getDate() + day.day_number - 1);

                return (
                  <View
                    key={day.day_number}
                    style={[styles.dayCard, { borderColor: colors.border }]}>
                    <View style={styles.dayHeader}>
                      <ThemedText type="smallBold" style={styles.dayTitle}>
                        Day {day.day_number}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatShortDate(date)}
                      </ThemedText>
                    </View>
                    {[day.breakfast, day.lunch, day.dinner].map((meal) => (
                      <MealRow
                        key={`${trip.id}-${meal.day_number}-${meal.meal}`}
                        tripId={trip.id}
                        initial={meal}
                        onKindChange={onKindChange}
                      />
                    ))}
                  </View>
                );
              })}
            </View>

            <View
              style={[
                styles.dayCard,
                styles.snacksCard,
                { borderColor: colors.border },
              ]}>
              <View style={styles.dayHeader}>
                <ThemedText type="smallBold" style={styles.dayTitle}>
                  For the whole trip
                </ThemedText>
              </View>
              <MealRow
                key={`${trip.id}-snacks`}
                tripId={trip.id}
                initial={plan.snacks}
                onKindChange={onKindChange}
              />
            </View>
          </>
        )
      )}
    </ThemedView>
  );
}

function mealKey(meal: TripMeal) {
  return `${meal.day_number ?? 'trip'}-${meal.meal}`;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function MealRow({
  tripId,
  initial,
  onKindChange,
}: {
  tripId: number;
  initial: TripMeal;
  onKindChange: (meal: TripMeal, kind: MealKind) => void;
}) {
  const colors = useTheme();
  const info = MealInfo[initial.meal];

  const [kind, setKind] = useState<MealKind>(initial.kind);
  const [description, setDescription] = useState(initial.description ?? '');
  const [save, setSave] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function persist(nextKind: MealKind, nextDescription: string) {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    setSave('saving');
    setError(null);

    updateMeal(tripId, {
      day_number: initial.day_number,
      meal: initial.meal,
      kind: nextKind,
      description: nextKind === 'home_prep' ? nextDescription : null,
    })
      .then(() => setSave('saved'))
      .catch((saveError) => {
        setSave('error');
        setError(errorMessage(saveError));
      });
  }

  function chooseKind(next: MealKind) {
    if (next === kind) return;
    setKind(next);
    onKindChange(initial, next);
    persist(next, description);
  }

  function changeDescription(text: string) {
    setDescription(text);
    setSave('idle');

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist('home_prep', text), SaveDelayMs);
  }

  return (
    <View style={styles.meal}>
      <View style={styles.mealTop}>
        <View style={[styles.mealIcon, { backgroundColor: `${info.tint}26` }]}>
          <MaterialCommunityIcons
            name={info.icon}
            size={18}
            color={info.tint}
          />
        </View>
        <ThemedText type="smallBold" style={styles.mealLabel}>
          {info.label}
        </ThemedText>

        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={`${info.label}: how`}
          style={[styles.toggle, { borderColor: colors.border }]}>
          {Kinds.map((option) => {
            const selected = option.value === kind;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${info.label}: ${option.label}`}
                onPress={() => chooseKind(option.value)}
                style={({ hovered }) => [
                  styles.toggleOption,
                  selected && { backgroundColor: colors.primary },
                  hovered &&
                    !selected && { backgroundColor: colors.backgroundSelected },
                ]}>
                <MaterialCommunityIcons
                  name={option.icon}
                  size={14}
                  color={selected ? '#FFFFFF' : colors.textSecondary}
                />
                <ThemedText
                  type="small"
                  style={[
                    styles.toggleText,
                    { color: selected ? '#FFFFFF' : colors.textSecondary },
                  ]}>
                  {option.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {kind === 'home_prep' && (
        <View style={styles.descriptionRow}>
          <TextInput
            accessibilityLabel={`${info.label} description`}
            value={description}
            onChangeText={changeDescription}
            onBlur={() => {
              // Save straight away rather than waiting for the timer.
              if (timer.current) persist('home_prep', description);
            }}
            placeholder={
              initial.meal === 'snacks'
                ? 'e.g. Fruit, nuts, sandwiches for the road'
                : `What's for ${info.label.toLowerCase()}? e.g. Pasta salad`
            }
            placeholderTextColor={colors.textSecondary}
            maxLength={500}
            multiline
            style={[
              inputStyle(colors, save === 'error'),
              styles.descriptionInput,
            ]}
          />
          <SaveStatus state={save} />
        </View>
      )}

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
          Couldn&apos;t save: {error}
        </ThemedText>
      )}
    </View>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  const colors = useTheme();

  if (state === 'saving') {
    return <ActivityIndicator size="small" color={colors.textSecondary} />;
  }

  if (state === 'saved') {
    return (
      <View accessible accessibilityLabel="Saved" style={styles.saved}>
        <MaterialCommunityIcons name="check" size={16} color={colors.success} />
      </View>
    );
  }

  return <View style={styles.saved} />;
}

const styles = StyleSheet.create({
  section: {
    padding: Spacing.four,
    borderRadius: 18,
    gap: Spacing.three,
  },

  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },

  title: {
    fontSize: 18,
  },

  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  dayCard: {
    flexGrow: 1,
    flexBasis: 380,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.three,
  },

  snacksCard: {
    flexBasis: 'auto',
  },

  dayHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },

  dayTitle: {
    fontSize: 16,
  },

  meal: {
    gap: Spacing.two,
  },

  mealTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },

  mealIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mealLabel: {
    flex: 1,
    minWidth: 80,
  },

  toggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
  },

  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two + Spacing.one,
    paddingVertical: Spacing.one,
  },

  toggleText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },

  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  descriptionInput: {
    flex: 1,
    height: undefined,
    minHeight: 44,
    paddingVertical: Spacing.two,
    borderRadius: 12,
  },

  saved: {
    width: 20,
    alignItems: 'center',
  },
});
