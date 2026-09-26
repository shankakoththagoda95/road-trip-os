import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { ChecklistItem } from '@/api/checklists';
import type {
  EnergyPlan,
  ItineraryPreview,
  RouteConditions,
  RouteFees,
  RoutePreview,
} from '@/api/routes';
import type { TripType } from '@/api/trips';
import type { Vehicle } from '@/api/vehicles';
import type { TripStepId } from '@/constants/trip-steps';
import { useSession } from '@/hooks/use-session';
import {
  clearStoredDraft,
  loadStoredDraft,
  storeDraft,
} from '@/utils/draft-storage';
import { placeKey } from '@/utils/place-key';

export type { TripType };

export type TripDetailsDraft = {
  name: string;
  startLocation: string;
  // Places to visit, in order. The last one is where a one-way trip ends;
  // a round trip then drives back to `startLocation`.
  stops: string[];
  tripType: TripType;
  // Local date and time, as `YYYY-MM-DD` and `HH:MM`.
  departureDate: string;
  departureTime: string;
  durationDays: number;
  travelers: number;
  // Nights at each stop, keyed by placeKey(stop). Missing = 0 (driven
  // through). Kept when stops are reordered.
  stayNights: Record<string, number>;
};

// A location with coordinates, as found by the geocoder.
export type RoutePlace = {
  // What the user typed; also the name saved on the trip.
  location: string;
  // Full matched name, e.g. "Oslo, Norway".
  displayName: string;
  latitude: number;
  longitude: number;
};

export type RouteDraft = {
  // Geocoded places, keyed by the text typed in Trip Details (see
  // utils/route-draft.ts). Kept when stops are reordered or removed, so
  // nothing is looked up twice.
  places: Record<string, RoutePlace>;
  // Last calculated route, tagged with the request it was calculated for.
  preview: { key: string; data: RoutePreview } | null;
};

export type PreferencesDraft = {
  limitDrivingHours: boolean;
  maxDrivingHours: number;
  limitDistance: boolean;
  maxDistanceKm: number;
};

// Money fields are kept as the text the user typed; see utils/budget.ts.
export type BudgetDraft = {
  currency: string;
  fuelPricePerLiter: string;
  electricityPricePerKwh: string;
  // Used only when fuel / charging can't be calculated from the route.
  fuelCost: string;
  evChargingCost: string;
  tollCost: string;
  foodPerPersonPerDay: string;
  parkingCost: string;
  otherCost: string;
};

export type EnergyDraft = {
  // Fuel tank / battery level when setting off.
  startLevelPercent: number;
  // Plan a stop before the level drops below this.
  reservePercent: number;
  // Level after each charging stop (EVs only; fuel stops fill the tank).
  chargeToPercent: number;
  // Last planned stops, tagged with the request they were planned for.
  plan: { key: string; data: EnergyPlan } | null;
};

// Each wizard step adds its own section here as it gets built.
export type TripDraft = {
  details: TripDetailsDraft;
  route: RouteDraft;
  // Null until the user picks one (the trip can be saved without it).
  vehicle: Vehicle | null;
  preferences: PreferencesDraft;
  budget: BudgetDraft;
  energy: EnergyDraft;
  // Last fetched weather & terrain, tagged with the request it was for.
  conditions: { key: string; data: RouteConditions } | null;
  // Last fetched countries & road fees, tagged with the request it was for.
  fees: { key: string; data: RouteFees } | null;
  // Last generated checklist, tagged with the request it was for.
  checklist: { key: string; items: ChecklistItem[] } | null;
  // Things the traveller wants to bring, in the order added. Saved with the
  // trip and ticked off while travelling (not while planning).
  personalChecklist: string[];
  // Last day-by-day plan, tagged with the request it was for.
  itinerary: { key: string; data: ItineraryPreview } | null;
};

const initialDraft: TripDraft = {
  details: {
    name: '',
    startLocation: '',
    stops: [''],
    tripType: 'one_way',
    departureDate: '',
    departureTime: '09:00',
    durationDays: 1,
    travelers: 1,
    stayNights: {},
  },
  route: {
    places: {},
    preview: null,
  },
  vehicle: null,
  preferences: {
    limitDrivingHours: false,
    maxDrivingHours: 8,
    limitDistance: false,
    maxDistanceKm: 500,
  },
  budget: {
    currency: 'EUR',
    fuelPricePerLiter: '',
    electricityPricePerKwh: '',
    fuelCost: '',
    evChargingCost: '',
    tollCost: '',
    foodPerPersonPerDay: '',
    parkingCost: '',
    otherCost: '',
  },
  energy: {
    startLevelPercent: 100,
    reservePercent: 15,
    chargeToPercent: 80,
    plan: null,
  },
  conditions: null,
  fees: null,
  checklist: null,
  personalChecklist: [],
  itinerary: null,
};

