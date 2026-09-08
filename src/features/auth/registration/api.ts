import { http } from '@/services/api/http';
import type { RegisterRequest } from '@/types/api';

export interface EmailProof {
  email: string;
  token: string;
}
export interface WorkspaceDetails extends RegisterRequest {
  workspace_id: string;
  first_name: string;
  last_name: string;
}
export interface WorkspaceReady {
  workspace: { name: string; slug: string };
  username: string;
}
const options = { anonymous: true, tenantId: null } as const;
export const registrationApi = {
  sendEmail: (email: string) =>
    http.post<{ message: string; resend_after: number }>(
      '/auth/registration/email/',
      { email },
      options,
    ),
  verifyEmail: (email: string, code: string) =>
    http.post<{ registration_token: string; expires_in: number }>(
      '/auth/registration/email/verify/',
      { email, code },
      options,
    ),
  create: (details: WorkspaceDetails, token: string) =>
    http.post<WorkspaceReady>(
      '/auth/registration/',
      { ...details, registration_token: token },
      options,
    ),
};
