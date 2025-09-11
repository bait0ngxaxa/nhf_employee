# Middleware Security Implementation

## Overview
This middleware implements comprehensive authentication and authorization controls for the Employee Management System.

## Features

### 1. **Authentication Protection**
- All routes except public routes require authentication
- Public routes: `/`, `/login`, `/signup`, `/access-denied`
- Unauthenticated users are redirected to login page

### 2. **Session-based Redirects**
- Users with active sessions cannot access login/signup pages
- Automatic redirect to dashboard if already logged in
- Prevents unnecessary re-authentication

### 3. **Role-based Authorization**
- Admin-only routes are protected based on user role
- Admin routes include:
  - `/dashboard/employee-management`
  - `/dashboard/add-employee`
- Non-admin users accessing admin routes → redirect to `/access-denied`

### 4. **Route Protection**
- Covers all application routes except static files and API routes
- Uses Next.js matcher pattern to exclude unnecessary files

## Technical Implementation

### Middleware Configuration
```typescript
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ]
};
```

### Role Checking
- User role is stored in JWT token during authentication
- Middleware checks `token?.role` for admin permissions
- Uses NextAuth.js withAuth wrapper for session management

## Security Flow

1. **Request arrives** → Middleware intercepts
2. **Check public routes** → Allow if public
3. **Check authentication** → Redirect to login if not authenticated
4. **Check session + auth pages** → Redirect to dashboard if already logged in
5. **Check admin routes** → Verify admin role for protected routes
6. **Allow access** → Continue to requested page

## User Experience

### For Regular Users:
- Can access dashboard and general features
- Blocked from admin-only sections with friendly error page
- Automatic redirects prevent confusion

### For Admins:
- Full access to all features
- Seamless navigation between all sections
- Role-based menu filtering in dashboard

### For Unauthenticated Users:
- Redirected to login for protected routes
- Can access public pages (home, login, signup)
- Cannot bypass authentication

## Error Handling
- Custom `/access-denied` page for role violations
- Clear messaging about permission requirements
- Navigation options to return to allowed areas