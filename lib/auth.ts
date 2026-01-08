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
                        // FIX: Explicitly cast the user ID to a string to match NextAuth's User type.
                        id: String(user.id),
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        department: user.employee?.dept?.name || undefined,
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
        maxAge: 60 * 60, // กำหนดอายุของ session เป็น 1 ชั่วโมง
    },

    // Callbacks to manage the JWT token and session
    callbacks: {
        jwt: async ({ token, user }) => {
            // Add the user's ID to the JWT token
            if (user) {
                token.id = user.id;
                token.role = user.role;
                token.department = user.department;
            }
            return token;
        },
        session: async ({ session, token }) => {
            // Add the user's ID from the token to the session object
            if (session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.department = token.department as string;
            }
            return session;
        },
    },
};

// Export only the authOptions configuration
