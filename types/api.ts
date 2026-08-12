import { type Employee, } from '@/types/employees';
import type { SharedDriveOption } from '@/constants/email-request';

export interface EmailRequestBody {
  email: string;
  subject?: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
}

export interface EmailRequestData {
  thaiName: string;
  englishName: string;
  phone: string;
  nickname: string;
  position: string;
  department: string;
  replyEmail: string;
  needsDocumentSystem: boolean;
  sharedDriveAccess: SharedDriveOption[];
  requestedAt: string;
}

export interface StockRequestLineItemData {
  name: string;
  quantity: number;
  unit: string;
  variantLabel?: string;
}

export interface StockRequestLineData {
  requestId: number;
  projectCode: string;
  requesterName: string;
  note?: string | null;
  requestedAt: string;
  itemCount: number;
  totalQuantity: number;
  items: StockRequestLineItemData[];
}

export interface AggregateStockLowLineItemData {
  itemId: number;
  name: string;
  sku: string;
  quantity: number;
  minStock: number;
  unit: string;
}

export interface VariantStockLowLineItemData {
  itemId: number;
  variantId: number;
  itemName: string;
  variantSku: string;
  variantLabel: string;
  quantity: number;
  minStock: number;
  unit: string;
}

export type StockLowLineItemData =
  | AggregateStockLowLineItemData
  | VariantStockLowLineItemData;

export interface StockLowLineData {
  alertedAt: string;
  itemCount: number;
  items: StockLowLineItemData[];
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
