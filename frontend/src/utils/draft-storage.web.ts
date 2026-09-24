// localStorage can be unavailable (private mode, blocked site data) or full;
// every call fails soft so planning keeps working in memory.

export function loadStoredDraft(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// Returns false when the value couldn't be stored (e.g. quota exceeded).
export function storeDraft(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function clearStoredDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
}
