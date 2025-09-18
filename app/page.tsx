'use client';

import { AuthStatus } from "../components/AuthStatus";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, BarChart3, Shield, Clock, Database } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Session } from 'next-auth';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">ระบบบันทึกข้อมูล แจ้งปัญหาไอทีและติดตามสถานะ</h1>
                <p className="text-sm text-gray-500">Employee Management System</p>
              </div>
            </div>
            <AuthStatus />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {session ? (
          <AuthenticatedContent session={session} />
        ) : (
          <UnauthenticatedContent />
        )}
      </main>
    </div>
  );
}

// Component for authenticated users
function AuthenticatedContent({ session }: { session: Session }) {
  return (
    <>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">ยินดีต้อนรับคุณ {session.user?.name}</h2>
        <p className="text-lg text-gray-600">จัดการข้อมูลพนักงานในองค์กรของคุณอย่างมีประสิทธิภาพ</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <UserPlus className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <CardTitle className="text-lg">เพิ่มพนักงานใหม่</CardTitle>
              <CardDescription>บันทึกข้อมูลพนักงานใหม่เข้าระบบ</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/employees/add">
              <Button className="w-full">เพิ่มพนักงาน</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Users className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <CardTitle className="text-lg">จัดการพนักงาน</CardTitle>
              <CardDescription>ดูและแก้ไขข้อมูลพนักงาน</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/employees">
              <Button variant="outline" className="w-full">ดูรายการพนักงาน</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow cursor-pointer">
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <BarChart3 className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <CardTitle className="text-lg">รายงาน</CardTitle>
              <CardDescription>ดูสถิติและรายงานพนักงาน</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/reports">
              <Button variant="outline" className="w-full">ดูรายงาน</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">พนักงานทั้งหมด</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">156</div>
            <p className="text-xs text-gray-500">+12% จากเดือนที่แล้ว</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">แผนกบริหาร</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">89</div>
            <p className="text-xs text-gray-500">57%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">แผนกวิชาการ</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">67</div>
            <p className="text-xs text-gray-500">43%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">เข้าร่วมใหม่</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">12</div>
            <p className="text-xs text-gray-500">เดือนนี้</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Component for unauthenticated users
function UnauthenticatedContent() {
  return (
    <>
      <div className="mb-12 text-center">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">NHF IT Management</h2>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          National Health Foundation (NHF) is a non-profit organization that provides free medical services to people in need.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto bg-blue-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">IT Support Ticket</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-base">
              ระบบรายงานปัญหาเกี่ยวกับสารสนเทศ
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto bg-green-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
              <Database className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">Employees Manage</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-base">
              บันทึกและจัดการข้อมูลพนักงานอย่างเป็นระบบ ค้นหา แก้ไข และลบข้อมูลได้ง่าย
            </CardDescription>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto bg-purple-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
            <CardTitle className="text-xl">IT Equipments</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-base">
              Coming Soon | In Progress
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <div className="text-center bg-white rounded-lg shadow-lg p-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">พร้อมเริ่มต้นใช้งานระบบแล้วหรือยัง?</h3>
        <p className="text-lg text-gray-600 mb-6">
          เข้าสู่ระบบหรือสมัครสมาชิกเพื่อเริ่มใช้งานระบบจัดการพนักงาน
        </p>
        <div className="flex justify-center space-x-4">
          <Link href="/login">
            <Button size="lg" className="px-8">เข้าสู่ระบบ</Button>
          </Link>
          
        </div>
      </div>
    </>
  );
}
