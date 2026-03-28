/** User context for authorization and service calls */
export interface UserContext {
    id: number;
    role: string;
    email: string;
    name: string | null;
}

export function buildUserContext(session: {
    user: { id: string; role?: string; email?: string | null; name?: string | null };
}): UserContext {
    return {
        id: parseInt(session.user.id),
        role: session.user.role || "USER",
        email: session.user.email ?? "",
        name: session.user.name ?? null,
    };
}
