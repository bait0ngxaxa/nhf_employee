'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, ArrowLeft, Home } from 'lucide-react';

export default function AccessDenied() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-900">
            ไม่มีสิทธิ์เข้าถึง
          </CardTitle>
          <CardDescription className="text-red-700">
            คุณไม่มีสิทธิ์ในการเข้าถึงส่วนนี้ของระบบ
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-gray-600">
            <p>
              ส่วนนี้เป็นของผู้ดูแลระบบเท่านั้น หากคุณคิดว่านี่เป็นข้อผิดพลาด 
              กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </div>
          
          <div className="flex flex-col gap-3">
            <Button 
              onClick={() => router.back()}
              variant="outline"
              className="w-full flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              กลับหน้าก่อนหน้า
            </Button>
            
            <Button 
              onClick={() => router.push('/dashboard')}
              className="w-full flex items-center gap-2"
            >
              <Home className="h-4 w-4" />
              กลับสู่แดชบอร์ด
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}