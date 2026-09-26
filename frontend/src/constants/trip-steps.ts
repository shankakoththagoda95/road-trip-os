import type { Href } from 'expo-router';
import type { ImageSourcePropType } from 'react-native';

export type TripStepId =
  | 'details'
  | 'route'
  | 'vehicle'
  | 'preferences'
  | 'budget'
  | 'energy'
  | 'conditions'
  | 'fees'
  | 'checklist'
  | 'itinerary'
  | 'summary';

export type TripStep = {
  id: TripStepId;
  title: string;
  description: string;
  emoji: string;
  image?: ImageSourcePropType;
  // Steps without an href have not been built yet.
  href?: Href;
};

/**
 * The new-trip wizard, in the order the user walks through it.
 */
export const TripSteps: readonly TripStep[] = [
  {
    id: 'details',
    title: 'Trip Details',
    description: 'Name, start, destination, dates and travelers.',
    emoji: '📝',
    image: require('@/assets/images/step-icons/details.png'),
    href: '/trips/new/details',
  },
  {
    id: 'route',
    title: 'Route & Destinations',
    description: 'Add stops along the way and preview the route.',
    emoji: '🗺️',
    image: require('@/assets/images/step-icons/route.png'),
    href: '/trips/new/route',
  },
  {
    id: 'vehicle',
    title: 'Vehicle',
    description: 'Pick the vehicle you will be driving.',
    emoji: '🚙',
    image: require('@/assets/images/step-icons/vehicle.png'),
    href: '/trips/new/vehicle',
  },
  {
    id: 'preferences',
    title: 'Travel Preferences',
    description: 'Daily driving limits and how you like to travel.',
    emoji: '⚙️',
    image: require('@/assets/images/step-icons/preferences.png'),
    href: '/trips/new/preferences',
  },
  {
    id: 'budget',
    title: 'Trip Budget',
    description: 'Set a budget and estimate trip costs.',
    emoji: '💰',
    image: require('@/assets/images/step-icons/budget.png'),
    href: '/trips/new/budget',
  },
  {
    id: 'energy',
    title: 'Fuel / EV Planning',
    description: 'Fuel stops or charging along the route.',
    emoji: '⛽',
    image: require('@/assets/images/step-icons/energy.png'),
    href: '/trips/new/energy',
  },
  {
    id: 'conditions',
    title: 'Weather & Conditions',
    description: 'Forecast and terrain along the way.',
    emoji: '🌦️',
    image: require('@/assets/images/step-icons/conditions.png'),
    href: '/trips/new/conditions',
  },
  {
    id: 'fees',
    title: 'Road Fees & Borders',
    description: 'Tolls and border crossings on your route.',
    emoji: '🛂',
    image: require('@/assets/images/step-icons/fees.png'),
    href: '/trips/new/fees',
  },
  {
    id: 'checklist',
    title: 'Travel Checklist',
    description: 'Documents and gear to bring.',
    emoji: '✅',
    image: require('@/assets/images/step-icons/checklist.png'),
    href: '/trips/new/checklist',
  },
  {
    id: 'itinerary',
    title: 'Itinerary Review',
    description: 'Review your day-by-day plan.',
    emoji: '📅',
    image: require('@/assets/images/step-icons/itinerary.png'),
    href: '/trips/new/itinerary',
  },
  {
    id: 'summary',
    title: 'Trip Summary',
    description: 'Review everything and create your trip.',
    emoji: '🚗',
    image: require('@/assets/images/step-icons/summary.png'),
    href: '/trips/new/summary',
  },
];

export function getTripStep(id: TripStepId) {
  const index = TripSteps.findIndex((step) => step.id === id);

  return {
    step: TripSteps[index],
    index,
    previous: TripSteps[index - 1] as TripStep | undefined,
    next: TripSteps[index + 1] as TripStep | undefined,
  };
}
