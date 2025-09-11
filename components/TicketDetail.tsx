"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  User, 
  MessageSquare, 
  Send, 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  XCircle 
} from 'lucide-react';

interface TicketDetailProps {
  ticketId: number;
  onBack?: () => void;
  onTicketUpdated?: () => void;
}

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  author: {
    id: number;
    name: string;
    email: string;
    role: string;
    employee?: {
      firstName: string;
      lastName: string;
    };
  };
}

interface TicketDetail {
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
  comments: Comment[];
}

export default function TicketDetail({ ticketId, onBack, onTicketUpdated }: TicketDetailProps) {
  const { data: session } = useSession();
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');

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

  const fetchTicket = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/tickets/${ticketId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      setTicket(data.ticket);
      setStatusUpdate(data.ticket.status);

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setCommentLoading(true);

      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: newComment }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      // Add new comment to the list
      setTicket(prev => prev ? {
        ...prev,
        comments: [...prev.comments, data.comment]
      } : null);

      setNewComment('');

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเพิ่มความคิดเห็น';
      alert(errorMessage);
    } finally {
      setCommentLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusUpdate || statusUpdate === ticket?.status) return;

    try {
      setUpdateLoading(true);

      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: statusUpdate }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'เกิดข้อผิดพลาด');
      }

      setTicket(prev => prev ? { ...prev, ...data.ticket } : null);
      
      if (onTicketUpdated) {
        onTicketUpdated();
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตสถานะ';
      alert(errorMessage);
    } finally {
      setUpdateLoading(false);
    }
  };

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId, fetchTicket]);

  const getBadgeColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS': return 'bg-yellow-100 text-yellow-800';
      case 'RESOLVED': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'LOW': return 'bg-gray-100 text-gray-800';
      case 'MEDIUM': return 'bg-blue-100 text-blue-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'URGENT': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'OPEN': return <AlertCircle className="h-4 w-4" />;
      case 'IN_PROGRESS': return <Clock className="h-4 w-4" />;
      case 'RESOLVED': return <CheckCircle className="h-4 w-4" />;
      case 'CLOSED': return <XCircle className="h-4 w-4" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getLabel = (value: string, options: { value: string; label: string }[]) => {
    return options.find(option => option.value === value)?.label || value;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isAdmin = session?.user?.role === 'ADMIN';
  const isOwner = ticket && session && ticket.reportedBy.id === parseInt(session.user.id);
  const canComment = isAdmin || isOwner || (ticket?.assignedTo?.id === parseInt(session?.user?.id || ''));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">กำลังโหลด...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !ticket) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            {error || 'ไม่พบข้อมูล ticket'}
          </div>
          {onBack && (
            <div className="text-center mt-4">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                กลับ
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {onBack && (
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับ
          </Button>
        )}
        <div className="flex items-center gap-2">
          {getStatusIcon(ticket.status)}
          <span className="text-sm font-medium">Ticket #{ticket.id}</span>
        </div>
      </div>

      {/* Ticket Details */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>{ticket.title}</CardTitle>
              <CardDescription>
                แจ้งโดย {ticket.reportedBy.employee?.firstName && ticket.reportedBy.employee?.lastName 
                  ? `${ticket.reportedBy.employee.firstName} ${ticket.reportedBy.employee.lastName}`
                  : ticket.reportedBy.name
                }
                {ticket.reportedBy.employee?.dept && ` (${ticket.reportedBy.employee.dept.name})`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className={getPriorityColor(ticket.priority)}>
                {getLabel(ticket.priority, priorities)}
              </Badge>
              <Badge className={getBadgeColor(ticket.status)}>
                {getLabel(ticket.status, statuses)}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">รายละเอียดปัญหา</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">หมวดหมู่:</span>
              <p>{getLabel(ticket.category, categories)}</p>
            </div>
            <div>
              <span className="font-medium">วันที่แจ้ง:</span>
              <p>{formatDate(ticket.createdAt)}</p>
            </div>
            <div>
              <span className="font-medium">อัปเดตล่าสุด:</span>
              <p>{formatDate(ticket.updatedAt)}</p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <span className="font-medium">วันที่แก้ไข:</span>
                <p>{formatDate(ticket.resolvedAt)}</p>
              </div>
            )}
          </div>

          {ticket.assignedTo && (
            <div>
              <span className="font-medium">มอบหมายให้:</span>
              <p>
                {ticket.assignedTo.employee?.firstName && ticket.assignedTo.employee?.lastName 
                  ? `${ticket.assignedTo.employee.firstName} ${ticket.assignedTo.employee.lastName}`
                  : ticket.assignedTo.name
                }
              </p>
            </div>
          )}

          {/* Admin Controls */}
          {isAdmin && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">จัดการ Ticket</h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium">สถานะ</label>
                  <Select value={statusUpdate} onValueChange={setStatusUpdate}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleStatusUpdate}
                  disabled={updateLoading || statusUpdate === ticket.status}
                >
                  {updateLoading ? 'กำลังอัปเดต...' : 'อัปเดตสถานะ'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            ความคิดเห็น ({ticket.comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.comments.length === 0 ? (
            <p className="text-gray-500 text-center py-4">ยังไม่มีความคิดเห็น</p>
          ) : (
            <div className="space-y-4">
              {ticket.comments.map((comment, index) => (
                <div key={comment.id}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium">
                        {comment.author.employee?.firstName && comment.author.employee?.lastName 
                          ? `${comment.author.employee.firstName} ${comment.author.employee.lastName}`
                          : comment.author.name
                        }
                      </span>
                      {comment.author.role === 'ADMIN' && (
                        <Badge variant="secondary" className="text-xs">Admin</Badge>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-gray-700 whitespace-pre-wrap ml-6">{comment.content}</p>
                  {index < ticket.comments.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          )}

          {/* Add Comment */}
          {canComment && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">เพิ่มความคิดเห็น</h3>
              <div className="space-y-3">
                <Textarea
                  placeholder="แสดงความคิดเห็นหรือให้ข้อมูลเพิ่มเติม..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button 
                  onClick={handleAddComment}
                  disabled={commentLoading || !newComment.trim()}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {commentLoading ? 'กำลังส่ง...' : 'ส่งความคิดเห็น'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}