type TripDraftContextValue = {
  draft: TripDraft;
  // Nothing entered yet (or just reset).
  isPristine: boolean;
  // The draft was restored from storage when the planner opened.
  restored: boolean;
  // Remove the stored copy without touching the in-memory draft (e.g. once
  // the trip is created, so a refresh can't create it twice).
  forgetSavedDraft: () => void;
  updateDetails: (details: Partial<TripDetailsDraft>) => void;
  updateRoute: (route: Partial<RouteDraft>) => void;
  // Remember a geocoded place (safe to call from effects).
  rememberPlace: (place: RoutePlace) => void;
  setVehicle: (vehicle: Vehicle | null) => void;
  updatePreferences: (preferences: Partial<PreferencesDraft>) => void;
  updateBudget: (budget: Partial<BudgetDraft>) => void;
  updateEnergy: (energy: Partial<EnergyDraft>) => void;
  setConditions: (conditions: TripDraft['conditions']) => void;
  setFees: (fees: TripDraft['fees']) => void;
  setChecklist: (checklist: TripDraft['checklist']) => void;
  setPersonalChecklist: (items: string[]) => void;
  setItinerary: (itinerary: TripDraft['itinerary']) => void;
  completedSteps: ReadonlySet<TripStepId>;
  completeStep: (id: TripStepId) => void;
  reset: () => void;
};

// Bump when TripDraft changes shape incompatibly; older saves are ignored.
// 2: start + ordered stops instead of start / destination.
const DraftVersion = 2;
const SaveDelayMs = 400;

type StoredDraft = {
  version: number;
  draft: TripDraft;
  completedSteps: TripStepId[];
};

function restoreDraft(storageKey: string) {
  const raw = loadStoredDraft(storageKey);

  if (!raw) {
    return null;
  }

  try {
    const stored = JSON.parse(raw) as StoredDraft;

    if (stored.version !== DraftVersion || !stored.draft) {
      return null;
    }

    // Merge section by section so fields added since the save get their
    // defaults.
    const merged: Record<string, unknown> = { ...initialDraft };

    for (const [key, initial] of Object.entries(initialDraft)) {
      const saved = (stored.draft as Record<string, unknown>)[key];

      if (saved === undefined) {
        continue;
      }

      merged[key] =
        initial !== null && typeof initial === 'object' && !Array.isArray(initial)
          ? { ...initial, ...(saved as object) }
          : saved;
    }

    return {
      draft: merged as TripDraft,
      completedSteps: stored.completedSteps ?? [],
    };
  } catch {
    return null;
  }
}

function saveDraft(
  storageKey: string,
  draft: TripDraft,
  completedSteps: ReadonlySet<TripStepId>,
) {
  const stored = (value: TripDraft): StoredDraft => ({
    version: DraftVersion,
    draft: value,
    completedSteps: [...completedSteps],
  });

  if (storeDraft(storageKey, JSON.stringify(stored(draft)))) {
    return;
  }

  // Storage full: keep what the user entered, drop the cached lookups
  // (they're fetched again when needed).
  storeDraft(
    storageKey,
    JSON.stringify(
      stored({
        ...draft,
        route: { ...draft.route, preview: null },
        energy: { ...draft.energy, plan: null },
        conditions: null,
        fees: null,
        checklist: null,
        itinerary: null,
      }),
    ),
  );
}

const TripDraftContext = createContext<TripDraftContextValue | undefined>(
  undefined,
);

/**
 * Holds the trip being planned while the user moves between wizard steps.
 */
