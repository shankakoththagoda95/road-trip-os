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
  // Wide scene that fades out on its right (the steps overview).
  image?: ImageSourcePropType;
  // Square crop of the same scene (step headers).
  icon?: ImageSourcePropType;
  // Wide scene shown faded on the right of the step's card.
  background?: ImageSourcePropType;
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
    image: require('@/assets/images/brand/steps/details-card.webp'),
    icon: require('@/assets/images/brand/steps/details-icon.webp'),
    background: require('@/assets/images/brand/steps/details-bg.webp'),
    href: '/trips/new/details',
  },
  {
    id: 'route',
    title: 'Route & Destinations',
    description: 'Add stops along the way and preview the route.',
    emoji: '🗺️',
    image: require('@/assets/images/brand/steps/route-card.webp'),
    icon: require('@/assets/images/brand/steps/route-icon.webp'),
    background: require('@/assets/images/brand/steps/route-bg.webp'),
    href: '/trips/new/route',
  },
  {
    id: 'vehicle',
    title: 'Vehicle',
    description: 'Pick the vehicle you will be driving.',
    emoji: '🚙',
    image: require('@/assets/images/brand/steps/vehicle-card.webp'),
    icon: require('@/assets/images/brand/steps/vehicle-icon.webp'),
    background: require('@/assets/images/brand/steps/vehicle-bg.webp'),
    href: '/trips/new/vehicle',
  },
  {
    id: 'preferences',
    title: 'Travel Preferences',
    description: 'Daily driving limits and how you like to travel.',
    emoji: '⚙️',
    image: require('@/assets/images/brand/steps/preferences-card.webp'),
    icon: require('@/assets/images/brand/steps/preferences-icon.webp'),
    background: require('@/assets/images/brand/steps/preferences-bg.webp'),
    href: '/trips/new/preferences',
  },
  {
    id: 'budget',
    title: 'Trip Budget',
    description: 'Set a budget and estimate trip costs.',
    emoji: '💰',
    image: require('@/assets/images/brand/steps/budget-card.webp'),
    icon: require('@/assets/images/brand/steps/budget-icon.webp'),
    background: require('@/assets/images/brand/steps/budget-bg.webp'),
    href: '/trips/new/budget',
  },
  {
    id: 'energy',
    title: 'Fuel / EV Planning',
    description: 'Fuel stops or charging along the route.',
    emoji: '⛽',
    image: require('@/assets/images/brand/steps/energy-card.webp'),
    icon: require('@/assets/images/brand/steps/energy-icon.webp'),
    background: require('@/assets/images/brand/steps/energy-bg.webp'),
    href: '/trips/new/energy',
  },
  {
    id: 'conditions',
    title: 'Weather & Conditions',
    description: 'Forecast and terrain along the way.',
    emoji: '🌦️',
    image: require('@/assets/images/brand/steps/conditions-card.webp'),
    icon: require('@/assets/images/brand/steps/conditions-icon.webp'),
    background: require('@/assets/images/brand/steps/conditions-bg.webp'),
    href: '/trips/new/conditions',
  },
  {
    id: 'fees',
    title: 'Road Fees & Borders',
    description: 'Tolls and border crossings on your route.',
    emoji: '🛂',
    image: require('@/assets/images/brand/steps/fees-card.webp'),
    icon: require('@/assets/images/brand/steps/fees-icon.webp'),
    background: require('@/assets/images/brand/steps/fees-bg.webp'),
    href: '/trips/new/fees',
  },
  {
    id: 'checklist',
    title: 'Travel Checklist',
    description: 'Documents and gear to bring.',
    emoji: '✅',
    image: require('@/assets/images/brand/steps/checklist-card.webp'),
    icon: require('@/assets/images/brand/steps/checklist-icon.webp'),
    background: require('@/assets/images/brand/steps/checklist-bg.webp'),
    href: '/trips/new/checklist',
  },
  {
    id: 'itinerary',
    title: 'Itinerary Review',
    description: 'Review your day-by-day plan.',
    emoji: '📅',
    image: require('@/assets/images/brand/steps/itinerary-card.webp'),
    icon: require('@/assets/images/brand/steps/itinerary-icon.webp'),
    background: require('@/assets/images/brand/steps/itinerary-bg.webp'),
    href: '/trips/new/itinerary',
  },
  {
    id: 'summary',
    title: 'Trip Summary',
    description: 'Review everything and create your trip.',
    emoji: '🚗',
    image: require('@/assets/images/brand/steps/summary-card.webp'),
    icon: require('@/assets/images/brand/steps/summary-icon.webp'),
    background: require('@/assets/images/brand/steps/summary-bg.webp'),
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
