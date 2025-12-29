export type TicketCategoryValue = 'HARDWARE' | 'SOFTWARE' | 'NETWORK' | 'ACCOUNT' | 'EMAIL' | 'PRINTER' | 'OTHER';
export type TicketPriorityValue = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatusValue = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export interface TicketOption {
  value: string;
  label: string;
}

export const TICKET_CATEGORIES: TicketOption[] = [
  { value: 'HARDWARE', label: 'ฮาร์ดแวร์' },
  { value: 'SOFTWARE', label: 'ซอฟต์แวร์' },
  { value: 'NETWORK', label: 'เครือข่าย' },
  { value: 'ACCOUNT', label: 'บัญชีผู้ใช้' },
  { value: 'EMAIL', label: 'อีเมล' },
  { value: 'PRINTER', label: 'เครื่องพิมพ์' },
  { value: 'OTHER', label: 'อื่นๆ' }
];

export const TICKET_PRIORITIES: TicketOption[] = [
  { value: 'LOW', label: 'ต่ำ' },
  { value: 'MEDIUM', label: 'ปานกลาง' },
  { value: 'HIGH', label: 'สูง' },
  { value: 'URGENT', label: 'เร่งด่วน' }
];

export const TICKET_STATUSES: TicketOption[] = [
  { value: 'OPEN', label: 'เปิด' },
  { value: 'IN_PROGRESS', label: 'กำลังดำเนินการ' },
  { value: 'RESOLVED', label: 'แก้ไขแล้ว' },
  { value: 'CLOSED', label: 'ปิด' },
  { value: 'CANCELLED', label: 'ยกเลิก' }
];

export const PRIORITY_BADGE_COLORS: Record<TicketPriorityValue, string> = {
  LOW: 'bg-gray-600 text-white border border-gray-700',
  MEDIUM: 'bg-blue-600 text-white border border-blue-700',
  HIGH: 'bg-orange-600 text-white border border-orange-700',
  URGENT: 'bg-red-600 text-white border border-red-700'
};

export const STATUS_BADGE_COLORS: Record<TicketStatusValue, string> = {
  OPEN: 'bg-blue-500 text-white border border-blue-600',
  IN_PROGRESS: 'bg-amber-500 text-white border border-amber-600',
  RESOLVED: 'bg-green-500 text-white border border-green-600',
  CLOSED: 'bg-slate-500 text-white border border-slate-600',
  CANCELLED: 'bg-red-500 text-white border border-red-600'
};

export const PRIORITY_HEX_COLORS: Record<TicketPriorityValue, string> = {
  LOW: '#6B7280',
  MEDIUM: '#3B82F6',
  HIGH: '#F59E0B',
  URGENT: '#EF4444'
};

export const STATUS_HEX_COLORS: Record<TicketStatusValue, string> = {
  OPEN: '#3B82F6',
  IN_PROGRESS: '#F59E0B',
  RESOLVED: '#10B981',
  CLOSED: '#6B7280',
  CANCELLED: '#EF4444'
};

export const PRIORITY_EMOJIS: Record<TicketPriorityValue, string> = {
  LOW: '⬇️',
  MEDIUM: '🔵',
  HIGH: '🟠',
  URGENT: '🔴'
};
