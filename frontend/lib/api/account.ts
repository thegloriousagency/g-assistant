import { apiFetch } from '@/lib/api-client';

export function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return apiFetch('/users/me/change-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export function changeEmail(payload: { newEmail: string; password: string }) {
  return apiFetch('/users/me/change-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, true);
}

export function confirmEmailChange(token: string) {
  return apiFetch('/users/me/confirm-email-change', {
    method: 'POST',
    body: JSON.stringify({ token }),
  }, true);
}

export function forgotPassword(email: string) {
  return apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(payload: { token: string; newPassword: string }) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
