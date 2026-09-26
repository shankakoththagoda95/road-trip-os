import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

import type { ChecklistCategory } from '@/api/checklists';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Checklist sections, in display order.
export const ChecklistCategories: {
  id: ChecklistCategory;
  title: string;
  icon: IconName;
  tint: string;
}[] = [
  { id: 'documents', title: 'Documents', icon: 'file-document-outline', tint: '#3B82F6' },
  { id: 'payments', title: 'Vignettes & tolls', icon: 'credit-card-outline', tint: '#10B981' },
  { id: 'equipment', title: 'Equipment', icon: 'toolbox-outline', tint: '#F97316' },
  { id: 'winter', title: 'Winter', icon: 'snowflake', tint: '#38BDF8' },
  { id: 'rules', title: 'Driving rules', icon: 'traffic-light-outline', tint: '#EF4444' },
  { id: 'vehicle', title: 'Vehicle', icon: 'car-outline', tint: '#A855F7' },
];

export const PersonalChecklistTint = '#EC4899';

// Quick picks in the personal checklist popup.
export const PersonalChecklistSuggestions = [
  'Phone charger',
  'Power bank',
  'Sunglasses',
  'Water bottles',
  'Snacks',
  'First aid kit',
  'Rain jacket',
  'Travel pillow',
  'Medication',
  'Headphones',
];

// Longest personal item name (matches the backend).
export const PersonalItemMaxLength = 200;
