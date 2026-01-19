/** User context for authorization and service calls */
export interface UserContext {
    id: number;
    role: string;
    email: string;
}

export function buildUserContext(session: {
    user: { id: string; role?: string; email?: string | null };
}): UserContext {
    return {
        id: parseInt(session.user.id),
        role: session.user.role || "USER",
        email: session.user.email ?? "",
    };
}
