import * as SecureStore from 'expo-secure-store';

const TokenKey = 'road-trip-os.auth-token';

// Native: keychain / keystore. The web version uses localStorage.
export function loadToken() {
  return SecureStore.getItemAsync(TokenKey);
}

export function saveToken(token: string) {
  return SecureStore.setItemAsync(TokenKey, token);
}

export function clearToken() {
  return SecureStore.deleteItemAsync(TokenKey);
}