export function TripDraftProvider({ children }: PropsWithChildren) {
  const { session } = useSession();
  const userId =
    session.status === 'signedIn' ? (session.user?.id ?? 'unknown') : 'unknown';
  // One saved draft per user, so accounts sharing a browser don't mix.
  const storageKey = `road-trip-os.trip-draft.${userId}`;

  // Pick up where the user left off (e.g. after a page refresh).
  const [restored] = useState(() => restoreDraft(storageKey));
  const [draft, setDraft] = useState<TripDraft>(
    restored?.draft ?? initialDraft,
  );
  const [completedSteps, setCompletedSteps] = useState<
    ReadonlySet<TripStepId>
  >(() => new Set(restored?.completedSteps ?? []));

  const isPristine = draft === initialDraft && completedSteps.size === 0;

  // Save shortly after the last change rather than on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isPristine) {
        clearStoredDraft(storageKey);
      } else {
        saveDraft(storageKey, draft, completedSteps);
      }
    }, SaveDelayMs);

    return () => clearTimeout(timer);
  }, [storageKey, draft, completedSteps, isPristine]);

  // Stable callbacks: steps call these from effects.
  const updateDetails = useCallback(
    (details: Partial<TripDetailsDraft>) => {
      setDraft((current) => ({
        ...current,
        details: { ...current.details, ...details },
      }));
    },
    [],
  );

  const updateRoute = useCallback((route: Partial<RouteDraft>) => {
    setDraft((current) => ({
      ...current,
      route: { ...current.route, ...route },
    }));
  }, []);

  const rememberPlace = useCallback((place: RoutePlace) => {
    setDraft((current) => ({
      ...current,
      route: {
        ...current.route,
        places: { ...current.route.places, [placeKey(place.location)]: place },
      },
    }));
  }, []);

  const setVehicle = useCallback((vehicle: Vehicle | null) => {
    setDraft((current) => ({ ...current, vehicle }));
  }, []);

  const updatePreferences = useCallback(
    (preferences: Partial<PreferencesDraft>) => {
      setDraft((current) => ({
        ...current,
        preferences: { ...current.preferences, ...preferences },
      }));
    },
    [],
  );

  const updateBudget = useCallback((budget: Partial<BudgetDraft>) => {
    setDraft((current) => ({
      ...current,
      budget: { ...current.budget, ...budget },
    }));
  }, []);

  const updateEnergy = useCallback((energy: Partial<EnergyDraft>) => {
    setDraft((current) => ({
      ...current,
      energy: { ...current.energy, ...energy },
    }));
  }, []);

  const setConditions = useCallback(
    (conditions: TripDraft['conditions']) => {
      setDraft((current) => ({ ...current, conditions }));
    },
    [],
  );

  const setFees = useCallback((fees: TripDraft['fees']) => {
    setDraft((current) => ({ ...current, fees }));
  }, []);

  const setChecklist = useCallback((checklist: TripDraft['checklist']) => {
    setDraft((current) => ({ ...current, checklist }));
  }, []);

  const setPersonalChecklist = useCallback((personalChecklist: string[]) => {
    setDraft((current) => ({ ...current, personalChecklist }));
  }, []);

  const setItinerary = useCallback((itinerary: TripDraft['itinerary']) => {
    setDraft((current) => ({ ...current, itinerary }));
  }, []);

  const completeStep = useCallback((id: TripStepId) => {
    setCompletedSteps((current) => new Set(current).add(id));
  }, []);

  const forgetSavedDraft = useCallback(() => {
    clearStoredDraft(storageKey);
  }, [storageKey]);

  const reset = useCallback(() => {
    setDraft(initialDraft);
    setCompletedSteps(new Set());
    clearStoredDraft(storageKey);
  }, [storageKey]);

  const value = useMemo(
    () => ({
      draft,
      isPristine,
      restored: restored !== null,
      forgetSavedDraft,
      updateDetails,
      updateRoute,
      rememberPlace,
      setVehicle,
      updatePreferences,
      updateBudget,
      updateEnergy,
      setConditions,
      setFees,
      setChecklist,
      setPersonalChecklist,
      setItinerary,
      completedSteps,
      completeStep,
      reset,
    }),
    [
      draft,
      isPristine,
      restored,
      forgetSavedDraft,
      updateDetails,
      updateRoute,
      rememberPlace,
      setVehicle,
      updatePreferences,
      updateBudget,
      updateEnergy,
      setConditions,
      setFees,
      setChecklist,
      setPersonalChecklist,
      setItinerary,
      completedSteps,
      completeStep,
      reset,
    ],
  );

  return (
    <TripDraftContext.Provider value={value}>
      {children}
    </TripDraftContext.Provider>
  );
}

export function useTripDraft() {
  const context = useContext(TripDraftContext);

  if (!context) {
    throw new Error('useTripDraft must be used inside TripDraftProvider');
  }

  return context;
}
