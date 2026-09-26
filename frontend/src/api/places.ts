import { apiRequest } from '@/api/client';

export type PhotoAttribution = {
  name: string;
  url: string | null;
};

export type PlaceLookup = {
  query: string;
  name: string;
  address: string;
  country: string | null;
  latitude: number;
  longitude: number;
  // Google place photo, or null when the place has none.
  photo_url: string | null;
  // Must be shown next to the photo.
  photo_attributions: PhotoAttribution[];
};

/**
 * Best match for a place name, with a photo. Fails with code
 * `places_not_configured` (503) when the server has no Google key.
 */
export function lookupPlace(query: string) {
  return apiRequest<PlaceLookup>(
    `/places/lookup?q=${encodeURIComponent(query)}`,
  );
}

export type ReversePlace = {
  // Town or city.
  name: string;
  region: string | null;
  country: string | null;
  country_code: string | null;
};

/**
 * The town or city at a position. 404 (ApiError) where there's none.
 */
export function reversePlace(latitude: number, longitude: number) {
  return apiRequest<ReversePlace>(
    `/places/reverse?latitude=${latitude}&longitude=${longitude}`,
  );
}
