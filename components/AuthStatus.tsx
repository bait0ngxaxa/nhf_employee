'use client';

import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { User, LogOut } from 'lucide-react';
import Link from 'next/link';

export function AuthStatus() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex items-center space-x-2">
        <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
        <span className="text-sm text-gray-600">กำลังโหลด...</span>
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-white border rounded-lg px-3 py-2">
          <User className="h-4 w-4 text-gray-600" />
          <div className="text-sm">
            <p className="font-medium text-gray-900">{session.user?.name}</p>
            <p className="text-gray-500">{session.user?.department}</p>
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
        <Button className="flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>เข้าสู่ระบบ</span>
        </Button>
      </Link>
      {/* <Link href="/signup">
        <Button variant="outline" className="flex items-center space-x-2">
          <User className="h-4 w-4" />
          <span>สมัครสมาชิก</span>
        </Button>
      </Link> */}
    </div>
  );
}