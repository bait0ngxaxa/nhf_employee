import { type TicketCategoryValue, type TicketPriorityValue, type TicketStatusValue } from '@/constants/tickets';
import { type Ticket, } from '@/types/tickets';
import { type Employee, } from '@/types/employees';

export interface EmailRequestBody {
  email: string;
  subject?: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
}

export interface TicketEmailData {
  ticketId: number;
  title: string;
  description: string;
  category: TicketCategoryValue;
  priority: TicketPriorityValue;
  status: TicketStatusValue;
  reportedBy: {
    name: string;
    email: string;
    department?: string;
  };
  assignedTo?: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface LineNotificationData {
  ticketId: number;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  reportedBy: {
    name: string;
    email: string;
    department?: string;
  };
  createdAt: string;
}

export interface EmailRequestData {
  thaiName: string;
  englishName: string;
  phone: string;
  nickname: string;
  position: string;
  department: string;
  replyEmail: string;
  requestedAt: string;
}

// LINE Flex Message type definitions
export interface LineFlexText {
  type: 'text';
  text: string;
  weight?: 'regular' | 'bold';
  color?: string;
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | '3xl' | '4xl' | '5xl';
  wrap?: boolean;
  flex?: number;
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

export interface LineFlexSeparator {
  type: 'separator';
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

export interface LineFlexSpacer {
  type: 'spacer';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
}

export interface LineFlexButton {
  type: 'button';
  style?: 'link' | 'primary' | 'secondary';
  height?: 'sm' | 'md';
  action: {
    type: 'uri';
    label: string;
    uri: string;
  };
  color?: string;
}

export interface LineFlexBox {
  type: 'box';
  layout: 'vertical' | 'horizontal' | 'baseline';
  contents: LineFlexComponent[];
  spacing?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  margin?: 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  backgroundColor?: string;
  paddingAll?: string;
  flex?: number;
}

export type LineFlexComponent = LineFlexText | LineFlexSeparator | LineFlexSpacer | LineFlexButton | LineFlexBox;

export interface LineFlexMessage {
  type: 'flex';
  altText: string;
  contents: {
    type: 'bubble';
    header?: LineFlexBox;
    body?: LineFlexBox;
    footer?: LineFlexBox;
  };
}

export interface LineWebhookData {
  type: 'new_ticket' | 'status_update' | 'it_team_urgent' | 'email_request';
  ticket?: LineNotificationData;
  emailRequest?: EmailRequestData;
  oldStatus?: string;
  flexMessage: LineFlexMessage;
}

export interface CreateTicketResponse {
  success: boolean;
  ticket?: {
    id: number;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  error?: string;
}

export interface GetTicketsResponse {
  tickets: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface GetEmployeesResponse {
  employees: Employee[];
  total: number;
}

export interface DepartmentResponse {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export interface TicketCommentFormData {
  content: string;
}

export interface TicketCommentResponse {
  success: boolean;
  comment?: {
    id: number;
    content: string;
    createdAt: string;
    authorId: number;
    ticketId: number;
  };
  error?: string;
}

export interface UpdateTicketData {
  title?: string;
  description?: string;
  category?: TicketCategoryValue;
  priority?: TicketPriorityValue;
  status?: TicketStatusValue;
  assignedToId?: number | null;
}
