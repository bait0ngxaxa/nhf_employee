// /app/api/auth/[...nextauth]/route.ts
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import type { NextAuthOptions, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { logAuthEvent } from "@/lib/audit";

function invalidateToken(token: JWT): JWT {
    token.sub = undefined;
    token.id = undefined;
    token.role = undefined;
    token.department = undefined;
    token.isManager = undefined;
    token.tokenVersion = undefined;
    token.exp = Math.floor(Date.now() / 1000) - 60;
    return token;
}

// Define the NextAuth.js configuration options
export const authOptions: NextAuthOptions = {
    // Use CredentialsProvider for email/password authentication
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: {
                    label: "Email",
                    type: "email",
                    placeholder: "john@doe.com",
                },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                // Validate that both email and password are provided.
                // The optional chaining (`?.`) ensures we don't get an error if credentials is null or undefined.
                // The explicit check `typeof credentials.email !== 'string'` ensures TypeScript knows their types.
                if (
                    !credentials?.email ||
                    typeof credentials.email !== "string" ||
                    !credentials?.password ||
                    typeof credentials.password !== "string"
                ) {
                    return null;
                }

                // Find the user by email in the database
                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                    include: {
                        // Include tokenVersion for stateless session invalidation checks.
                        // We store it in JWT and compare against DB on subsequent requests.
                        employee: {
                            include: {
                                dept: true,
                                subordinates: { select: { id: true }, take: 1 },
                            },
                        },
                    },
                });

                // Check if the user exists and the password is correct
                if (
                    user &&
                    (await bcrypt.compare(credentials.password, user.password))
                ) {
                    // Log successful login
                    await logAuthEvent("LOGIN_SUCCESS", user.id, user.email, {
                        metadata: { name: user.name, role: user.role },
                    });

                    // IMPORTANT: Do NOT return the password field.
                    // The returned object must match the NextAuth 'User' type, which expects 'id' to be a string.
                    const authorizedUser: User = {
                        id: String(user.id),
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        department: user.employee?.dept?.name || undefined,
                        isManager: (user.employee?.subordinates?.length ?? 0) > 0,
                        tokenVersion: user.tokenVersion,
                    };
                    return authorizedUser;
                } else {
                    // Log failed login attempt
                    await logAuthEvent(
                        "LOGIN_FAILED",
                        undefined,
                        credentials.email,
                        { metadata: { reason: "Invalid credentials" } }
                    );

                    // This is the key fix: instead of throwing an error, return `null`.
                    // NextAuth handles the "invalid credentials" message internally when `null` is returned.
                    // Throwing an error here would cause the server to return an HTTP 500 error, which is incorrect.
                    return null;
                }
            },
        }),
    ],

    // Use JWT strategy for session management
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days for Zero Trust session policy
    },

    // Callbacks to manage the JWT token and session
    callbacks: {
        jwt: async ({ token, user }) => {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.department = user.department;
                token.isManager = user.isManager;
                token.tokenVersion = user.tokenVersion;
                return token;
            }

            const userId = Number.parseInt(token.sub ?? "", 10);
            if (!Number.isInteger(userId) || userId <= 0) {
                return invalidateToken(token);
            }

            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { isActive: true, tokenVersion: true },
            });

            if (!dbUser || !dbUser.isActive || token.tokenVersion !== dbUser.tokenVersion) {
                return invalidateToken(token);
            }

            return token;
        },
        session: async ({ session, token }) => {
            if (typeof token.id !== "string" || typeof token.role !== "string") {
                session.expires = new Date(0).toISOString();
                if (session.user) {
                    session.user.id = "";
                    session.user.role = "";
                }
                return session;
            }

            if (session.user) {
                session.user.id = token.id;
                session.user.role = token.role;
                session.user.department = token.department as string;
                session.user.isManager = token.isManager as boolean;
            }
            return session;
        },
    },

    // Custom pages for authentication
    pages: {
        signIn: "/login",
        // error: "/login", // We can set this if needed to catch auth errors on the login page
    },
};

// Export only the authOptions configuration

