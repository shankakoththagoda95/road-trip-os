import type { ImageSourcePropType } from 'react-native';

export type PopularDestination = {
  name: string;
  country: string;
  // Add a photo (e.g. assets/images/destinations/banff.jpg) to show it on
  // the dashboard; without one a styled placeholder is shown.
  image?: ImageSourcePropType;
};

export const PopularDestinations: readonly PopularDestination[] = [
  { name: 'Banff', country: 'Canada' },
  { name: 'Yosemite', country: 'USA' },
  { name: 'Zion', country: 'USA' },
];
