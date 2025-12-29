import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { emailService } from '@/lib/email';
import { lineNotificationService } from '@/lib/line';
import { TicketEmailData } from '@/types/api';

// GET - Get single ticket with comments
export async function GET(
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

    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                dept: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            employee: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        comments: {
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
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Check permissions
    if (session.user?.role !== 'ADMIN' && ticket.reportedById !== parseInt(session.user.id)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Record that this user has viewed this ticket
    await prisma.ticketView.upsert({
      where: {
        ticketId_userId: {
          ticketId: ticketId,
          userId: parseInt(session.user.id)
        }
      },
      update: {
        viewedAt: new Date()
      },
      create: {
        ticketId: ticketId,
        userId: parseInt(session.user.id)
      }
    });

    return NextResponse.json({ ticket }, { status: 200 });

  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

// PATCH - Update ticket (status, assignment, etc.)
export async function PATCH(
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

    const updateData = await request.json();
    const { status, assignedToId, priority, title, description, category } = updateData;

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Permission checks
    const isOwner = existingTicket.reportedById === parseInt(session.user.id);
    const isAdmin = session.user?.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Prepare update data
    const updateFields: Record<string, unknown> = {};

    // Only admins can change status and assignments
    if (isAdmin) {
      if (status) updateFields.status = status;
      if (assignedToId !== undefined) updateFields.assignedToId = assignedToId;
      if (priority) updateFields.priority = priority;
      
      // Set resolvedAt when status changes to RESOLVED
      if (status === 'RESOLVED') {
        updateFields.resolvedAt = new Date();
      } else if (status !== 'RESOLVED' && existingTicket.resolvedAt) {
        updateFields.resolvedAt = null;
      }
    }

    // Owners can edit title, description, category if ticket is still OPEN
    if (isOwner && existingTicket.status === 'OPEN') {
      if (title) updateFields.title = title;
      if (description) updateFields.description = description;
      if (category) updateFields.category = category;
    }

    // Update ticket
    const updatedTicket = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateFields,
      include: {
        reportedBy: {
          select: {
            id: true,
            name: true,
            email: true,
            employee: {
              select: {
                firstName: true,
                lastName: true,
                dept: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
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

    // Send email and LINE notification if status was changed
    if (status && status !== existingTicket.status) {
      try {
        const emailData: TicketEmailData = {
          ticketId: updatedTicket.id,
          title: updatedTicket.title,
          description: updatedTicket.description,
          category: updatedTicket.category,
          priority: updatedTicket.priority,
          status: updatedTicket.status,
          reportedBy: {
            name: updatedTicket.reportedBy.employee?.firstName && updatedTicket.reportedBy.employee?.lastName
              ? `${updatedTicket.reportedBy.employee.firstName} ${updatedTicket.reportedBy.employee.lastName}`
              : updatedTicket.reportedBy.name,
            email: updatedTicket.reportedBy.email,
            department: updatedTicket.reportedBy.employee?.dept?.name
          },
          assignedTo: updatedTicket.assignedTo ? {
            name: updatedTicket.assignedTo.employee?.firstName && updatedTicket.assignedTo.employee?.lastName
              ? `${updatedTicket.assignedTo.employee.firstName} ${updatedTicket.assignedTo.employee.lastName}`
              : updatedTicket.assignedTo.name,
            email: updatedTicket.assignedTo.email
          } : undefined,
          createdAt: updatedTicket.createdAt.toISOString(),
          updatedAt: updatedTicket.updatedAt.toISOString()
        };

        await emailService.sendStatusUpdateNotification(emailData, existingTicket.status);
        await lineNotificationService.sendStatusUpdateNotification(emailData, existingTicket.status);

      } catch (notificationError) {
        console.error('Failed to send status update notifications:', notificationError);
        // Don't fail update if notifications fail
      }
    }

    return NextResponse.json({ ticket: updatedTicket }, { status: 200 });

  } catch (error) {
    console.error('Error updating ticket:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

// DELETE - Delete ticket (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    const resolvedParams = await params;
    const ticketId = parseInt(resolvedParams.id);
    
    if (isNaN(ticketId)) {
      return NextResponse.json({ error: 'Invalid ticket ID' }, { status: 400 });
    }

    // Check if ticket exists
    const existingTicket = await prisma.ticket.findUnique({
      where: { id: ticketId }
    });

    if (!existingTicket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Delete ticket (comments will be deleted due to CASCADE)
    await prisma.ticket.delete({
      where: { id: ticketId }
    });

    return NextResponse.json({ message: 'Ticket deleted successfully' }, { status: 200 });

  } catch (error) {
    console.error('Error deleting ticket:', error);
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
  }
}