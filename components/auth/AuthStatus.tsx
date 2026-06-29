"use client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { User, LogOut } from "lucide-react";
import Link from "next/link";
import { isValidSessionUser } from "@/lib/auth/ssot";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { useAuth } from "@/components/auth/HybridAuthProvider";

export function AuthStatus() {
    const { user, status, signOut } = useAuth();
    const hasValidSession = isValidSessionUser(user);

    if (status === "loading") {
        return <Skeleton className="h-9 w-28 rounded-md" />;
    }

    if (hasValidSession) {
        return (
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-white border rounded-lg px-3 py-2">
                    <User className="h-4 w-4 text-gray-600" />
                    <div className="text-sm">
                        <p className="font-medium text-gray-900">
                            {user?.name}
                        </p>
                        <p className="text-gray-500">
                            {user?.department}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => void signOut()}
                    variant="outline"
                    size="sm"
                    className="flex items-center space-x-2"
                >
                    <LogOut className="h-4 w-4" />
                    <span>ออกจากระบบ</span>
                </Button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 sm:gap-3">
            <Link href={APP_ROUTES.login}>
                <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700">
                    <User className="h-4 w-4" />
                    <span>เข้าสู่ระบบ</span>
                </Button>
            </Link>
            <Link href={APP_ROUTES.signup}>
                <Button
                    variant="outline"
                    className="hidden border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800 sm:inline-flex"
                >
                    <User className="h-4 w-4" />
                    <span>ลงทะเบียน</span>
                </Button>
            </Link>
        </div>
    );
}
