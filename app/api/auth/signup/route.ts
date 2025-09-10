import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { firstName, lastName, email, department, password, phone, position, nickname, affiliation } = await request.json();

    // Validation
    if (!firstName || !lastName || !email || !department || !password) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'อีเมลนี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Find department by name or code
    const dept = await prisma.department.findFirst({
      where: {
        OR: [
          { name: department },
          { code: department }
        ]
      }
    });

    if (!dept) {
      return NextResponse.json(
        { error: 'ไม่พบแผนกที่ระบุ' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user and employee in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create employee first
      const employee = await tx.employee.create({
        data: {
          firstName,
          lastName,
          nickname: nickname || null,
          email,
          phone: phone || null,
          position: position || 'พนักงาน',
          affiliation: affiliation || null,
          departmentId: dept.id,
        },
      });

      // Create user and link to employee
      const user = await tx.user.create({
        data: {
          name: `${firstName} ${lastName}`, // Combine firstName and lastName
          email,
          password: hashedPassword,
          department: dept.name, // Keep this for backward compatibility
          role: 'USER',
          employeeId: employee.id,
        },
      });

      return { user, employee };
    });

    // Return success response (don't include password)
    return NextResponse.json(
      {
        message: 'สมัครสมาชิกสำเร็จ',
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          department: result.user.department,
          role: result.user.role,
        },
        employee: {
          id: result.employee.id,
          firstName: result.employee.firstName,
          lastName: result.employee.lastName,
          position: result.employee.position,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' },
      { status: 500 }
    );
  }
}