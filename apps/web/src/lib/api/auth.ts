import { request } from './client';
import type { AuthResponse, User, MessageResponse, SessionResponse } from './client';

export const authApi = {
  signup(body: { email: string; password: string; name: string }): Promise<AuthResponse> {
    return request('POST', '/api/auth/signup', body);
  },

  signin(body: { email: string; password: string }): Promise<AuthResponse> {
    return request('POST', '/api/auth/signin', body);
  },

  signout(): Promise<MessageResponse> {
    return request('POST', '/api/auth/signout');
  },

  session(): Promise<User> {
    return request('GET', '/api/auth/session');
  },

  getSessions(): Promise<SessionResponse[]> {
    return request('GET', '/api/auth/sessions');
  },

  forgotPassword(body: { email: string }): Promise<MessageResponse> {
    return request('POST', '/api/auth/forgot-password', body);
  },

  resetPassword(body: { token: string; new_password: string }): Promise<MessageResponse> {
    return request('POST', '/api/auth/reset-password', body);
  },

  changePassword(body: { current_password: string; new_password: string }): Promise<MessageResponse> {
    return request('POST', '/api/auth/change-password', body);
  },

  updateProfile(body: { name?: string; email?: string }): Promise<User> {
    return request('PATCH', '/api/auth/me', body);
  },

  deleteAccount(): Promise<MessageResponse> {
    return request('DELETE', '/api/auth/me');
  },

  setup2FA(): Promise<{ secret_uri: string; backup_codes: string[] }> {
    return request('POST', '/api/auth/2fa/setup');
  },

  verify2FA(body: { code: string }): Promise<MessageResponse> {
    return request('POST', '/api/auth/2fa/verify', body);
  },

  disable2FA(body: { password: string }): Promise<MessageResponse> {
    return request('POST', '/api/auth/2fa/disable', body);
  },

  listOAuthAccounts(): Promise<{ provider: string; provider_email: string }[]> {
    return request('GET', '/api/auth/oauth/accounts');
  },

  unlinkOAuthAccount(provider: string): Promise<MessageResponse> {
    return request('DELETE', `/api/auth/oauth/${provider}`);
  },
};
