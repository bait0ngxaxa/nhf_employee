import type {
    AuthorizationAdministrationAccountIdentity,
    AuthorizationAdministrationGrantProjection,
    AuthorizationAdministrationOverview,
    AuthorizationAdministrationConfigurationIssue,
    AuthorizationAdministrationResolverEffectivePermission,
    AuthorizationAdministrationTeamDetail,
    AuthorizationAdministrationUserDetail,
    AuthorizationAdministrationUserSummary,
} from "../../application/administration-types";
import type {
    AuthorizationAdministrationMutationMembership,
    AuthorizationAdministrationMutationTeam,
    AuthorizationAdministrationMutationTeamGrant,
    AuthorizationAdministrationMutationTeamRole,
    AuthorizationAdministrationMutationTeamRoleGrant,
    AuthorizationAdministrationMutationUserGrant,
} from "../../application/administration-mutation-types";
import type {
    AddAuthorizationTeamMemberInput,
    AuthorizationCapabilityGrantInput,
    ChangeAuthorizationTeamMemberRoleInput,
    CreateAuthorizationTeamInput,
    CreateAuthorizationTeamRoleInput,
    UpdateAuthorizationTeamInput,
    UpdateAuthorizationTeamRoleInput,
} from "../../application/administration-mutation-schemas";

/** Date values arrive as strings over HTTP and as Date instances from RSC. */
export type ClientDate = Date | string;

type Clientize<T> = T extends Date
    ? ClientDate
    : T extends readonly (infer Item)[]
        ? readonly Clientize<Item>[]
        : T extends object
            ? { readonly [Key in keyof T]: Clientize<T[Key]> }
            : T;

export type AuthorizationAdministrationOverviewData = Clientize<
    AuthorizationAdministrationOverview
>;
export type AuthorizationAdministrationTeamDetailData = Clientize<
    AuthorizationAdministrationTeamDetail
>;
export type AuthorizationAdministrationUserDetailData = Clientize<
    AuthorizationAdministrationUserDetail
>;
export type AuthorizationAdministrationUserSummaryData = Clientize<
    AuthorizationAdministrationUserSummary
>;
export type AuthorizationAdministrationAccountIdentityData = Clientize<
    AuthorizationAdministrationAccountIdentity
>;
export type AuthorizationAdministrationGrantProjectionData = Clientize<
    AuthorizationAdministrationGrantProjection
>;
export type AuthorizationAdministrationConfigurationIssueData = Clientize<
    AuthorizationAdministrationConfigurationIssue
>;
export type AuthorizationAdministrationResolverPermissionData = Clientize<
    AuthorizationAdministrationResolverEffectivePermission
>;

export type AuthorizationAdministrationMutationTeamData = Clientize<
    AuthorizationAdministrationMutationTeam
>;
export type AuthorizationAdministrationMutationTeamRoleData = Clientize<
    AuthorizationAdministrationMutationTeamRole
>;
export type AuthorizationAdministrationMutationMembershipData = Clientize<
    AuthorizationAdministrationMutationMembership
>;
export type AuthorizationAdministrationMutationTeamGrantData = Clientize<
    AuthorizationAdministrationMutationTeamGrant
>;
export type AuthorizationAdministrationMutationTeamRoleGrantData = Clientize<
    AuthorizationAdministrationMutationTeamRoleGrant
>;
export type AuthorizationAdministrationMutationUserGrantData = Clientize<
    AuthorizationAdministrationMutationUserGrant
>;

export type {
    AddAuthorizationTeamMemberInput,
    AuthorizationCapabilityGrantInput,
    ChangeAuthorizationTeamMemberRoleInput,
    CreateAuthorizationTeamInput,
    CreateAuthorizationTeamRoleInput,
    UpdateAuthorizationTeamInput,
    UpdateAuthorizationTeamRoleInput,
};
