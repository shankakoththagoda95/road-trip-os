import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import { type ChecklistItem, generateChecklist } from '@/api/checklists';
import { errorMessage } from '@/api/client';
import { getRouteFees } from '@/api/routes';
import { PersonalChecklistDialog } from '@/components/checklist/personal-checklist-dialog';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChecklistCategories, PersonalChecklistTint } from '@/constants/checklist';
import { getTripStep } from '@/constants/trip-steps';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTripDraft } from '@/hooks/use-trip-draft';
import {
  buildChecklistRequest,
  checklistKey,
  currentChecklist,
} from '@/utils/checklist-draft';
import { buildFeesRequest, currentFees, feesKey } from '@/utils/fees-draft';

type Failure = { key: string; message: string };

export default function ChecklistStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { draft, setFees, setChecklist, setPersonalChecklist, completeStep } =
    useTripDraft();

  const [attempt, setAttempt] = useState(0);
  const [showOptional, setShowOptional] = useState(true);
  const [personalOpen, setPersonalOpen] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  // --- 1. The route's countries (shared with Road Fees & Borders). ---
  const feesRequest = buildFeesRequest(draft);
  const feesRequestKey = feesRequest ? feesKey(feesRequest) : null;
  const hasFees = currentFees(draft) !== null;

  // --- 2. The checklist for those countries. ---
  const checklistRequest = buildChecklistRequest(draft);
  const checklistRequestKey = checklistRequest
    ? checklistKey(checklistRequest)
    : null;
  const items = currentChecklist(draft);
  const hasItems = items !== null;

  const failureKey = `${feesRequestKey}:${checklistRequestKey}:${attempt}`;
  const error = failure?.key === failureKey ? failure.message : null;

  useEffect(() => {
    if (!feesRequestKey || hasFees) {
      return;
    }

    let cancelled = false;

    getRouteFees(JSON.parse(feesRequestKey))
      .then((data) => {
        if (!cancelled) {
          setFees({ key: feesRequestKey, data });
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setFailure({ key: failureKey, message: errorMessage(fetchError) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [feesRequestKey, hasFees, failureKey, setFees]);

  useEffect(() => {
    if (!checklistRequestKey || hasItems) {
      return;
    }

    let cancelled = false;

    generateChecklist(JSON.parse(checklistRequestKey))
      .then((data) => {
        if (!cancelled) {
          setChecklist({ key: checklistRequestKey, items: data.items });
        }
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setFailure({ key: failureKey, message: errorMessage(fetchError) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checklistRequestKey, hasItems, failureKey, setChecklist]);

  function handleContinue() {
    completeStep('checklist');

    const { next } = getTripStep('checklist');
    router.navigate(next?.href ?? '/trips/new');
  }

  const personal = draft.personalChecklist;

  const personalSection = (
    <View
      style={[
        styles.card,
        { borderColor: colors.border, backgroundColor: colors.backgroundElement },
      ]}>
      <View style={styles.cardHeader}>
        <CategoryIcon icon="bag-personal-outline" tint={PersonalChecklistTint} />
        <View style={styles.cardTitle}>
          <ThemedText type="smallBold" style={styles.sectionTitle}>
            Personal checklist
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {personal.length === 0
              ? 'Things you want to take with you.'
              : `${personal.length} ${personal.length === 1 ? 'item' : 'items'}`}
          </ThemedText>
        </View>
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
            size={18}
            color="#FFFFFF"
          />
          <ThemedText type="smallBold" style={styles.personalButtonText}>
            {personal.length === 0 ? 'Add personal checklist' : 'Edit personal checklist'}
          </ThemedText>
        </Pressable>
      </View>

      {personal.length > 0 && (
        <View style={styles.personalList}>
          {personal.map((name) => (
            <View
              key={name}
              style={[styles.personalChip, { backgroundColor: colors.backgroundSelected }]}>
              <View style={[styles.bullet, { backgroundColor: PersonalChecklistTint }]} />
              <ThemedText type="small">{name}</ThemedText>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const dialog = (
    <PersonalChecklistDialog
      visible={personalOpen}
      onClose={() => setPersonalOpen(false)}
      items={personal.map((name) => ({ key: name, name }))}
      onAdd={(name) => setPersonalChecklist([...personal, name])}
      onRemove={(key) => setPersonalChecklist(personal.filter((name) => name !== key))}
    />
  );

  if (!feesRequest) {
    return (
      <WizardStepScreen stepId="checklist" onContinue={handleContinue}>
        <ThemedText type="smallBold">Plan your route first</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          The required items depend on the countries you&apos;ll drive
          through. You can still add your personal checklist.
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/trips/new/route')}>
          <ThemedText type="linkPrimary">Go to Route & Destinations →</ThemedText>
        </Pressable>
        {personalSection}
        {dialog}
      </WizardStepScreen>
    );
  }

  const required = (items ?? []).filter((item) => item.required);
  const optional = (items ?? []).filter((item) => !item.required);
  const visible = (items ?? []).filter((item) => showOptional || item.required);

  return (
    <WizardStepScreen stepId="checklist" onContinue={handleContinue}>
      {!items && !error && (
        <View style={styles.status}>
          <ActivityIndicator color={colors.primary} />
          <ThemedText type="small" themeColor="textSecondary">
            Building your checklist…
          </ThemedText>
        </View>
      )}

      {error && (
        <ThemedView
          type="backgroundSelected"
          accessibilityRole="alert"
          style={styles.box}>
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((value) => value + 1)}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {items && (
        <>
          <View
            style={[
              styles.intro,
              { borderColor: colors.border, backgroundColor: colors.backgroundSelected },
            ]}>
            <MaterialCommunityIcons
              name="clipboard-list-outline"
              size={32}
              color={colors.primary}
            />
            <View style={styles.introText}>
              <ThemedText type="smallBold">
                {required.length} required · {optional.length} recommended
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                What you&apos;ll need for your countries and dates. It&apos;s saved
                with your trip, and you tick things off in the trip details once
                you start travelling. Rules change, so check official sources
                before you go.
              </ThemedText>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Show recommended items
            </ThemedText>
            <Switch
              accessibilityLabel="Show recommended items"
              value={showOptional}
              onValueChange={setShowOptional}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.grid}>
            {ChecklistCategories.map((category) => {
              const categoryItems = visible.filter(
                (item) => item.category === category.id,
              );

              if (categoryItems.length === 0) {
                return null;
              }

              return (
                <View
                  key={category.id}
                  style={[
                    styles.card,
                    styles.gridCard,
                    { borderColor: colors.border, backgroundColor: colors.backgroundElement },
                  ]}>
                  <View style={styles.cardHeader}>
                    <CategoryIcon icon={category.icon} tint={category.tint} />
                    <ThemedText type="smallBold" style={[styles.sectionTitle, styles.cardTitle]}>
                      {category.title}
                    </ThemedText>
                  </View>
                  {categoryItems.map((item) => (
                    <RequirementRow key={item.id} item={item} tint={category.tint} />
                  ))}
                </View>
              );
            })}
          </View>
        </>
      )}

      {personalSection}
      {dialog}
    </WizardStepScreen>
  );
}

function CategoryIcon({
  icon,
  tint,
}: {
  icon: (typeof ChecklistCategories)[number]['icon'];
  tint: string;
}) {
  return (
    <View style={[styles.categoryIcon, { backgroundColor: `${tint}2E` }]}>
      <MaterialCommunityIcons name={icon} size={22} color={tint} />
    </View>
  );
}

/**
 * One requirement, as a plain list entry (ticked later, while travelling).
 */
function RequirementRow({ item, tint }: { item: ChecklistItem; tint: string }) {
  const colors = useTheme();

  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <View style={[styles.bullet, styles.rowBullet, { backgroundColor: tint }]} />
      <View style={styles.rowText}>
        <View style={styles.rowTitle}>
          <ThemedText type="smallBold">{item.name}</ThemedText>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: item.required
                  ? 'rgba(239, 68, 68, 0.14)'
                  : colors.backgroundSelected,
              },
            ]}>
            <ThemedText
              type="small"
              style={[
                styles.badgeText,
                { color: item.required ? '#EF4444' : colors.textSecondary },
              ]}>
              {item.required ? 'Required' : 'Recommended'}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {item.description}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },

  box: {
    padding: Spacing.three,
    borderRadius: 12,
    gap: Spacing.two,
  },

  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.three,
  },

  introText: {
    flex: 1,
    gap: Spacing.half,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },

  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.two,
  },

  gridCard: {
    flexGrow: 1,
    flexBasis: '40%',
    minWidth: 280,
  },

  cardHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.three,
  },

  cardTitle: {
    flex: 1,
    minWidth: 160,
  },

  sectionTitle: {
    fontSize: 16,
  },

  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    borderTopWidth: 1,
    paddingTop: Spacing.two,
  },

  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  rowBullet: {
    marginTop: 7,
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

  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
  },

  badgeText: {
    fontSize: 11,
    lineHeight: 18,
    fontWeight: '700',
  },

  personalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
  },

  personalButtonText: {
    color: '#FFFFFF',
  },

  pressed: {
    opacity: 0.88,
  },

  personalList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },

  personalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
