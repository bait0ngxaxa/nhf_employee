'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from "sonner";
import { type EditStatusModalProps } from '@/types/employees';
import { type EmployeeStatusValue } from '@/types/employees';
import { EMPLOYEE_STATUSES } from '@/constants/employees';
import { apiPatch } from '@/lib/client/api-client';
import {
  getEmployeeDisplayName,
  getEmployeeStatusInfo,
} from '@/lib/helpers/employee-helpers';

export function EditStatusModal({
  employee,
  isOpen,
  onClose,
  onStatusUpdate
}: EditStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<EmployeeStatusValue>(
    () => employee?.status || 'ACTIVE' as EmployeeStatusValue
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value as EmployeeStatusValue);
  };

  const handleUpdate = async () => {
    if (!employee || !selectedStatus) return;

    setIsUpdating(true);
    try {
      const response = await apiPatch(`/api/employees/${employee.id}`, { status: selectedStatus });

      if (response.success) {
        onStatusUpdate(employee.id, selectedStatus);
        toast.success("อัปเดตสถานะสำเร็จ", {
          description: `สถานะของ ${getEmployeeDisplayName(employee)} ถูกเปลี่ยนเป็น "${selectedStatusInfo.label}" เรียบร้อยแล้ว`,
        });
        onClose();
      } else {
        toast.error("เกิดข้อผิดพลาด", {
          description: response.error || 'เกิดข้อผิดพลาดในการอัปเดตสถานะ',
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error("เกิดข้อผิดพลาด", {
        description: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!employee) return null;

  const currentStatusInfo = getEmployeeStatusInfo(employee.status);
  const selectedStatusInfo = getEmployeeStatusInfo(selectedStatus);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>แก้ไขสถานะพนักงาน</span>
          </DialogTitle>
          <DialogDescription>
            เปลี่ยนสถานะการทำงานของ {getEmployeeDisplayName(employee)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Current Status */}
          <div className="space-y-2">
            <label className="text-sm font-medium">สถานะปัจจุบัน:</label>
            <div className="flex items-center space-x-2">
              <Badge className={currentStatusInfo.color}>
                {currentStatusInfo.icon}
                <span className="ml-1">{currentStatusInfo.label}</span>
              </Badge>
            </div>
          </div>

          {/* New Status Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">สถานะใหม่:</label>
            <Select value={selectedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger>
                <SelectValue placeholder="เลือกสถานะใหม่" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYEE_STATUSES.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center space-x-2">
                      {status.icon === '✓' ? (
                        <CheckCircle2 className="h-4 w-4 text-status-positive-accent" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-content-neutral-secondary" />
                      )}
                      <span>{status.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Description */}
          {selectedStatus && (
            <div className="p-3 bg-action-primary-surface rounded-md">
              <p className="text-sm text-action-primary-strong">
                <strong>คำอธิบาย:</strong> {selectedStatusInfo.description}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isUpdating}>
            ยกเลิก
          </Button>
          <Button 
            onClick={handleUpdate} 
            disabled={isUpdating || !selectedStatus || selectedStatus === employee.status}
          >
            {isUpdating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังอัปเดต...
              </>
            ) : (
              'บันทึกการเปลี่ยนแปลง'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
