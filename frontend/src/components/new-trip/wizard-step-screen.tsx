import type { PropsWithChildren, ReactNode } from 'react';

import { PlannerFrame } from '@/components/new-trip/planner-frame';
import type { TripStepId } from '@/constants/trip-steps';

type WizardStepScreenProps = PropsWithChildren<{
  stepId: TripStepId;
  onContinue: () => void;
  // Defaults to "Next: <next step>".
  continueLabel?: string;
  continueLoading?: boolean;
  continueDisabled?: boolean;
  // Shown on the left of the footer.
  summary?: ReactNode;
}>;

/**
 * Shared frame for the new-trip steps (same layout as Trip Details).
 */
export function WizardStepScreen({
  stepId,
  onContinue,
  continueLabel,
  continueLoading = false,
  continueDisabled = false,
  summary,
  children,
}: WizardStepScreenProps) {
  return (
    <PlannerFrame
      stepId={stepId}
      onNext={onContinue}
      nextLabel={continueLabel}
      nextLoading={continueLoading}
      nextDisabled={continueDisabled}
      summary={summary}>
      {children}
    </PlannerFrame>
  );
}
