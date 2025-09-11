"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface CreateTicketFormProps {
  onTicketCreated?: () => void;
}

export default function CreateTicketForm({ onTicketCreated }: CreateTicketFormProps) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'MEDIUM'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const categories = [
    { value: 'HARDWARE', label: 'ฮาร์ดแวร์' },
    { value: 'SOFTWARE', label: 'ซอฟต์แวร์' },
    { value: 'NETWORK', label: 'เครือข่าย' },
    { value: 'ACCOUNT', label: 'บัญชีผู้ใช้' },
    { value: 'EMAIL', label: 'อีเมล' },
    { value: 'PRINTER', label: 'เครื่องพิมพ์' },
    { value: 'OTHER', label: 'อื่นๆ' }
  ];

  const priorities = [
    { value: 'LOW', label: 'ต่ำ' },
    { value: 'MEDIUM', label: 'ปานกลาง' },
    { value: 'HIGH', label: 'สูง' },
    { value: 'URGENT', label: 'เร่งด่วน' }
  ];

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim() || !formData.category) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      setSuccess(true);
      setFormData({
        title: '',
        description: '',
        category: '',
        priority: 'MEDIUM'
      });

      // Call callback if provided
      if (onTicketCreated) {
        onTicketCreated();
      }

      // Auto hide success message
      setTimeout(() => setSuccess(false), 3000);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการส่งคำร้อง';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">กรุณาเข้าสู่ระบบเพื่อแจ้งปัญหา</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>แจ้งปัญหาไอที</CardTitle>
        <CardDescription>
          กรอกรายละเอียดปัญหาที่พบเพื่อให้ทีม IT สามารถช่วยเหลือคุณได้
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              ส่งคำร้องแจ้งปัญหาเรียบร้อยแล้ว!
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">หัวข้อปัญหา *</Label>
            <Input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              placeholder="สรุปปัญหาที่พบในหัวข้อสั้นๆ"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">หมวดหมู่ปัญหา *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => handleInputChange('category', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกหมวดหมู่ปัญหา" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">ระดับความสำคัญ</Label>
            <Select 
              value={formData.priority} 
              onValueChange={(value) => handleInputChange('priority', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="เลือกระดับความสำคัญ" />
              </SelectTrigger>
              <SelectContent>
                {priorities.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">รายละเอียดปัญหา *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="อธิบายปัญหาที่พบให้ละเอียด เช่น ขั้นตอนที่ทำ, ข้อความแสดงข้อผิดพลาด, เวลาที่เกิดปัญหา"
              rows={5}
              required
            />
          </div>

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading ? 'กำลังส่ง...' : 'ส่งคำร้องแจ้งปัญหา'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}