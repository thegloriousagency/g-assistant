import { useMutation } from '@tanstack/react-query';
import {
  changeEmail,
  changePassword,
  confirmEmailChange,
  forgotPassword,
  resetPassword,
} from '@/lib/api/account';

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      changePassword(payload),
  });
}

export function useChangeEmail() {
  return useMutation({
    mutationFn: (payload: { newEmail: string; password: string }) =>
      changeEmail(payload),
  });
}

export function useConfirmEmailChange() {
  return useMutation({
    mutationFn: (token: string) => confirmEmailChange(token),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => forgotPassword(email),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: { token: string; newPassword: string }) =>
      resetPassword(payload),
  });
}
