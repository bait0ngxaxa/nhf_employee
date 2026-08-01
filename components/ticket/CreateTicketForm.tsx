"use client";

import {
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import {
  AsyncFormDialog,
  AsyncFormDialogClose,
  AsyncFormDialogContent,
} from '@/components/ui/async-form-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from "sonner";
import { type CreateTicketFormProps, type TicketFormData } from '@/types/tickets';
import { TICKET_CATEGORIES, TICKET_PRIORITIES } from '@/constants/tickets';
import { apiPost } from "@/lib/client/api-client";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/HybridAuthProvider";
import { createIdempotencyKey } from "@/lib/client/idempotency-key";
import { canCreateTicketWithPriority } from "@/lib/ssot/ticket-priority-policy";

const INITIAL_TICKET_FORM_DATA: TicketFormData = {
  title: '',
  description: '',
  category: '',
  priority: 'MEDIUM',
};

export default function CreateTicketForm({
  isOpen,
  onClose,
  onTicketCreated,
}: CreateTicketFormProps): ReactElement {
  const { user } = useAuth();
  const [formData, setFormData] = useState<TicketFormData>(
    INITIAL_TICKET_FORM_DATA,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const idempotencyRef = useRef<{
    payload: string;
    key: string;
  } | null>(null);
  const isDirty =
    formData.title !== INITIAL_TICKET_FORM_DATA.title ||
    formData.description !== INITIAL_TICKET_FORM_DATA.description ||
    formData.category !== INITIAL_TICKET_FORM_DATA.category ||
    formData.priority !== INITIAL_TICKET_FORM_DATA.priority;

  const resetForm = (): void => {
    setFormData(INITIAL_TICKET_FORM_DATA);
    setError('');
    idempotencyRef.current = null;
  };

  const handleInputChange = (
    field: keyof TicketFormData,
    value: string,
  ): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim() || !formData.category) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const payload = JSON.stringify(formData);
      if (idempotencyRef.current?.payload !== payload) {
        idempotencyRef.current = {
          payload,
          key: createIdempotencyKey(),
        };
      }
      const response = await apiPost<{ ticket: { id: string } }>(
        '/api/tickets',
        formData,
        {
          headers: {
            "Idempotency-Key": idempotencyRef.current.key,
          },
        },
      );

      if (!response.success) {
        throw new Error(response.error || 'เกิดข้อผิดพลาด');
      }

      // Show toast notification
      toast.success("ส่งคำร้องสำเร็จ!", {
        description: `คำร้องแจ้งปัญหา "${formData.title}" ได้รับการบันทึกเรียบร้อยแล้ว หมายเลขที่ติดตาม: #${response.data.ticket.id}`,
      });
      
      resetForm();

      // Close the dialog immediately
      onClose();
      
      // Call callback if provided
      if (onTicketCreated) {
        onTicketCreated();
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการส่งคำร้อง';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };



  if (!user) {
    return (
      <AsyncFormDialog
        open={isOpen}
        busy={isLoading}
        dirty={isDirty}
        onClose={onClose}
        onDiscard={resetForm}
      >
        <AsyncFormDialogContent className="sm:max-w-md">
          <AsyncFormDialogClose
            variant="ghost"
            size="icon-sm"
            className="absolute right-4 top-4"
            aria-label="ปิดหน้าต่างแจ้งปัญหาไอที"
          />
          <DialogHeader className="sr-only">
            <DialogTitle>แจ้งปัญหาไอที</DialogTitle>
            <DialogDescription>
              ต้องเข้าสู่ระบบก่อนแจ้งปัญหาไอที
            </DialogDescription>
          </DialogHeader>
          <div className="text-center p-6">
            <p className="text-content-neutral-muted">กรุณาเข้าสู่ระบบเพื่อแจ้งปัญหา</p>
          </div>
        </AsyncFormDialogContent>
      </AsyncFormDialog>
    );
  }

  return (
    <AsyncFormDialog
      open={isOpen}
      busy={isLoading}
      dirty={isDirty}
      onClose={onClose}
      onDiscard={resetForm}
    >
      <AsyncFormDialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain">
          <AsyncFormDialogClose
            variant="ghost"
            size="icon-sm"
            className="absolute right-4 top-4"
            aria-label="ปิดแบบฟอร์มแจ้งปัญหาไอที"
          />
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">แจ้งปัญหาไอที</DialogTitle>
            <DialogDescription>
              กรอกรายละเอียดปัญหาที่พบเพื่อให้ทีม IT สามารถช่วยเหลือคุณได้
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">หัวข้อปัญหา *</Label>
              <Input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="สรุปปัญหาที่พบในหัวข้อสั้นๆ"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">หมวดหมู่ปัญหา *</Label>
              <Select 
                value={formData.category} 
                onValueChange={(value) => handleInputChange('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกหมวดหมู่ปัญหา" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">ระดับความสำคัญ</Label>
              <Select 
                value={formData.priority} 
                onValueChange={(value) => handleInputChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกระดับความสำคัญ" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES
                    .filter(
                      (priority) =>
                        canCreateTicketWithPriority(priority.value, user.role),
                    )
                    .map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">รายละเอียดปัญหา *</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="อธิบายปัญหาที่พบให้ละเอียด เช่น ขั้นตอนที่ทำ, ข้อความแสดงข้อผิดพลาด, เวลาที่เกิดปัญหา"
                rows={5}
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-5 border-t mt-4">
              <AsyncFormDialogClose
                variant="ghost"
                className="h-11 px-5 font-medium hover:bg-surface-muted text-content-secondary"
              >
                ยกเลิก
              </AsyncFormDialogClose>
              <Button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                className="h-11 px-7 font-bold bg-blue-600 hover:bg-blue-700 text-content-on-brand shadow-sm transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    กำลังส่ง...
                  </>
                ) : (
                  'ส่งคำร้องแจ้งปัญหา'
                )}
              </Button>
            </div>
          </form>
      </AsyncFormDialogContent>
    </AsyncFormDialog>
  );
}
