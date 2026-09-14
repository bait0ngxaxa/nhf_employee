import { z } from "zod";

const positiveIdentifier = z
    .number()
    .int()
    .refine(Number.isSafeInteger)
    .positive();

const stableKey = z
    .string()
    .min(1)
    .max(191)
    .refine((value) => value === value.trim());

const displayName = z.string().trim().min(1).max(191);
const description = z.string().trim().max(191).nullable().optional();

export const createAuthorizationTeamSchema = z.object({
    key: stableKey,
    name: displayName,
    description,
}).strict();

export const updateAuthorizationTeamSchema = z.object({
    name: displayName.optional(),
    description,
    isActive: z.boolean().optional(),
}).strict().refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one Team field is required" },
);

export const createAuthorizationTeamRoleSchema = z.object({
    key: stableKey,
    name: displayName,
}).strict();

export const updateAuthorizationTeamRoleSchema = z.object({
    name: displayName.optional(),
    isActive: z.boolean().optional(),
}).strict().refine(
    (value) => Object.keys(value).length > 0,
    { message: "At least one TeamRole field is required" },
);

export const addAuthorizationTeamMemberSchema = z.object({
    userId: positiveIdentifier,
    teamRoleId: positiveIdentifier.nullable().optional(),
}).strict();

export const changeAuthorizationTeamMemberRoleSchema = z.object({
    teamRoleId: positiveIdentifier.nullable(),
}).strict();

export const authorizationCapabilityGrantSchema = z.object({
    capabilityKey: z.string().min(1).max(191),
    scope: z.string().min(1).max(191),
}).strict();

export type CreateAuthorizationTeamInput = z.infer<
    typeof createAuthorizationTeamSchema
>;
export type UpdateAuthorizationTeamInput = z.infer<
    typeof updateAuthorizationTeamSchema
>;
export type CreateAuthorizationTeamRoleInput = z.infer<
    typeof createAuthorizationTeamRoleSchema
>;
export type UpdateAuthorizationTeamRoleInput = z.infer<
    typeof updateAuthorizationTeamRoleSchema
>;
export type AddAuthorizationTeamMemberInput = z.infer<
    typeof addAuthorizationTeamMemberSchema
>;
export type ChangeAuthorizationTeamMemberRoleInput = z.infer<
    typeof changeAuthorizationTeamMemberRoleSchema
>;
export type AuthorizationCapabilityGrantInput = z.infer<
    typeof authorizationCapabilityGrantSchema
>;

export function isSafeAdministrationIdentifier(value: unknown): value is number {
    return positiveIdentifier.safeParse(value).success;
}

