import { http } from '@/services/api/http';
import type {
  ChangePasswordRequest,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  SimpleMessage,
  UpdateUserRequest,
  User,
} from '@/types/api';

export { authApi } from '@/services/auth/session';

export const accountApi = {
  activateOfficer(payload: { token: string; temporary_password: string; new_password: string; new_password_confirm: string }) {
    return http.post<SimpleMessage>('/auth/staff-activate/', payload, { anonymous: true, tenantId: null });
  },
  updateProfile(payload: UpdateUserRequest) {
    return http.patch<User>('/auth/user/', payload, { tenantId: null });
  },
  changePassword(payload: ChangePasswordRequest) {
    return http.post<SimpleMessage>('/auth/change-password/', payload, { tenantId: null });
  },
  requestPasswordReset(payload: PasswordResetRequest) {
    return http.post<SimpleMessage>('/auth/password-reset/', payload, {
      anonymous: true,
      tenantId: null,
    });
  },
  confirmPasswordReset(payload: PasswordResetConfirmRequest) {
    return http.post<SimpleMessage>('/auth/password-reset/confirm/', payload, {
      anonymous: true,
      tenantId: null,
    });
  },
};
