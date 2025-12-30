import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES, PRIORITY_BADGE_COLORS, STATUS_BADGE_COLORS, PRIORITY_HEX_COLORS, STATUS_HEX_COLORS } from '@/constants/tickets';

export function getTicketCategoryLabel(category: string): string {
  const categoryOption = TICKET_CATEGORIES.find(c => c.value === category);
  return categoryOption?.label || category;
}

export function getTicketPriorityLabel(priority: string): string {
  const priorityOption = TICKET_PRIORITIES.find(p => p.value === priority);
  return priorityOption?.label || priority;
}

export function getTicketStatusLabel(status: string): string {
  const statusOption = TICKET_STATUSES.find(s => s.value === status);
  return statusOption?.label || status;
}

export function getPriorityBadgeColor(priority: string): string {
  return PRIORITY_BADGE_COLORS[priority as keyof typeof PRIORITY_BADGE_COLORS] || 'bg-gray-600 text-white border border-gray-700';
}

export function getStatusBadgeColor(status: string): string {
  return STATUS_BADGE_COLORS[status as keyof typeof STATUS_BADGE_COLORS] || 'bg-gray-500 text-white border border-gray-600';
}

export function getPriorityHexColor(priority: string): string {
  return PRIORITY_HEX_COLORS[priority as keyof typeof PRIORITY_HEX_COLORS] || '#6B7280';
}

export function getStatusHexColor(status: string): string {
  return STATUS_HEX_COLORS[status as keyof typeof STATUS_HEX_COLORS] || '#6B7280';
}

export function getPriorityBadge(priority: string, showLabel: boolean = true): string {
  const color = getPriorityBadgeColor(priority);
  const label = getTicketPriorityLabel(priority);
  return showLabel ? `${color} ${label}` : color;
}

export function getStatusBadge(status: string, showLabel: boolean = true): string {
  const color = getStatusBadgeColor(status);
  const label = getTicketStatusLabel(status);
  return showLabel ? `${color} ${label}` : color;
}

export function getTicketCategoryOption(category: string): { value: string; label: string } | undefined {
  return TICKET_CATEGORIES.find(c => c.value === category);
}

export function getTicketPriorityOption(priority: string): { value: string; label: string } | undefined {
  return TICKET_PRIORITIES.find(p => p.value === priority);
}

export function getTicketStatusOption(status: string): { value: string; label: string } | undefined {
  return TICKET_STATUSES.find(s => s.value === status);
}
