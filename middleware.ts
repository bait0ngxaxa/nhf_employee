import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
    function middleware(req) {
        const { pathname } = req.nextUrl;
        const token = req.nextauth.token;

        // If user has session and tries to access login/signup, redirect to dashboard
        // Root path (/) is accessible for everyone regardless of session status
        if (token && (pathname === "/login" || pathname === "/signup")) {
            return NextResponse.redirect(new URL("/dashboard", req.url));
        }

        // Allow access for authenticated users (handled by 'authorized' callback below)
        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token, req }) => {
                const { pathname } = req.nextUrl;

                // Public routes that don't require authentication
                const publicRoutes = [
                    "/",
                    "/login",
                    "/signup",
                    "/access-denied",
                ];

                // Always allow access to public routes (including root path)
                if (publicRoutes.includes(pathname)) {
                    return true;
                }

                // For protected routes, require authentication
                return !!token;
            },
        },
    },
);

export const config = {
    matcher: [
        // Match all routes except static files and API routes
        "/((?!api|_next/static|_next/image|favicon.ico).*)",
    ],
};
