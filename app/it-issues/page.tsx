"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Ticket, List, Settings, BarChart3, Sparkles } from 'lucide-react';
import CreateTicketForm from '@/components/CreateTicketForm';
import TicketList from '@/components/TicketList';
import TicketDetail from '@/components/TicketDetail';

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  userTickets: number;
  newTickets: number; // New tickets in last 24 hours
}
interface Ticket {
  id: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  reportedBy: {
    id: number;
    name: string;
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
      dept?: {
        name: string;
      };
    };
  };
  assignedTo?: {
    id: number;
    name: string;
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
    };
  };
  _count: {
    comments: number;
  };
  views: {
    viewedAt: string;
  }[];
}

export default function ITIssuesPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState('tickets');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [ticketStats, setTicketStats] = useState<TicketStats>({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    userTickets: 0,
    newTickets: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const isAdmin = session?.user?.role === 'ADMIN';

  // Fetch ticket statistics
  const fetchTicketStats = useCallback(async () => {
    if (!session) return;
    
    try {
      setStatsLoading(true);
      const response = await fetch('/api/tickets?limit=1000'); // Get all tickets for stats
      
      if (response.ok) {
        const data = await response.json();
        const tickets = data.tickets || [];
        
        // Check if ticket is new (created within last 24 hours) AND not viewed by current user
        const isNewTicket = (createdAt: string, views: { viewedAt: string }[]) => {
          const now = new Date();
          const ticketDate = new Date(createdAt);
          const hoursDiff = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60);
          const isRecent = hoursDiff <= 24;
          const hasBeenViewed = views.length > 0;
          return isRecent && !hasBeenViewed;
        };
        
        // Calculate statistics
        const stats = {
          total: tickets.length,
          open: tickets.filter((t: Ticket) => t.status === 'OPEN').length,
          inProgress: tickets.filter((t: Ticket) => t.status === 'IN_PROGRESS').length,
          resolved: tickets.filter((t: Ticket) => t.status === 'RESOLVED').length,
          newTickets: tickets.filter((t: Ticket) => isNewTicket(t.createdAt, t.views)).length,
          userTickets: isAdmin 
            ? tickets.filter((t: Ticket) => t.assignedTo?.id === parseInt(session.user.id)).length
            : tickets.filter((t: Ticket) => t.reportedBy.id === parseInt(session.user.id)).length
        };
        
        setTicketStats(stats);
      }
    } catch (error) {
      console.error('Error fetching ticket stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [session, isAdmin]);

  // Fetch stats when component mounts and when tickets are updated
  useEffect(() => {
    fetchTicketStats();
  }, [fetchTicketStats, refreshTrigger]);

  const handleTicketCreated = () => {
    setRefreshTrigger(prev => prev + 1);
    // Switch to tickets tab to see the newly created ticket
    setActiveTab('tickets');
  };

  const handleTicketSelect = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setActiveTab('detail');
  };

  const handleTicketUpdated = () => {
    setRefreshTrigger(prev => prev + 1);
    setSelectedTicket(null);
    setActiveTab('tickets');
  };

  const handleBackToList = () => {
    setSelectedTicket(null);
    setActiveTab('tickets');
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">กรุณาเข้าสู่ระบบเพื่อใช้งานระบบ IT Support</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">IT Support System</h1>
          <p className="text-gray-600">
            ระบบแจ้งปัญหาและติดตามการแก้ไขปัญหาไอที
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {session.user?.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
          </Badge>
          <Badge variant="outline" className="text-sm">
            {session.user?.department}
          </Badge>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets ทั้งหมด</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '-' : ticketStats.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? 'กำลังโหลดข้อมูล' : 'tickets ในระบบ'}
            </p>
          </CardContent>
        </Card>
        
        <Card className={ticketStats.newTickets > 0 ? 'ring-2 ring-blue-200 bg-blue-50/30' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-blue-500" />
              Tickets ใหม่
            </CardTitle>
            <div className="text-blue-500">
              {ticketStats.newTickets > 0 && <Sparkles className="h-4 w-4 animate-pulse" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {statsLoading ? '-' : ticketStats.newTickets}
            </div>
            <p className="text-xs text-blue-600">
              {statsLoading ? 'กำลังโหลดข้อมูล' : '24 ชั่วโมงที่ผ่านมา'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">กำลังดำเนินการ</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '-' : (ticketStats.open + ticketStats.inProgress)}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? 'รอการแก้ไข' : `เปิด: ${ticketStats.open}, ดำเนินการ: ${ticketStats.inProgress}`}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">แก้ไขแล้ว</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '-' : ticketStats.resolved}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading ? 'เสร็จสิ้นแล้ว' : 'tickets ที่แก้ไขแล้ว'}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">ของฉัน</CardTitle>
            <List className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? '-' : ticketStats.userTickets}
            </div>
            <p className="text-xs text-muted-foreground">
              {statsLoading 
                ? (isAdmin ? 'มอบหมายให้ฉัน' : 'ที่ฉันแจ้ง')
                : (isAdmin ? 'มอบหมายให้ฉัน' : 'ที่ฉันแจ้ง')
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tickets" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            รายการ Tickets
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            แจ้งปัญหาใหม่
          </TabsTrigger>
          {selectedTicket && (
            <TabsTrigger value="detail" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              รายละเอียด
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>รายการ IT Support Tickets</CardTitle>
                  <CardDescription>
                    {isAdmin 
                      ? 'จัดการและติดตาม tickets ทั้งหมดในระบบ' 
                      : 'ดู tickets ที่คุณได้แจ้งปัญหาไว้'
                    }
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setActiveTab('create')}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  แจ้งปัญหาใหม่
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <TicketList 
                onTicketSelect={handleTicketSelect}
                refreshTrigger={refreshTrigger}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <CreateTicketForm onTicketCreated={handleTicketCreated} />
        </TabsContent>

        {selectedTicket && (
          <TabsContent value="detail" className="space-y-4">
            <TicketDetail 
              ticketId={selectedTicket.id}
              onBack={handleBackToList}
              onTicketUpdated={handleTicketUpdated}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}