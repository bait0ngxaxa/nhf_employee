import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// PATCH - อัปเดตข้อมูลพนักงาน (สถานะ)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const { id } = await params;
    const employeeId = parseInt(id);
    const { status } = await request.json();

    // Validation
    if (!status || !['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(status)) {
      return NextResponse.json(
        { error: 'สถานะไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลพนักงาน' },
        { status: 404 }
      );
    }

    // Update employee status
    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: { status },
      include: {
        dept: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json(
      {
        message: 'อัปเดตสถานะสำเร็จ',
        employee: updatedEmployee
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการอัปเดต' },
      { status: 500 }
    );
  }
}

// DELETE - ลบพนักงาน (ถ้าต้องการ)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const resolvedParams = await params;
    const employeeId = parseInt(resolvedParams.id);

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: employeeId }
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลพนักงาน' },
        { status: 404 }
      );
    }

    // Delete employee
    await prisma.employee.delete({
      where: { id: employeeId }
    });

    return NextResponse.json(
      { message: 'ลบพนักงานสำเร็จ' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาดในการลบ' },
      { status: 500 }
    );
  }
}