"use client";

import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { User, LogOut } from "lucide-react";
import Link from "next/link";

export function AuthStatus() {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return <Skeleton className="h-9 w-28 rounded-md" />;
    }

    if (session) {
        return (
            <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 bg-white border rounded-lg px-3 py-2">
                    <User className="h-4 w-4 text-gray-600" />
                    <div className="text-sm">
                        <p className="font-medium text-gray-900">
                            {session.user?.name}
                        </p>
                        <p className="text-gray-500">
                            {session.user?.department}
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => signOut()}
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
        <div className="flex items-center space-x-4">
            <Link href="/login">
                <Button className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25 transition-[transform,background-color,box-shadow] duration-300 motion-safe:hover:scale-[1.02]">
                    <User className="h-4 w-4" />
                    <span>เข้าสู่ระบบ</span>
                </Button>
            </Link>
            <Link href="/signup">
                <Button
                    variant="outline"
                    className="flex items-center space-x-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-300"
                >
                    <User className="h-4 w-4" />
                    <span>ลงทะเบียน</span>
                </Button>
            </Link>
        </div>
    );
}
