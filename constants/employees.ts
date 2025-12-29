export type EmployeeStatusValue = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface EmployeeStatusOption {
  value: EmployeeStatusValue;
  label: string;
  color: string;
  icon: string;
  description: string;
}

export const EMPLOYEE_STATUSES: EmployeeStatusOption[] = [
  {
    value: 'ACTIVE',
    label: 'ทำงานอยู่',
    color: 'green',
    icon: '✓',
    description: 'พนักงานกำลังทำงานอยู่'
  },
  {
    value: 'INACTIVE',
    label: 'ไม่ทำงาน',
    color: 'gray',
    icon: '○',
    description: 'พนักงานไม่ได้ทำงานอยู่'
  },
  {
    value: 'SUSPENDED',
    label: 'ถูกระงับ',
    color: 'red',
    icon: '⚠',
    description: 'พนักงานถูกระงับสิทธิ์'
  }
];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatusValue, string> = {
  ACTIVE: 'ทำงานอยู่',
  INACTIVE: 'ไม่ทำงาน',
  SUSPENDED: 'ถูกระงับ'
};

export const EMPLOYEE_STATUS_BADGE_CLASSES: Record<EmployeeStatusValue, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  SUSPENDED: 'bg-red-100 text-red-800'
};
