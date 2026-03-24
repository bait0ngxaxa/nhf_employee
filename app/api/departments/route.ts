import { NextResponse } from 'next/server';
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getApiAuthSession();
    
    if (!session) {
      return NextResponse.json({ error: "Operation failed" }, { status: 403 });
    }

    const departments = await prisma.department.findMany({
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({ departments }, { status: 200 });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: "Operation failed" }, { status: 500 });
  }
}
