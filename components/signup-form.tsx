'use client';

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SuccessModal } from "@/components/SuccessModal"
import { useState } from "react"
import { useRouter } from "next/navigation"

// Type definitions for API response
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface SignupSuccessResponse {
  message: string;
  user: User;
}

interface SignupErrorResponse {
  error: string;
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<SignupSuccessResponse | null>(null);
  const router = useRouter();



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน");
      return;
    }

    if (formData.password.length < 6) {
      setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      if (response.ok) {
        const data: SignupSuccessResponse = await response.json();
        setSuccessData(data);
        setShowSuccessModal(true);
        // Reset form
        setFormData({
          name: "",
          email: "",
          password: "",
          confirmPassword: ""
        });
      } else {
        const data: SignupErrorResponse = await response.json();
        setError(data.error || "เกิดข้อผิดพลาดในการสมัครสมาชิก");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setShowSuccessModal(false);
    router.push("/login");
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle>สร้างบัญชีใหม่</CardTitle>
          <CardDescription>
            กรุณากรอกข้อมูลพื้นฐานเพื่อสร้างบัญชีผู้ใช้ของคุณ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                  {error}
                </div>
              )}
              
              <div className="grid gap-3">
                <Label htmlFor="name">ชื่อ-นามสกุล</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="กรอกชื่อ-นามสกุล"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="email">อีเมล</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>



              <div className="grid gap-3">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="กรอกรหัสผ่าน"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>

              <div className="grid gap-3">
                <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
              </Button>
            </div>
            
            <div className="mt-4 text-center text-sm">
              มีบัญชีอยู่แล้ว?{" "}
              <a href="/login" className="underline underline-offset-4">
                เข้าสู่ระบบ
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={handleModalClose}
        title="สมัครสมาชิกสำเร็จ!"
        description={`ยินดีต้อนรับ! บัญชีผู้ใช้ของคุณถูกสร้างเรียบร้อยแล้ว${successData?.user?.name ? ` สำหรับ ${successData.user.name}` : ''} คุณสามารถเข้าสู่ระบบได้ทันที`}
        buttonText="ไปหน้าเข้าสู่ระบบ"
        onButtonClick={handleModalClose}
      />
    </div>
  )
}