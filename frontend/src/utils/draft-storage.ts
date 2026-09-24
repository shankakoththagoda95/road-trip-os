/**
 * Native: no persistence yet (the draft lives as long as the app process).
 * The web version (draft-storage.web.ts) survives page refreshes.
 * TODO: persist on native too (e.g. expo-sqlite key-value storage).
 */
export function loadStoredDraft(_key: string): string | null {
  return null;
}

export function storeDraft(_key: string, _value: string): boolean {
  return true;
}

export function clearStoredDraft(_key: string) {}
