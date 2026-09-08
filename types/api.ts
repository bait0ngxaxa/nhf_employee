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
