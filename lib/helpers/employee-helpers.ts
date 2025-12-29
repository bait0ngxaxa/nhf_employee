import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_BADGE_CLASSES } from '@/constants/employees';
import { EmployeeStatusValue } from '@/constants/employees';

export function getEmployeeStatusLabel(status: string): string {
  return EMPLOYEE_STATUS_LABELS[status as EmployeeStatusValue] || status;
}

export function getEmployeeStatusBadge(status: string): string {
  return EMPLOYEE_STATUS_BADGE_CLASSES[status as EmployeeStatusValue] || 'bg-gray-100 text-gray-800';
}

export function getEmployeeStatusInfo(status: string) {
  const statusInfo = EMPLOYEE_STATUSES.find(s => s.value === status);
  return statusInfo || {
    value: status as EmployeeStatusValue,
    label: status,
    color: 'gray',
    icon: '○',
    description: ''
  };
}

export function getEmployeeStatusValueFromLabel(label: string): EmployeeStatusValue | undefined {
  const status = EMPLOYEE_STATUSES.find(s => s.label === label);
  return status?.value;
}

export function isEmployeeActive(status: string): boolean {
  return status === 'ACTIVE';
}

export function isEmployeeSuspended(status: string): boolean {
  return status === 'SUSPENDED';
}

export function getEmployeeFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export function getEmployeeDisplayName(employee: { firstName: string; lastName: string; nickname?: string }): string {
  if (employee.nickname) {
    return `${employee.firstName} ${employee.lastName} (${employee.nickname})`;
  }
  return `${employee.firstName} ${employee.lastName}`;
}

export function getEmployeeInitials(firstName: string, lastName: string): string {
  const firstInitial = firstName.charAt(0).toUpperCase();
  const lastInitial = lastName.charAt(0).toUpperCase();
  return `${firstInitial}${lastInitial}`;
}

export function getEmployeeEmailStatus(email: string): 'valid' | 'temp' | 'invalid' {
  if (!email || email.trim() === '') {
    return 'invalid';
  }
  if (email.includes('@temp.local')) {
    return 'temp';
  }
  return 'valid';
}

export function formatEmployeePhone(phone?: string): string {
  if (!phone) return '-';
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  
  return phone;
}
