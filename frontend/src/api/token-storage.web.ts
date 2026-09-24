const TokenKey = 'road-trip-os.auth-token';

// localStorage can throw (private mode, blocked storage); treat that as
// "no saved session" rather than crashing.
export async function loadToken() {
  try {
    return localStorage.getItem(TokenKey);
  } catch {
    return null;
  }
}

export async function saveToken(token: string) {
  try {
    localStorage.setItem(TokenKey, token);
  } catch {
    // Session still works until the page is reloaded.
  }
}

export async function clearToken() {
  try {
    localStorage.removeItem(TokenKey);
  } catch {
    // Nothing saved to clear.
  }
}
