export const USER_ROLES = {
    ADMIN: "ADMIN",
    USER: "USER",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export function isAdminRole(role: string | null | undefined): boolean {
    return role === USER_ROLES.ADMIN;
}

export function getRoleLabelThai(role: string | null | undefined): string {
    return isAdminRole(role) ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน";
}
