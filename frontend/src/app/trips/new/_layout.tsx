import { Stack } from 'expo-router';

import { TripDraftProvider } from '@/hooks/use-trip-draft';

/**
 * Every screen under /trips/new shares one trip draft.
 */
export default function NewTripLayout() {
  return (
    <TripDraftProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </TripDraftProvider>
  );
}
