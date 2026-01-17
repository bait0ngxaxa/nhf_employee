import { type TicketCategoryValue, type TicketPriorityValue, type TicketStatusValue } from '@/constants/tickets';

export type { TicketCategoryValue, TicketPriorityValue, TicketStatusValue };

export interface Ticket {
  id: number;
  title: string;
  description: string;
  category: TicketCategoryValue;
  priority: TicketPriorityValue;
  status: TicketStatusValue;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  reportedById: number;
  assignedToId?: number | null;
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
  } | null;
  _count?: {
    comments: number;
  };
  views?: Array<{
    viewedAt: string;
  }>;
}

export interface TicketDetail extends Ticket {
  comments: Comment[];
}

export interface Comment {
  id: number;
  content: string;
  createdAt: string;
  ticketId: number;
  authorId: number;
  author: {
    id: number;
    name: string;
    email: string;
    employee?: {
      firstName: string;
      lastName: string;
    };
  };
}

export interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  cancelled: number;
  highPriority: number;
  urgentPriority: number;
  userTickets?: number;
  newTickets?: number;
}

export interface CreateTicketFormProps {
  isOpen: boolean;
  onClose: () => void;
  onTicketCreated?: () => void;
}

export interface TicketListProps {
  onTicketSelect?: (ticket: Ticket) => void;
  refreshTrigger?: number;
}

export interface TicketDetailProps {
  ticketId: number;
  onClose: () => void;
}

export interface TicketFormData {
  title: string;
  description: string;
  category: string;
  priority: string;
}

export interface TicketFilters {
  status?: string;
  category?: string;
  priority?: string;
  search?: string;
}

export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
