import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';


interface CSVImportEmployee {
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
  data: Partial<CSVImportEmployee>;
  error: string;
}

interface ImportResult {
  success: CSVImportEmployee[];
  errors: ImportError[];
}

// POST - Import employees from CSV
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const { employees } = await request.json();

    if (!employees || !Array.isArray(employees)) {
      return NextResponse.json(
        { error: 'ข้อมูลไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const result: ImportResult = {
      success: [],
      errors: []
    };

    // Get all departments for mapping
    const departments = await prisma.department.findMany();
    const departmentMap = new Map(departments.map(dept => [dept.code, dept.id]));

    // Get existing emails to check for duplicates
    const existingEmployees = await prisma.employee.findMany({
      select: { email: true }
    });
    const existingEmails = new Set(existingEmployees.map(emp => emp.email));

    // Process each employee
    for (let i = 0; i < employees.length; i++) {
      const rowNumber = i + 1;
      const employeeData = employees[i];

      try {
        // Validate required fields
        const requiredFields = ['firstName', 'lastName', 'position', 'department'];
        for (const field of requiredFields) {
          if (!employeeData[field] || employeeData[field].trim() === '') {
            throw new Error(`ข้อมูล ${field} เป็นข้อมูลที่จำเป็น`);
          }
        }

        // Validate email format only if email is provided and not empty or dash
        if (employeeData.email && employeeData.email.trim() !== '' && employeeData.email.trim() !== '-') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(employeeData.email)) {
            throw new Error('รูปแบบอีเมลไม่ถูกต้อง');
          }
        }

        // Check for duplicate email only if email is provided and not empty or dash
        if (employeeData.email && employeeData.email.trim() !== '' && employeeData.email.trim() !== '-') {
          if (existingEmails.has(employeeData.email.toLowerCase())) {
            throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
          }
        }

        // Validate department code
        let departmentId: number;
        const deptCode = employeeData.department.toUpperCase();
        
        if (deptCode === 'ADMIN' || deptCode === 'บริหาร') {
          departmentId = departmentMap.get('ADMIN')!;
        } else if (deptCode === 'ACADEMIC' || deptCode === 'วิชาการ') {
          departmentId = departmentMap.get('ACADEMIC')!;
        } else {
          throw new Error('รหัสแผนกไม่ถูกต้อง ใช้ได้เฉพาะ ADMIN หรือ ACADEMIC');
        }

        // Create employee
        const newEmployee = await prisma.employee.create({
          data: {
            firstName: employeeData.firstName.trim(),
            lastName: employeeData.lastName.trim(),
            nickname: employeeData.nickname?.trim() || null,
            email: (employeeData.email && employeeData.email.trim() !== '' && employeeData.email.trim() !== '-') 
              ? employeeData.email.trim() 
              : `no-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.local`,
            phone: employeeData.phone?.trim() || null,
            position: employeeData.position.trim(),
            affiliation: employeeData.affiliation?.trim() || null,
            departmentId,
          },
          include: {
            dept: true
          }
        });

        // Add to existing emails set only if email was provided and not dash
        if (employeeData.email && employeeData.email.trim() !== '' && employeeData.email.trim() !== '-') {
          existingEmails.add(employeeData.email.toLowerCase());
        }

        result.success.push({
          firstName: newEmployee.firstName,
          lastName: newEmployee.lastName,
          email: newEmployee.email,
          phone: newEmployee.phone || undefined,
          position: newEmployee.position,
          department: newEmployee.dept.name,
          affiliation: newEmployee.affiliation || undefined,
          nickname: newEmployee.nickname || undefined,
        });

      } catch (error) {
        result.errors.push({
          row: rowNumber,
          data: employeeData,
          error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'
        });
      }
    }

    return NextResponse.json({
      message: `นำเข้าข้อมูลสำเร็จ ${result.success.length} คน${result.errors.length > 0 ? `, มีข้อผิดพลาด ${result.errors.length} รายการ` : ''}`,
      result
    }, { status: 200 });

  } catch (error) {
    console.error('Error importing employees:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล' },
      { status: 500 }
    );
  }
}