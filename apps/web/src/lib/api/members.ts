import { request } from './client';
import type {
  Member,
  MemberListResponse,
  UpdateMemberRequest,
  Invite,
  InviteListResponse,
  CreateInviteRequest,
} from './client';

export const membersApi = {
  list(projectId: string): Promise<MemberListResponse> {
    return request('GET', `/api/v1/projects/${projectId}/members`);
  },

  inviteMember(projectId: string, body: CreateInviteRequest): Promise<Invite> {
    return request('POST', `/api/v1/projects/${projectId}/invites`, body);
  },

  updateRole(projectId: string, memberId: string, body: UpdateMemberRequest): Promise<Member> {
    return request('PATCH', `/api/v1/projects/${projectId}/members/${memberId}`, body);
  },

  remove(projectId: string, memberId: string): Promise<void> {
    return request('DELETE', `/api/v1/projects/${projectId}/members/${memberId}`);
  },

  listInvites(projectId: string): Promise<InviteListResponse> {
    return request('GET', `/api/v1/projects/${projectId}/invites`);
  },

  acceptInvite(projectId: string, inviteId: string): Promise<Invite> {
    return request('POST', `/api/v1/projects/${projectId}/invites/${inviteId}/accept`);
  },

  revokeInvite(projectId: string, inviteId: string): Promise<Invite> {
    return request('POST', `/api/v1/projects/${projectId}/invites/${inviteId}/revoke`);
  },
};
