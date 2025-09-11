import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Interface for employee update data
interface EmployeeUpdateData {
  firstName?: string;
  lastName?: string;
  nickname?: string | null;
  phone?: string | null;
  position?: string;
  affiliation?: string | null;
  departmentId?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  email?: string;
}

// PATCH - อัปเดตข้อมูลพนักงาน
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
    const updateData = await request.json();

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

    // Prepare update data
    const dataToUpdate: EmployeeUpdateData = {};

    if (updateData.firstName) dataToUpdate.firstName = updateData.firstName.trim();
    if (updateData.lastName) dataToUpdate.lastName = updateData.lastName.trim();
    if (updateData.nickname !== undefined) dataToUpdate.nickname = updateData.nickname?.trim() || null;
    if (updateData.phone !== undefined) dataToUpdate.phone = updateData.phone?.trim() || null;
    if (updateData.position) dataToUpdate.position = updateData.position.trim();
    if (updateData.affiliation !== undefined) dataToUpdate.affiliation = updateData.affiliation?.trim() || null;
    if (updateData.departmentId) dataToUpdate.departmentId = parseInt(updateData.departmentId);
    if (updateData.status && ['ACTIVE', 'INACTIVE', 'SUSPENDED'].includes(updateData.status)) {
      dataToUpdate.status = updateData.status;
    }

    // Handle email update
    if (updateData.email !== undefined) {
      if (updateData.email && updateData.email.trim() !== '' && updateData.email.trim() !== '-') {
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updateData.email)) {
          return NextResponse.json(
            { error: 'รูปแบบอีเมลไม่ถูกต้อง' },
            { status: 400 }
          );
        }

        // Check for duplicate email (excluding current employee)
        const existingEmailEmployee = await prisma.employee.findUnique({
          where: { email: updateData.email.trim().toLowerCase() }
        });

        if (existingEmailEmployee && existingEmailEmployee.id !== employeeId) {
          return NextResponse.json(
            { error: 'อีเมลนี้ถูกใช้งานแล้ว' },
            { status: 400 }
          );
        }

        dataToUpdate.email = updateData.email.trim().toLowerCase();
      } else {
        // If email is empty or dash, generate temp email
        dataToUpdate.email = `no-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}@temp.local`;
      }
    }

    // Update employee
    const updatedEmployee = await prisma.employee.update({
      where: { id: employeeId },
      data: dataToUpdate,
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
        message: 'อัปเดตข้อมูลพนักงานสำเร็จ',
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