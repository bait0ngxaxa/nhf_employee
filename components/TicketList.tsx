"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, MessageSquare, User, Calendar, Filter, Search, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

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

interface TicketListProps {
  onTicketSelect?: (ticket: Ticket) => void;
  refreshTrigger?: number;
}

export default function TicketList({ onTicketSelect, refreshTrigger }: TicketListProps) {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  const categories = [
    { value: 'HARDWARE', label: 'ฮาร์ดแวร์' },
    { value: 'SOFTWARE', label: 'ซอฟต์แวร์' },
    { value: 'NETWORK', label: 'เครือข่าย' },
    { value: 'ACCOUNT', label: 'บัญชีผู้ใช้' },
    { value: 'EMAIL', label: 'อีเมล' },
    { value: 'PRINTER', label: 'เครื่องพิมพ์' },
    { value: 'OTHER', label: 'อื่นๆ' }
  ];

  const priorities = [
    { value: 'LOW', label: 'ต่ำ' },
    { value: 'MEDIUM', label: 'ปานกลาง' },
    { value: 'HIGH', label: 'สูง' },
    { value: 'URGENT', label: 'เร่งด่วน' }
  ];

  const statuses = [
    { value: 'OPEN', label: 'เปิด' },
    { value: 'IN_PROGRESS', label: 'กำลังดำเนินการ' },
    { value: 'RESOLVED', label: 'แก้ไขแล้ว' },
    { value: 'CLOSED', label: 'ปิด' },
    { value: 'CANCELLED', label: 'ยกเลิก' }
  ];

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const searchParams = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.status) searchParams.append('status', filters.status);
      if (filters.category) searchParams.append('category', filters.category);
      if (filters.priority) searchParams.append('priority', filters.priority);

      const response = await fetch(`/api/tickets?${searchParams}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      // Filter by search text on client side
      let filteredTickets = data.tickets;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredTickets = data.tickets.filter((ticket: Ticket) =>
          ticket.title.toLowerCase().includes(searchLower) ||
          ticket.description.toLowerCase().includes(searchLower)
        );
      }

      setTickets(filteredTickets);
      setPagination(data.pagination);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [filters.status, filters.category, filters.priority, filters.search, pagination.page, pagination.limit]);

  useEffect(() => {
    if (session) {
      fetchTickets();
    }
  }, [session, refreshTrigger, fetchTickets]);

  useEffect(() => {
    // Reset to first page when filters change
    if (pagination.page !== 1) {
      setPagination(prev => ({ ...prev, page: 1 }));
    } else {
      fetchTickets();
    }
  }, [filters.search, fetchTickets, pagination.page]);

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-500 text-white border border-blue-600';
      case 'IN_PROGRESS': return 'bg-amber-500 text-white border border-amber-600';
      case 'RESOLVED': return 'bg-green-500 text-white border border-green-600';
      case 'CLOSED': return 'bg-slate-500 text-white border border-slate-600';
      case 'CANCELLED': return 'bg-red-500 text-white border border-red-600';
      default: return 'bg-gray-500 text-white border border-gray-600';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-gray-600 text-white border border-gray-700';
      case 'MEDIUM': return 'bg-blue-600 text-white border border-blue-700';
      case 'HIGH': return 'bg-orange-600 text-white border border-orange-700';
      case 'URGENT': return 'bg-red-600 text-white border border-red-700';
      default: return 'bg-gray-600 text-white border border-gray-700';
    }
  };

  const getStatusLabel = (status: string) => {
    return statuses.find(s => s.value === status)?.label || status;
  };

  const getCategoryLabel = (category: string) => {
    return categories.find(c => c.value === category)?.label || category;
  };

  const getPriorityLabel = (priority: string) => {
    return priorities.find(p => p.value === priority)?.label || priority;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Check if ticket is new (created within last 24 hours) AND not viewed by current user
  const isNewTicket = (createdAt: string, views: { viewedAt: string }[]) => {
    const now = new Date();
    const ticketDate = new Date(createdAt);
    const hoursDiff = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60);
    const isRecent = hoursDiff <= 24;
    const hasBeenViewed = views.length > 0;
    return isRecent && !hasBeenViewed;
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-gray-500">กรุณาเข้าสู่ระบบเพื่อดูรายการ tickets</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            ตัวกรอง
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">ค้นหา</label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="ค้นหาหัวข้อหรือรายละเอียด"
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">สถานะ</label>
              <Select value={filters.status || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === 'all' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="ทุกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">หมวดหมู่</label>
              <Select value={filters.category || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, category: value === 'all' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="ทุกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">ความสำคัญ</label>
              <Select value={filters.priority || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, priority: value === 'all' ? '' : value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="ทุกระดับ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกระดับ</SelectItem>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">รีเซ็ตตัวกรอง</label>
              <Button 
                variant="outline" 
                onClick={() => setFilters({ status: '', category: '', priority: '', search: '' })}
                className="w-full"
              >
                ล้างตัวกรอง
              </Button>
            </div>
          </div>
          
          {/* Legend for new tickets */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 shadow-sm">
            <div className="flex items-center gap-3 text-blue-800">
              <Sparkles className="h-5 w-5 animate-pulse" />
              <span className="font-semibold text-base">หมายเหตุ:</span>
              <span className="text-sm">Tickets ที่มี</span>
              <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold border border-red-600">ใหม่</span>
              <span className="text-sm">และพื้นหลังสีฟ้าคือ tickets ใหม่ที่สร้างใน 24 ชั่วโมงที่ผ่านมาและยังไม่ได้เปิดดู</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card>
        <CardHeader>
          <CardTitle>รายการ Tickets</CardTitle>
          <CardDescription>
            แสดง {tickets.length} รายการจากทั้งหมด {pagination.total} รายการ
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <p>กำลังโหลด...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-600">
              <p>{error}</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>ไม่พบ tickets</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => {
                const isNew = isNewTicket(ticket.createdAt, ticket.views);
                return (
                  <div
                    key={ticket.id}
                    className={`border-2 rounded-xl p-5 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${
                      isNew 
                        ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 shadow-blue-200/50' 
                        : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-gray-400'
                    }`}
                    onClick={() => onTicketSelect?.(ticket)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        {isNew && (
                          <div className="flex items-center gap-2 text-blue-700">
                            <Sparkles className="h-5 w-5 animate-pulse" />
                            <span className="text-xs font-bold bg-red-500 text-white px-3 py-1 rounded-full shadow-md border border-red-600">
                              ใหม่
                            </span>
                          </div>
                        )}
                        <h3 className={`font-semibold text-xl leading-tight ${
                          isNew ? 'text-blue-900' : 'text-gray-900'
                        }`}>{ticket.title}</h3>
                      </div>
                      <div className="flex gap-3">
                        <Badge className={`font-semibold px-3 py-1 text-sm ${getPriorityColor(ticket.priority)}`}>
                          {getPriorityLabel(ticket.priority)}
                        </Badge>
                        <Badge className={`font-semibold px-3 py-1 text-sm ${getBadgeColor(ticket.status)}`}>
                          {getStatusLabel(ticket.status)}
                        </Badge>
                      </div>
                    </div>

                    <p className={`text-base mb-4 line-clamp-2 leading-relaxed ${
                      isNew ? 'text-blue-800' : 'text-gray-700'
                    }`}>
                      {ticket.description}
                    </p>

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 text-sm font-medium">
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${
                        isNew ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        <User className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {ticket.reportedBy.employee?.firstName && ticket.reportedBy.employee?.lastName 
                            ? `${ticket.reportedBy.employee.firstName} ${ticket.reportedBy.employee.lastName}`
                            : ticket.reportedBy.name
                          }
                        </span>
                      </div>
                      
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${
                        isNew ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{formatDate(ticket.createdAt)}</span>
                      </div>

                      <div className={`flex items-center gap-2 p-2 rounded-lg ${
                        isNew ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}>
                        <Clock className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{getCategoryLabel(ticket.category)}</span>
                      </div>

                      {ticket._count.comments > 0 && (
                        <div className={`flex items-center gap-2 p-2 rounded-lg ${
                          isNew ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          <MessageSquare className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{ticket._count.comments} ความคิดเห็น</span>
                        </div>
                      )}

                      {ticket.assignedTo && (
                        <div className={`flex items-center gap-2 p-2 rounded-lg col-span-2 ${
                          isNew ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                        }`}>
                          <User className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            มอบหมายให้: {ticket.assignedTo.employee?.firstName && ticket.assignedTo.employee?.lastName 
                              ? `${ticket.assignedTo.employee.firstName} ${ticket.assignedTo.employee.lastName}`
                              : ticket.assignedTo.name
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                หน้า {pagination.page} จาก {pagination.pages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  ก่อนหน้า
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                >
                  ถัดไป
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}