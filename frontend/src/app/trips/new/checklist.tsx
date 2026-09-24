import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

import {
  type ChecklistCategory,
  type ChecklistItem,
  generateChecklist,
} from '@/api/checklists';
import { errorMessage } from '@/api/client';
import { getRouteFees } from '@/api/routes';
import { WizardStepScreen } from '@/components/new-trip/wizard-step-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
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

const Categories: { id: ChecklistCategory; title: string }[] = [
  { id: 'documents', title: '📄 Documents' },
  { id: 'payments', title: '💳 Vignettes & tolls' },
  { id: 'equipment', title: '🦺 Equipment' },
  { id: 'winter', title: '❄️ Winter' },
  { id: 'rules', title: '🚦 Driving rules' },
  { id: 'vehicle', title: '🚗 Vehicle' },
];

type Failure = { key: string; message: string };

export default function ChecklistStepScreen() {
  const router = useRouter();
  const colors = useTheme();
  const {
    draft,
    setFees,
    setChecklist,
    toggleChecklistItem,
    completeStep,
  } = useTripDraft();

  const [attempt, setAttempt] = useState(0);
  const [showOptional, setShowOptional] = useState(true);
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

  if (!feesRequest) {
    return (
      <WizardStepScreen stepId="checklist" onContinue={handleContinue}>
        <ThemedText type="smallBold">Plan your route first</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          The checklist depends on the countries you&apos;ll drive through.
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          onPress={() => router.navigate('/trips/new/route')}>
          <ThemedText type="linkPrimary">Go to Route & Destinations →</ThemedText>
        </Pressable>
      </WizardStepScreen>
    );
  }

  const checked = new Set(draft.checkedItems);
  const required = (items ?? []).filter((item) => item.required);
  const requiredDone = required.filter((item) => checked.has(item.id)).length;
  const visible = (items ?? []).filter(
    (item) => showOptional || item.required,
  );

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
          <ThemedView type="backgroundSelected" style={styles.box}>
            <ThemedText type="smallBold">
              {requiredDone === required.length
                ? '✅ All required items ready'
                : `${requiredDone} of ${required.length} required items ready`}
            </ThemedText>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.border }]}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: required.length,
                now: requiredDone,
              }}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: colors.success,
                    width: `${required.length ? (requiredDone / required.length) * 100 : 100}%`,
                  },
                ]}
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Based on common rules for your countries and dates. Requirements
              change, so check official sources before you go.
            </ThemedText>
          </ThemedView>

          <View style={styles.toggleRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Show optional items
            </ThemedText>
            <Switch
              accessibilityLabel="Show optional items"
              value={showOptional}
              onValueChange={setShowOptional}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </View>

          {Categories.map((category) => {
            const categoryItems = visible.filter(
              (item) => item.category === category.id,
            );

            if (categoryItems.length === 0) {
              return null;
            }

            return (
              <View key={category.id} style={styles.section}>
                <ThemedText type="smallBold" style={styles.sectionTitle}>
                  {category.title}
                </ThemedText>
                {categoryItems.map((item) => (
                  <ChecklistRow
                    key={item.id}
                    item={item}
                    checked={checked.has(item.id)}
                    onToggle={() => toggleChecklistItem(item.id)}
                  />
                ))}
              </View>
            );
          })}
        </>
      )}
    </WizardStepScreen>
  );
}

function ChecklistRow({
  item,
  checked,
  onToggle,
}: {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const colors = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={item.name}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        { borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.checkbox,
          {
            borderColor: checked ? colors.success : colors.border,
            backgroundColor: checked ? colors.success : 'transparent',
          },
        ]}>
        {checked && <ThemedText style={styles.checkmark}>✓</ThemedText>}
      </View>

      <View style={styles.rowText}>
        <View style={styles.rowTitle}>
          <ThemedText
            type="smallBold"
            themeColor={checked ? 'textSecondary' : 'text'}
            style={checked && styles.checkedText}>
            {item.name}
          </ThemedText>
          {!item.required && (
            <ThemedText type="small" themeColor="textSecondary">
              optional
            </ThemedText>
          )}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {item.description}
        </ThemedText>
      </View>
    </Pressable>
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

  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },

  section: {
    gap: Spacing.one,
  },

  sectionTitle: {
    fontSize: 16,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },

  rowText: {
    flex: 1,
    gap: Spacing.half,
  },

  rowTitle: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: Spacing.two,
  },

  checkedText: {
    textDecorationLine: 'line-through',
  },

  pressed: {
    opacity: 0.75,
  },
});
