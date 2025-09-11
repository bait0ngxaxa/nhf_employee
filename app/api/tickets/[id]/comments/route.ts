import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// POST - Add comment to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);
    
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    const { content } = await request.json();

    if (!content || content.trim() === '') {
      return NextResponse.json({ error: 'Comment content is required' }, { status: 400 });
    }

    // Check if ticket exists
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check permissions - user can comment on their own tickets or admin can comment on any
    const isOwner = ticket.reportedById === parseInt(session.user.id);
    const isAdmin = session.user?.role === 'ADMIN';
    const isAssigned = ticket.assignedToId === parseInt(session.user.id);

    if (!isOwner && !isAdmin && !isAssigned) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Create comment
    const comment = await prisma.ticketComment.create({
      data: {
        content: content.trim(),
        ticketId,
        authorId: parseInt(session.user.id)
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            employee: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json({ comment }, { status: 201 });

  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 });
  }
}