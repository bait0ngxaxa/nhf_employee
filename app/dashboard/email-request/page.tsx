'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface EmailRequestForm {
  thaiName: string;
  englishName: string;
  phone: string;
  nickname: string;
  position: string;
  department: string;
  replyEmail: string;
}

export default function EmailRequestPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [formData, setFormData] = useState<EmailRequestForm>({
    thaiName: '',
    englishName: '',
    phone: '',
    nickname: '',
    position: '',
    department: '',
    replyEmail: ''
  });

  // Check if user is authenticated and has admin role
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  // You might want to add role checking here based on your auth system
  // if (session.user.role !== 'admin' && session.user.role !== 'it_admin') {
  //   router.push('/dashboard');
  //   return null;
  // }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/email-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setMessage({ type: 'success', text: result.message });
        // Reset form after successful submission
        setFormData({
          thaiName: '',
          englishName: '',
          phone: '',
          nickname: '',
          position: '',
          department: '',
          replyEmail: ''
        });
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      } else {
        setMessage({ type: 'error', text: result.error || 'เกิดข้อผิดพลาด' });
      }
    } catch (error) {
      console.error('Error submitting email request:', error);
      setMessage({ type: 'error', text: 'เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md">
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <span className="mr-3">📧</span>
              ขออีเมลพนักงานใหม่
            </h1>
            <p className="text-gray-600 mt-2">กรอกข้อมูลพนักงานใหม่เพื่อขออีเมลจากทีมไอที</p>
          </div>

          {/* Alert Messages */}
          {message && (
            <div className={`mx-6 mt-4 p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-800' 
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {message.type === 'success' ? (
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{message.text}</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Thai Name */}
              <div>
                <label htmlFor="thaiName" className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อ-นามสกุล (ไทย) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="thaiName"
                  name="thaiName"
                  value={formData.thaiName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น นาย สมชาย ใจดี"
                />
              </div>

              {/* English Name */}
              <div>
                <label htmlFor="englishName" className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อ-นามสกุล (อังกฤษ) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="englishName"
                  name="englishName"
                  value={formData.englishName}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Mr. Somchai Jaidee"
                />
              </div>

              {/* Nickname */}
              <div>
                <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-2">
                  ชื่อเล่น <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="nickname"
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น ชาย"
                />
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                  เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น 081-234-5678"
                />
              </div>

              {/* Position */}
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
                  ตำแหน่ง <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="position"
                  name="position"
                  value={formData.position}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น เจ้าหน้าที่บัญชี"
                />
              </div>

              {/* Department */}
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-2">
                  สังกัด/แผนก <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={formData.department}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น แผนกบัญชีการเงิน"
                />
              </div>

              {/* Reply Email */}
              <div className="md:col-span-2">
                <label htmlFor="replyEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  อีเมลที่ต้องการให้ส่งตอบกลับ <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="replyEmail"
                  name="replyEmail"
                  value={formData.replyEmail}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="เช่น hr@company.com หรืออีเมลผู้จัดการที่รับผิดชอบ"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="mt-8 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังส่งข้อมูล...
                  </>
                ) : (
                  <>
                    <span className="mr-2">📤</span>
                    ส่งคำขอ
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Information Note */}
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mx-6 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>หมายเหตุ:</strong> เมื่อส่งคำขอแล้ว ทีมไอทีจะได้รับแจ้งเตือนผ่าน LINE และจะดำเนินการสร้างอีเมลให้พนักงานใหม่ต่อไป
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}