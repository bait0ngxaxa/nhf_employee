import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// GET - ดึงข้อมูลพนักงานทั้งหมด
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const employees = await prisma.employee.findMany({
      include: {
        dept: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ employees }, { status: 200 });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' }, { status: 500 });
  }
}

// POST - เพิ่มพนักงานใหม่
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const { 
      firstName, 
      lastName, 
      nickname,
      email, 
      phone, 
      position, 
      affiliation,
      departmentId
    } = await request.json();

    // Validation
    if (!firstName || !lastName || !email || !position || !departmentId) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { email }
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'อีเมลนี้ถูกใช้งานแล้ว' },
        { status: 400 }
      );
    }

    // Create employee directly
    const employee = await prisma.employee.create({
      data: {
        firstName,
        lastName,
        nickname: nickname || null,
        email,
        phone: phone || null,
        position,
        affiliation: affiliation || null,
        departmentId: parseInt(departmentId),
      },
      include: {
        dept: true
      }
    });

    return NextResponse.json(
      {
        message: 'เพิ่มพนักงานสำเร็จ',
        employee
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการเพิ่มพนักงาน' },
      { status: 500 }
    );
  }
}