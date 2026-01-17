'use client';

import { useState, useEffect } from 'react';
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
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { type EditStatusModalProps } from '@/types/employees';
import { type EmployeeStatusValue } from '@/types/employees';
import { EMPLOYEE_STATUSES } from '@/constants/employees';
import { getEmployeeStatusInfo } from '@/lib/helpers/employee-helpers';

export function EditStatusModal({
  employee,
  isOpen,
  onClose,
  onStatusUpdate
}: EditStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<EmployeeStatusValue>('ACTIVE' as EmployeeStatusValue);
  const [isUpdating, setIsUpdating] = useState(false);

  // Reset selected status when modal opens
  useEffect(() => {
    if (employee && isOpen) {
      setSelectedStatus(employee.status);
    }
  }, [employee, isOpen]);

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value as EmployeeStatusValue);
  };

  const handleUpdate = async () => {
    if (!employee || !selectedStatus) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: selectedStatus }),
      });

      if (response.ok) {
        onStatusUpdate(employee.id, selectedStatus);
        onClose();
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'เกิดข้อผิดพลาดในการอัปเดต');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
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
            เปลี่ยนสถานะการทำงานของ {employee.firstName} {employee.lastName}
            {employee.nickname && (
              <span className="text-blue-600 ml-1">({employee.nickname})</span>
            )}
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
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-gray-600" />
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
            <div className="p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
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
            {isUpdating ? 'กำลังอัปเดต...' : 'บันทึกการเปลี่ยนแปลง'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}