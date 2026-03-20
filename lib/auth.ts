// /app/api/auth/[...nextauth]/route.ts
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import type { NextAuthOptions, User } from "next-auth";
import { logAuthEvent } from "@/lib/audit";

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
        maxAge: 30 * 24 * 60 * 60, // กำหนดอายุของ session เป็น 30 วัน (1 เดือนตาม Zero Trust)
    },

    // Callbacks to manage the JWT token and session
    callbacks: {
        jwt: async ({ token, user }) => {
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.department = user.department;
                token.isManager = user.isManager;
            }
            return token;
        },
        session: async ({ session, token }) => {
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
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
