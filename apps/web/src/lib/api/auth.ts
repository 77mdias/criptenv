import { request } from './client';
import type { AuthResponse, User, MessageResponse } from './client';

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
};
