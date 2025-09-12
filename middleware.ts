import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";


export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    
    // If user has session and tries to access login/signup, redirect to dashboard
    if (token && (pathname === '/login' || pathname === '/signup')) {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    
    // Admin-only routes
    const adminOnlyRoutes = [
      '/dashboard/employee-management',
      '/dashboard/add-employee',
      '/dashboard/email-request'
    ];
    
    // Check if current path is admin-only
    const isAdminRoute = adminOnlyRoutes.some(route => pathname.startsWith(route));
    
    // If it's an admin route and user is not admin, redirect to access denied
    if (isAdminRoute && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/access-denied', req.url));
    }
    
    // Allow access for authenticated users
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        
        // Public routes that don't require authentication
        const publicRoutes = ['/', '/login', '/signup', '/access-denied'];
        
        // Allow access to public routes
        if (publicRoutes.includes(pathname)) {
          return true;
        }
        
        // All other routes require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    // Match all routes except static files and API routes
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
};