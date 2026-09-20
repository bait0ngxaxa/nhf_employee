import {
    apiGet,
    apiPatch,
    apiPost,
    apiRequest,
    type ApiErrorCode,
    type ApiResponse,
} from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

import type {
    AddAuthorizationTeamMemberInput,
    AuthorizationAdministrationMutationMembershipData,
    AuthorizationAdministrationMutationTeamData,
    AuthorizationAdministrationMutationTeamGrantData,
    AuthorizationAdministrationMutationTeamRoleData,
    AuthorizationAdministrationMutationTeamRoleGrantData,
    AuthorizationAdministrationMutationUserGrantData,
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationSystemRoleData,
    AuthorizationAdministrationTeamDetailData,
    AuthorizationAdministrationUserDetailData,
    AuthorizationAdministrationUserSummaryData,
    AuthorizationCapabilityGrantInput,
    ChangeSystemRoleInput,
    ChangeAuthorizationTeamMemberRoleInput,
    CreateAuthorizationTeamInput,
    CreateAuthorizationTeamRoleInput,
    UpdateAuthorizationTeamInput,
    UpdateAuthorizationTeamRoleInput,
} from "./types";

export class AuthorizationAdministrationApiError extends Error {
    readonly code: string;
    readonly status: number | undefined;
    readonly requestId: string | undefined;
    readonly details: unknown;

    constructor(response: Extract<ApiResponse<unknown>, { success: false }>) {
        super(response.errorThai || response.error);
        this.name = "AuthorizationAdministrationApiError";
        this.code = getStableErrorCode(response.details) ?? response.code;
        this.status = response.status;
        this.requestId = response.requestId;
        this.details = response.details;
    }
}

function getStableErrorCode(details: unknown): string | null {
    if (typeof details !== "object" || details === null || Array.isArray(details)) {
        return null;
    }
    const code = (details as Record<string, unknown>).code;
    return typeof code === "string" && code.length > 0 ? code : null;
}

async function unwrap<T>(response: ApiResponse<T>): Promise<T> {
    if (!response.success) {
        throw new AuthorizationAdministrationApiError(response);
    }
    return response.data;
}

async function readEnvelope<T>(response: ApiResponse<T>): Promise<T> {
    return unwrap(response);
}

export async function fetchOverview(): Promise<AuthorizationAdministrationOverviewData> {
    const response = await apiGet<{
        readonly overview: AuthorizationAdministrationOverviewData;
    }>(API_ROUTES.authorizationAdministration.overview);
    return (await readEnvelope(response)).overview;
}

export async function fetchTeam(
    teamId: number,
): Promise<AuthorizationAdministrationTeamDetailData> {
    const response = await apiGet<{
        readonly team: AuthorizationAdministrationTeamDetailData;
    }>(API_ROUTES.authorizationAdministration.teamById(teamId));
    return (await readEnvelope(response)).team;
}

export async function searchUsers(
    query: string,
): Promise<readonly AuthorizationAdministrationUserSummaryData[]> {
    const response = await apiGet<{
        readonly users: readonly AuthorizationAdministrationUserSummaryData[];
    }>(API_ROUTES.authorizationAdministration.userSearch(query));
    return (await readEnvelope(response)).users;
}

export async function fetchUser(
    userId: number,
): Promise<AuthorizationAdministrationUserDetailData> {
    const response = await apiGet<{
        readonly user: AuthorizationAdministrationUserDetailData;
    }>(API_ROUTES.authorizationAdministration.userById(userId));
    return (await readEnvelope(response)).user;
}

export async function changeUserSystemRole(
    userId: number,
    input: ChangeSystemRoleInput,
): Promise<AuthorizationAdministrationSystemRoleData> {
    const response = await apiPatch<{
        readonly result: AuthorizationAdministrationSystemRoleData;
    }>(API_ROUTES.authorizationAdministration.userSystemRoleById(userId), input);
    return (await readEnvelope(response)).result;
}

export async function createTeam(
    input: CreateAuthorizationTeamInput,
): Promise<AuthorizationAdministrationMutationTeamData> {
    const response = await apiPost<{
        readonly team: AuthorizationAdministrationMutationTeamData;
    }>(API_ROUTES.authorizationAdministration.overview, input);
    return (await readEnvelope(response)).team;
}

export async function updateTeam(
    teamId: number,
    input: UpdateAuthorizationTeamInput,
): Promise<AuthorizationAdministrationMutationTeamData> {
    const response = await apiPatch<{
        readonly team: AuthorizationAdministrationMutationTeamData;
    }>(API_ROUTES.authorizationAdministration.teamById(teamId), input);
    return (await readEnvelope(response)).team;
}

