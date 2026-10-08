import { apiRequest } from '@/api/client';

export type AdminUser = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  email_verified: boolean;
  is_admin: boolean;
  created_at: string;
};

export type AdminUserCreate = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  is_admin: boolean;
};

// Admin endpoints only answer on this computer (403 `admin_local_only`)
// and for administrators (403 `not_admin`).

export function listUsers() {
  return apiRequest<AdminUser[]>('/admin/users');
}

export type AdminSettings = {
  // People can create their own account at /register.
  registration_open: boolean;
};

export function getAdminSettings() {
  return apiRequest<AdminSettings>('/admin/settings');
}

// Applies straight away.
export function updateAdminSettings(changes: AdminSettings) {
  return apiRequest<AdminSettings>('/admin/settings', {
    method: 'PUT',
    body: changes,
  });
}

/**
 * Creates an account that can sign in straight away.
 */
export function createUser(user: AdminUserCreate) {
  return apiRequest<AdminUser>('/admin/users', { method: 'POST', body: user });
}
