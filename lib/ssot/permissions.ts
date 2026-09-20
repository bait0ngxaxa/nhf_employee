export const USER_ROLES = {
    ADMIN: "ADMIN",
    USER: "USER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function isAdminRole(role: string | null | undefined): boolean {
    return role === USER_ROLES.ADMIN;
}
