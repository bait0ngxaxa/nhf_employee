'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Download, 
  AlertTriangle,
  ArrowLeft,
  ArrowRight 
} from 'lucide-react';

interface CSVEmployee {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position: string;
  department: string;
  affiliation?: string;
  nickname?: string;
}

interface ImportError {
  row: number;
  data: Partial<CSVEmployee>;
  error: string;
}

interface ImportResult {
  success: CSVEmployee[];
  errors: ImportError[];
}

interface ImportEmployeeCSVProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

export function ImportEmployeeCSV({ onSuccess, onBack }: ImportEmployeeCSVProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'result'>('upload');
  const [parsedData, setParsedData] = useState<CSVEmployee[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewError, setPreviewError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV header mapping (support both Thai and English headers)
  const headerMappings: { [key: string]: string } = {
    'ชื่อ': 'firstName',
    'firstname': 'firstName',
    'first name': 'firstName',
    'นามสกุล': 'lastName', 
    'lastname': 'lastName',
    'last name': 'lastName',
    'อีเมล': 'email',
    'email': 'email',
    'e-mail': 'email',
    'เบอร์โทรศัพท์': 'phone',
    'เบอร์โทร': 'phone',
    'phone': 'phone',
    'telephone': 'phone',
    'ตำแหน่ง': 'position',
    'position': 'position',
    'แผนก': 'department',
    'department': 'department',
    'dept': 'department',
    'สังกัด': 'affiliation',
    'affiliation': 'affiliation',
    'ชื่อเล่น': 'nickname',
    'nickname': 'nickname',
    'nick': 'nickname'
  };

  // Parse CSV file
  const parseCSV = (csvText: string): CSVEmployee[] => {
    console.log('📄 CSV Text (first 200 chars):', csvText.substring(0, 200));
    
    // Remove BOM if present
    const cleanText = csvText.replace(/^\uFEFF/, '');
    const lines = cleanText.split('\n').map(line => line.trim()).filter(line => line);
    
    console.log('📊 Total lines found:', lines.length);
    console.log('📝 First line (headers):', lines[0]);
    
    if (lines.length < 2) {
      throw new Error('ไฟล์ CSV ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว');
    }

    // Enhanced CSV parsing - handle quoted fields properly
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result.map(field => field.replace(/^"|"$/g, '')); // Remove surrounding quotes
    };

    // Parse headers
    const headers = parseCSVLine(lines[0]).map(header => header.toLowerCase().trim());
    console.log('🏷️ Headers found:', headers);

    // Map headers to our expected fields
    const fieldMapping: { [key: number]: string } = {};
    headers.forEach((header, index) => {
      const mappedField = headerMappings[header];
      if (mappedField) {
        fieldMapping[index] = mappedField;
        console.log(`✅ Mapped "${header}" → ${mappedField}`);
      } else {
        console.log(`❌ No mapping for "${header}"`);
      }
    });
    
    console.log('🗺️ Field mapping:', fieldMapping);

    // Check if required fields are present
    const requiredFields = ['firstName', 'lastName', 'position', 'department'];
    const mappedFields = Object.values(fieldMapping);
    const missingFields = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      throw new Error(`ไม่พบคอลัมน์ที่จำเป็น: ${missingFields.join(', ')}\n\nพบคอลัมน์: ${headers.join(', ')}\n\nคอลัมน์ที่รองรับ: ${Object.keys(headerMappings).join(', ')}`);
    }

    // Parse data rows
    const employees: CSVEmployee[] = [];
    for (let i = 1; i < lines.length; i++) {
      console.log(`🔍 Processing row ${i}: ${lines[i]}`);
      
      const values = parseCSVLine(lines[i]);
      console.log(`📋 Row ${i} values:`, values);
      
      const employee: Partial<CSVEmployee> = {};
      values.forEach((value, index) => {
        const field = fieldMapping[index];
        if (field && value && value.trim() !== '') {
          (employee as Record<string, string | undefined>)[field] = value.trim();
        }
      });

      console.log(`👤 Row ${i} parsed employee:`, employee);

      // Validate required fields
      const missing = [];
      if (!employee.firstName) missing.push('firstName');
      if (!employee.lastName) missing.push('lastName');
      if (!employee.position) missing.push('position');
      if (!employee.department) missing.push('department');

      if (missing.length === 0) {
        employees.push(employee as CSVEmployee);
        console.log(`✅ Row ${i} added successfully`);
      } else {
        console.log(`⚠️ Row ${i} skipped - missing fields:`, missing);
        console.log(`   Data:`, employee);
      }
    }

    console.log(`🎉 Total employees parsed: ${employees.length}`);
    return employees;
  };

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setPreviewError('กรุณาเลือกไฟล์ CSV เท่านั้น');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      setPreviewError('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)');
      return;
    }

    setPreviewError('');
    setError('');

    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      setParsedData(parsed);
      setStep('preview');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการอ่านไฟล์');
    }
  };

  // Handle import
  const handleImport = async () => {
    if (!parsedData.length) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/employees/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employees: parsedData }),
      });

      const data = await response.json();

      if (response.ok) {
        setImportResult(data.result);
        setStep('result');
        if (onSuccess) {
          onSuccess();
        }
      } else {
        setError(data.error || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to upload step
  const resetUpload = () => {
    setStep('upload');
    setParsedData([]);
    setImportResult(null);
    setError('');
    setPreviewError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Download sample CSV
  const downloadSample = () => {
    const sampleData = `ชื่อ,นามสกุล,อีเมล,เบอร์โทรศัพท์,ตำแหน่ง,แผนก,สังกัด,ชื่อเล่น
สมชาย,ใจดี,somchai@company.com,081-234-5678,ผู้จัดการ,ADMIN,สำนักงานใหญ่,ชาย
สมหญิง,รักงาน,,082-345-6789,อาจารย์,ACADEMIC,คณะวิทยาศาสตร์,หญิง
เจษฎา,รักเรียน,,081-111-2222,ครู,ADMIN,โรงเรียนประถม,เจ`;

    // Add UTF-8 BOM for proper Thai character display
    const BOM = '\uFEFF';
    const csvContent = BOM + sampleData;
    
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'ตัวอย่างข้อมูลพนักงาน.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">นำเข้าข้อมูลพนักงานจาก CSV</h2>
          <p className="text-gray-600">อัพโหลดไฟล์ CSV เพื่อเพิ่มข้อมูลพนักงานหลายคนพร้วมกัน</p>
        </div>
        {onBack && (
          <Button variant="outline" onClick={onBack} className="flex items-center space-x-2">
            <ArrowLeft className="h-4 w-4" />
            <span>กลับ</span>
          </Button>
        )}
      </div>

      {/* Progress Steps */}
      <div className="flex items-center space-x-4">
        <div className={`flex items-center space-x-2 ${step === 'upload' ? 'text-blue-600' : step === 'preview' || step === 'result' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'upload' ? 'bg-blue-100 text-blue-600' : step === 'preview' || step === 'result' ? 'bg-green-100 text-green-600' : 'bg-gray-100'}`}>
            1
          </div>
          <span className="font-medium">อัพโหลด</span>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-400" />
        <div className={`flex items-center space-x-2 ${step === 'preview' ? 'text-blue-600' : step === 'result' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'preview' ? 'bg-blue-100 text-blue-600' : step === 'result' ? 'bg-green-100 text-green-600' : 'bg-gray-100'}`}>
            2
          </div>
          <span className="font-medium">ตรวจสอบ</span>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-400" />
        <div className={`flex items-center space-x-2 ${step === 'result' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'result' ? 'bg-green-100 text-green-600' : 'bg-gray-100'}`}>
            3
          </div>
          <span className="font-medium">ผลลัพธ์</span>
        </div>
      </div>

      {/* Step Content */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>อัพโหลดไฟล์ CSV</span>
            </CardTitle>
            <CardDescription>
              เลือกไฟล์ CSV ที่มีข้อมูลพนักงาน (ขนาดไฟล์สูงสุด 5MB)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File Upload */}
            <div className="space-y-4">
              <Label htmlFor="csv-file">เลือกไฟล์ CSV</Label>
              <Input
                ref={fileInputRef}
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {previewError && (
                <Alert className="border-red-200 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <div className="text-red-700">{previewError}</div>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Sample Download */}
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">รูปแบบไฟล์ CSV ที่ต้องการ:</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p><strong>คอลัมน์ที่จำเป็น:</strong> ชื่อ, นามสกุล, ตำแหน่ง, แผนก</p>
                  <p><strong>คอลัมน์เสริม:</strong> อีเมล, เบอร์โทรศัพท์, สังกัด, ชื่อเล่น</p>
                  <p><strong>รหัสแผนก:</strong> ADMIN (บริหาร), ACADEMIC (วิชาการ)</p>
                  <p><strong>หมายเหตุ:</strong> อีเมลสามารถเว้นว่างได้ (บางคนไม่มีอีเมล)</p>
                </div>
              </div>
              <Button variant="outline" onClick={downloadSample} className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>ดาวน์โหลดไฟล์ตัวอย่าง</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'preview' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>ตรวจสอบข้อมูลก่อนนำเข้า</span>
            </CardTitle>
            <CardDescription>
              พบข้อมูลพนักงาน {parsedData.length} คน กรุณาตรวจสอบความถูกต้องก่อนทำการนำเข้า
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preview Table */}
            <div className="overflow-x-auto max-h-96 border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ลำดับ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ-นามสกุล</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">อีเมล</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ตำแหน่ง</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">แผนก</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อเล่น</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {parsedData.map((employee, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-4 text-sm font-medium text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{employee.email || '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{employee.position}</td>
                      <td className="px-4 py-4 text-sm">
                        <Badge variant="outline">
                          {employee.department === 'ADMIN' || employee.department === 'บริหาร' ? 'บริหาร' : 'วิชาการ'}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">{employee.phone || '-'}</td>
                      <td className="px-4 py-4 text-sm text-gray-600">{employee.nickname || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {error && (
              <Alert className="border-red-200 bg-red-50">
                <XCircle className="h-4 w-4 text-red-600" />
                <div className="text-red-700">{error}</div>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={resetUpload}>
                เลือกไฟล์ใหม่
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={isLoading || parsedData.length === 0}
                className="flex items-center space-x-2"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>กำลังนำเข้า...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>นำเข้าข้อมูล ({parsedData.length} คน)</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'result' && importResult && (
        <div className="space-y-6">
          {/* Success Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>ผลลัพธ์การนำเข้าข้อมูล</span>
              </CardTitle>
              <CardDescription>
                นำเข้าสำเร็จ {importResult.success.length} คน
                {importResult.errors.length > 0 && `, มีข้อผิดพลาด ${importResult.errors.length} รายการ`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{importResult.success.length}</div>
                  <div className="text-sm text-green-700">นำเข้าสำเร็จ</div>
                </div>
                {importResult.errors.length > 0 && (
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                    <div className="text-sm text-red-700">มีข้อผิดพลาด</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Error Details */}
          {importResult.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <span>รายการที่มีข้อผิดพลาด</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {importResult.errors.map((error, index) => (
                    <div key={index} className="p-4 border border-red-200 rounded-lg bg-red-50">
                      <div className="flex items-start space-x-3">
                        <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium text-red-800">แถวที่ {error.row}:</div>
                          <div className="text-sm text-red-700 mt-1">{error.error}</div>
                          <div className="text-xs text-red-600 mt-2">
                            ข้อมูล: {JSON.stringify(error.data)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={resetUpload}>
              นำเข้าไฟล์ใหม่
            </Button>
            {onBack && (
              <Button onClick={onBack} className="flex items-center space-x-2">
                <span>กลับไปหน้าจัดการพนักงาน</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}