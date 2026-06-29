export interface AuthenticatedUser {
    id: string;
    role: string;
    email?: string | null;
    name?: string | null;
    department?: string;
    isManager?: boolean;
}

export interface HybridAuthSession {
    user: AuthenticatedUser;
}
