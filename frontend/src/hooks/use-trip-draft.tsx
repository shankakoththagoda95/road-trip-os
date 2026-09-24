import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import type { RoutePreview } from '@/api/routes';
import type { TripType } from '@/api/trips';
import type { Vehicle } from '@/api/vehicles';
import type { TripStepId } from '@/constants/trip-steps';

export type { TripType };

export type TripDetailsDraft = {
  name: string;
  startLocation: string;
  destination: string;
  tripType: TripType;
  // Local date and time, as `YYYY-MM-DD` and `HH:MM`.
  departureDate: string;
  departureTime: string;
  durationDays: number;
  travelers: number;
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
  // Geocoded start / destination. Only valid while `location` still matches
  // the text in Trip Details.
  start: RoutePlace | null;
  destination: RoutePlace | null;
  stops: RoutePlace[];
  // Last calculated route, tagged with the request it was calculated for.
  preview: { key: string; data: RoutePreview } | null;
};

export type PreferencesDraft = {
  limitDrivingHours: boolean;
  maxDrivingHours: number;
  limitDistance: boolean;
  maxDistanceKm: number;
};

// Each wizard step adds its own section here as it gets built.
export type TripDraft = {
  details: TripDetailsDraft;
  route: RouteDraft;
  // Null until the user picks one (the trip can be saved without it).
  vehicle: Vehicle | null;
  preferences: PreferencesDraft;
};

const initialDraft: TripDraft = {
  details: {
    name: '',
    startLocation: '',
    destination: '',
    tripType: 'one_way',
    departureDate: '',
    departureTime: '09:00',
    durationDays: 1,
    travelers: 1,
  },
  route: {
    start: null,
    destination: null,
    stops: [],
    preview: null,
  },
  vehicle: null,
  preferences: {
    limitDrivingHours: false,
    maxDrivingHours: 8,
    limitDistance: false,
    maxDistanceKm: 500,
  },
};

type TripDraftContextValue = {
  draft: TripDraft;
  updateDetails: (details: Partial<TripDetailsDraft>) => void;
  updateRoute: (route: Partial<RouteDraft>) => void;
  setVehicle: (vehicle: Vehicle | null) => void;
  updatePreferences: (preferences: Partial<PreferencesDraft>) => void;
  completedSteps: ReadonlySet<TripStepId>;
  completeStep: (id: TripStepId) => void;
  reset: () => void;
};

const TripDraftContext = createContext<TripDraftContextValue | undefined>(
  undefined,
);

/**
 * Holds the trip being planned while the user moves between wizard steps.
 */
export function TripDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState<TripDraft>(initialDraft);
  const [completedSteps, setCompletedSteps] = useState<
    ReadonlySet<TripStepId>
  >(new Set());

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

  const completeStep = useCallback((id: TripStepId) => {
    setCompletedSteps((current) => new Set(current).add(id));
  }, []);

  const reset = useCallback(() => {
    setDraft(initialDraft);
    setCompletedSteps(new Set());
  }, []);

  const value = useMemo(
    () => ({
      draft,
      updateDetails,
      updateRoute,
      setVehicle,
      updatePreferences,
      completedSteps,
      completeStep,
      reset,
    }),
    [
      draft,
      updateDetails,
      updateRoute,
      setVehicle,
      updatePreferences,
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
