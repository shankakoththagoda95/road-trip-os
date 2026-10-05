import { apiRequest } from '@/api/client';

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  // Can open the admin panel (/admin).
  is_admin: boolean;
};

export type RegisterData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
};

type MessageResponse = { message: string };

// Fails with code `email_not_verified` (403) until the email is confirmed.
export function login(email: string, password: string) {
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

// Whether people can create their own account; otherwise an
// administrator creates accounts.
export function getRegistrationStatus() {
  return apiRequest<{ open: boolean }>('/users/registration');
}

// Creates an unverified account and emails a confirmation link.
export function register(data: RegisterData) {
  return apiRequest<User>('/users/', { method: 'POST', body: data });
}

export function getMe() {
  return apiRequest<User>('/users/me');
}

// Confirms the email from the emailed link and signs the user in.
export function verifyEmail(token: string) {
  return apiRequest<TokenResponse>('/auth/verify-email', {
    method: 'POST',
    body: { token },
  });
}

export function resendVerification(email: string) {
  return apiRequest<MessageResponse>('/auth/resend-verification', {
    method: 'POST',
    body: { email },
  });
}

export function forgotPassword(email: string) {
  return apiRequest<MessageResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  });
}

// Sets a new password from the emailed link and signs the user in.
export function resetPassword(token: string, password: string) {
  return apiRequest<TokenResponse>('/auth/reset-password', {
    method: 'POST',
    body: { token, password },
  });
}
