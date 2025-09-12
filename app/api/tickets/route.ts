import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { emailService, TicketEmailData } from '@/lib/email';
import { lineNotificationService } from '@/lib/line';

// GET - Retrieve tickets (filtered by role)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const priority = searchParams.get('priority');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const where: Record<string, unknown> = {};

    // Role-based filtering
    if (session.user?.role !== 'ADMIN') {
      // Regular users can only see their own tickets
      where.reportedById = parseInt(session.user.id);
    }

    // Add filters
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;

    const skip = (page - 1) * limit;

    const [tickets, totalCount] = await Promise.all([
      prisma.ticket.findMany({
        where,
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
          _count: {
            select: {
              comments: true
            }
          },
          views: {
            where: {
              userId: parseInt(session.user.id)
            },
            select: {
              viewedAt: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.ticket.count({ where })
    ]);

    return NextResponse.json({
      tickets,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Error fetching tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

// POST - Create new ticket
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, description, category, priority } = await request.json();

    // Validation
    if (!title || !description || !category) {
      return NextResponse.json(
        { error: 'Title, description, and category are required' },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        category,
        priority: priority || 'MEDIUM',
        reportedById: parseInt(session.user.id)
      },
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
        }
      }
    });

    // Send email and LINE notifications
    try {
      console.log('🎟️ Sending notifications for ticket #' + ticket.id);
      const emailData: TicketEmailData = {
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        priority: ticket.priority,
        status: ticket.status,
        reportedBy: {
          name: ticket.reportedBy.employee?.firstName && ticket.reportedBy.employee?.lastName 
            ? `${ticket.reportedBy.employee.firstName} ${ticket.reportedBy.employee.lastName}`
            : ticket.reportedBy.name,
          email: ticket.reportedBy.email,
          department: ticket.reportedBy.employee?.dept?.name
        },
        createdAt: ticket.createdAt.toISOString()
      };

      console.log('📧 Attempting to send confirmation email to:', emailData.reportedBy.email);
      // Send confirmation email to the user
      const emailSent = await emailService.sendNewTicketNotification(emailData);
      console.log('📧 Email result:', emailSent ? 'SUCCESS' : 'FAILED');

      console.log('📱 Attempting to send LINE notification...');
      // Send LINE notification to the user
      const lineSent = await lineNotificationService.sendNewTicketNotification(emailData);
      console.log('📱 LINE result:', lineSent ? 'SUCCESS' : 'FAILED');

      // Send notification to IT team for high/urgent priority tickets
      if (ticket.priority === 'HIGH' || ticket.priority === 'URGENT') {
        console.log('⚡ Sending IT team notifications for ' + ticket.priority + ' priority ticket');
        const itEmailSent = await emailService.sendITTeamNotification(emailData);
        console.log('📧 IT team email result:', itEmailSent ? 'SUCCESS' : 'FAILED');
        
        const itLineSent = await lineNotificationService.sendITTeamNotification(emailData);
        console.log('📱 IT team LINE result:', itLineSent ? 'SUCCESS' : 'FAILED');
      }
    } catch (notificationError) {
      console.error('❌ Failed to send notifications:', notificationError);
      // Don't fail the ticket creation if notifications fail
    }

    return NextResponse.json({ ticket }, { status: 201 });

  } catch (error) {
    console.error('Error creating ticket:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}