export async function createTeamRole(
    teamId: number,
    input: CreateAuthorizationTeamRoleInput,
): Promise<AuthorizationAdministrationMutationTeamRoleData> {
    const response = await apiPost<{
        readonly role: AuthorizationAdministrationMutationTeamRoleData;
    }>(API_ROUTES.authorizationAdministration.teamRoles(teamId), input);
    return (await readEnvelope(response)).role;
}

export async function updateTeamRole(
    teamId: number,
    roleId: number,
    input: UpdateAuthorizationTeamRoleInput,
): Promise<AuthorizationAdministrationMutationTeamRoleData> {
    const response = await apiPatch<{
        readonly role: AuthorizationAdministrationMutationTeamRoleData;
    }>(API_ROUTES.authorizationAdministration.teamRoleById(teamId, roleId), input);
    return (await readEnvelope(response)).role;
}

export async function addMember(
    teamId: number,
    input: AddAuthorizationTeamMemberInput,
): Promise<AuthorizationAdministrationMutationMembershipData> {
    const response = await apiPost<{
        readonly membership: AuthorizationAdministrationMutationMembershipData;
    }>(API_ROUTES.authorizationAdministration.teamMembers(teamId), input);
    return (await readEnvelope(response)).membership;
}

export async function changeMemberRole(
    teamId: number,
    userId: number,
    input: ChangeAuthorizationTeamMemberRoleInput,
): Promise<AuthorizationAdministrationMutationMembershipData> {
    const response = await apiPatch<{
        readonly membership: AuthorizationAdministrationMutationMembershipData;
    }>(API_ROUTES.authorizationAdministration.teamMemberById(teamId, userId), input);
    return (await readEnvelope(response)).membership;
}

export async function removeMember(
    teamId: number,
    userId: number,
): Promise<AuthorizationAdministrationMutationMembershipData> {
    const response = await apiRequest<{
        readonly membership: AuthorizationAdministrationMutationMembershipData;
    }>(API_ROUTES.authorizationAdministration.teamMemberById(teamId, userId), {
        method: "DELETE",
    });
    return (await readEnvelope(response)).membership;
}

export async function addTeamGrant(
    teamId: number,
    input: AuthorizationCapabilityGrantInput,
): Promise<AuthorizationAdministrationMutationTeamGrantData> {
    const response = await apiPost<{
        readonly grant: AuthorizationAdministrationMutationTeamGrantData;
    }>(API_ROUTES.authorizationAdministration.teamGrants(teamId), input);
    return (await readEnvelope(response)).grant;
}

export async function removeTeamGrant(
    teamId: number,
    input: AuthorizationCapabilityGrantInput,
): Promise<AuthorizationAdministrationMutationTeamGrantData> {
    const response = await apiRequest<{
        readonly grant: AuthorizationAdministrationMutationTeamGrantData;
    }>(API_ROUTES.authorizationAdministration.teamGrants(teamId), {
        method: "DELETE",
        data: input,
    });
    return (await readEnvelope(response)).grant;
}

export async function addTeamRoleGrant(
    teamId: number,
    roleId: number,
    input: AuthorizationCapabilityGrantInput,
): Promise<AuthorizationAdministrationMutationTeamRoleGrantData> {
    const response = await apiPost<{
        readonly grant: AuthorizationAdministrationMutationTeamRoleGrantData;
    }>(API_ROUTES.authorizationAdministration.teamRoleGrants(teamId, roleId), input);
    return (await readEnvelope(response)).grant;
}

export async function removeTeamRoleGrant(
    teamId: number,
    roleId: number,
    input: AuthorizationCapabilityGrantInput,
): Promise<AuthorizationAdministrationMutationTeamRoleGrantData> {
    const response = await apiRequest<{
        readonly grant: AuthorizationAdministrationMutationTeamRoleGrantData;
    }>(API_ROUTES.authorizationAdministration.teamRoleGrants(teamId, roleId), {
        method: "DELETE",
        data: input,
    });
    return (await readEnvelope(response)).grant;
}

export async function addUserGrant(
    userId: number,
    input: AuthorizationCapabilityGrantInput,
): Promise<AuthorizationAdministrationMutationUserGrantData> {
    const response = await apiPost<{
        readonly grant: AuthorizationAdministrationMutationUserGrantData;
    }>(API_ROUTES.authorizationAdministration.userGrants(userId), input);
    return (await readEnvelope(response)).grant;
}

export async function removeUserGrant(
    userId: number,
    input: AuthorizationCapabilityGrantInput,
): Promise<AuthorizationAdministrationMutationUserGrantData> {
    const response = await apiRequest<{
        readonly grant: AuthorizationAdministrationMutationUserGrantData;
    }>(API_ROUTES.authorizationAdministration.userGrants(userId), {
        method: "DELETE",
        data: input,
    });
    return (await readEnvelope(response)).grant;
}

export type AuthorizationAdministrationTransportErrorCode = ApiErrorCode;
