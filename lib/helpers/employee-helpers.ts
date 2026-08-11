import { EMPLOYEE_STATUSES, EMPLOYEE_STATUS_LABELS, EMPLOYEE_STATUS_BADGE_CLASSES } from '@/constants/employees';
import { type EmployeeStatusValue } from '@/constants/employees';

export function getEmployeeStatusLabel(status: string): string {
  return EMPLOYEE_STATUS_LABELS[status as EmployeeStatusValue] || status;
}

export function getEmployeeStatusBadge(status: string): string {
return EMPLOYEE_STATUS_BADGE_CLASSES[status as EmployeeStatusValue] || 'bg-surface-neutral-muted text-content-neutral-strong';
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
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

export interface EmployeeDisplayNameSource {
  firstName: string;
  lastName: string;
  nickname?: string | null;
}

export interface EmployeeBackedUserDisplayNameSource {
  name?: string | null;
  email?: string | null;
  employee?: EmployeeDisplayNameSource | null;
}

export function getEmployeeDisplayName(employee: EmployeeDisplayNameSource): string {
  const fullName = getEmployeeFullName(employee.firstName, employee.lastName);
  const nickname = employee.nickname?.trim();

  if (!nickname) return fullName;
  return fullName ? `${fullName} (${nickname})` : nickname;
}

export function getEmployeeBackedUserDisplayName(
  user: EmployeeBackedUserDisplayNameSource,
  fallback = 'ไม่ระบุชื่อ',
): string {
  const employeeName = user.employee
    && typeof user.employee.firstName === 'string'
    && typeof user.employee.lastName === 'string'
    ? getEmployeeDisplayName(user.employee)
    : '';

  return employeeName || user.name?.trim() || user.email?.trim() || fallback;
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
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  }

  return phone;
}

export function getEmployeeDepartmentLabel(department?: string): string {
  if (department === 'ADMIN' || department === 'บริหาร') {
    return 'บริหาร';
  }

  return 'วิชาการ';
}

export function getEmployeeDepartmentBadgeClass(department?: string): string {
  if (department === 'ADMIN' || department === 'บริหาร') {
    return 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100';
  }

  return 'bg-sky-50 text-sky-700 border-sky-200/80 hover:bg-sky-100';
}
