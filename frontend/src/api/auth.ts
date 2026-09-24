import { apiRequest } from '@/api/client';

export type User = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
};

export type RegisterData = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
};

type TokenResponse = {
  access_token: string;
  token_type: 'bearer';
};

export function login(email: string, password: string) {
  return apiRequest<TokenResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function register(data: RegisterData) {
  return apiRequest<User>('/users/', { method: 'POST', body: data });
}

export function getMe() {
  return apiRequest<User>('/users/me');
}
