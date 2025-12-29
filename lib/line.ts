import { LineNotificationData, EmailRequestData, TicketEmailData, LineFlexMessage } from '@/types/api';
import { getTicketCategoryLabel } from '@/lib/helpers/ticket-helpers';

export interface LineWebhookData {
  type: 'new_ticket' | 'status_update' | 'it_team_urgent' | 'email_request';
  ticket?: LineNotificationData;
  emailRequest?: EmailRequestData;
  oldStatus?: string;
  flexMessage: LineFlexMessage;
}

class LineNotificationService {
  private readonly channelAccessToken: string;
  private readonly lineWebhookUrl: string;
  private readonly baseUrl: string;

  constructor() {
    this.channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
    this.lineWebhookUrl = process.env.LINE_WEBHOOK_URL || '';
    this.baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  }

  private getCategoryLabel(category: string): string {
    const categories: Record<string, string> = {
      'HARDWARE': 'ฮาร์ดแวร์',
      'SOFTWARE': 'ซอฟต์แวร์',
      'NETWORK': 'เครือข่าย',
      'ACCOUNT': 'บัญชีผู้ใช้',
      'EMAIL': 'อีเมล',
      'PRINTER': 'เครื่องพิมพ์',
      'OTHER': 'อื่นๆ'
    };
    return categories[category] || category;
  }

  private getPriorityLabel(priority: string): string {
    const priorities: Record<string, string> = {
      'LOW': 'ต่ำ',
      'MEDIUM': 'ปานกลาง',
      'HIGH': 'สูง',
      'URGENT': 'เร่งด่วน'
    };
    return priorities[priority] || priority;
  }

  private getStatusLabel(status: string): string {
    const statuses: Record<string, string> = {
      'OPEN': 'เปิด',
      'IN_PROGRESS': 'กำลังดำเนินการ',
      'RESOLVED': 'แก้ไขแล้ว',
      'CLOSED': 'ปิด',
      'CANCELLED': 'ยกเลิก'
    };
    return statuses[status] || status;
  }

  private getPriorityEmoji(priority: string): string {
    const emojis: Record<string, string> = {
      'LOW': '🟢',
      'MEDIUM': '🟡',
      'HIGH': '🟠',
      'URGENT': '🔴'
    };
    return emojis[priority] || '⚪';
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private generateFlexMessage(data: LineNotificationData, type: 'new_ticket' | 'status_update' | 'it_team'): LineFlexMessage {
    const priorityColor = this.getPriorityColor(data.priority);
    const categoryEmoji = data.category === 'URGENT' ? '🚨' : '🎫';
    
    let headerText = '';
    let headerColor = '';
    
    switch (type) {
      case 'new_ticket':
        headerText = 'Ticket ใหม่ถูกสร้าง';
        headerColor = '#3B82F6';
        break;
      case 'status_update':
        headerText = 'อัพเดทสถานะ Ticket';
        headerColor = '#10B981';
        break;
      case 'it_team':
        headerText = 'Ticket ความสำคัญสูง';
        headerColor = '#EF4444';
        break;
    }

    return {
      type: 'flex',
      altText: `${headerText} #${data.ticketId}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${categoryEmoji} ${headerText}`,
              weight: 'bold',
              color: '#FFFFFF',
              size: 'lg'
            },
            {
              type: 'text',
              text: `Ticket #${data.ticketId}`,
              color: '#FFFFFF',
              size: 'sm'
            }
          ],
          backgroundColor: headerColor,
          paddingAll: '20px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: data.title,
              weight: 'bold',
              size: 'lg',
              wrap: true
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'หมวดหมู่:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: getTicketCategoryLabel(data.category),
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'ความสำคัญ:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: `${this.getPriorityEmoji(data.priority)} ${this.getPriorityLabel(data.priority)}`,
                      wrap: true,
                      color: priorityColor,
                      size: 'sm',
                      weight: 'bold',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'สถานะ:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: this.getStatusLabel(data.status),
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'ผู้แจ้ง:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: `${data.reportedBy.name}${data.reportedBy.department ? ` (${data.reportedBy.department})` : ''}`,
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'วันที่:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: this.formatDate(data.createdAt),
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                }
              ]
            },
            ...(data.description ? [
              {
                type: 'separator' as const,
                margin: 'md' as const
              },
              {
                type: 'text' as const,
                text: data.description.length > 100 ? data.description.substring(0, 100) + '...' : data.description,
                wrap: true,
                color: '#666666',
                size: 'sm' as const,
                margin: 'md' as const
              }
            ] : [])
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: 'ดูในระบบ',
                uri: `${this.baseUrl}/dashboard/it-issues`
              },
              color: headerColor
            },
            {
              type: 'spacer',
              size: 'sm'
            }
          ]
        }
      }
    };
  }

  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'LOW': '#6B7280',
      'MEDIUM': '#3B82F6',
      'HIGH': '#F59E0B',
      'URGENT': '#EF4444'
    };
    return colors[priority] || '#6B7280';
  }

  async sendLineMessage(userId: string, message: LineFlexMessage): Promise<boolean> {
    if (!this.channelAccessToken) {
      return false;
    }

    try {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.channelAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userId,
          messages: [message]
        }),
      });

      if (response.ok) {
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ LINE Message ส่งไม่สำเร็จ:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดใน LINE Message:', error);
      return false;
    }
  }

  async sendLineBroadcast(message: LineFlexMessage): Promise<boolean> {
    if (!this.channelAccessToken) {
      return false;
    }

    try {
      const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.channelAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [message]
        }),
      });

      if (response.ok) {
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ LINE Broadcast ส่งไม่สำเร็จ:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดใน LINE Broadcast:', error);
      return false;
    }
  }

  async sendLineWebhook(data: LineWebhookData): Promise<boolean> {
    if (!this.lineWebhookUrl) {
      return false;
    }

    try {
      const response = await fetch(this.lineWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ LINE Webhook ส่งไม่สำเร็จ:', response.status, errorText);
        return false;
      }
    } catch (error) {
      console.error('❌ เกิดข้อผิดพลาดใน LINE Webhook:', error);
      return false;
    }
  }

  async sendNewTicketNotification(ticketData: TicketEmailData): Promise<boolean> {
    const lineData: LineNotificationData = {
      ...ticketData
    };

    const flexMessage = this.generateFlexMessage(lineData, 'new_ticket');

    const itTeamUserId = process.env.LINE_IT_TEAM_USER_ID;

    let messageResult = false;

    if (itTeamUserId) {
      messageResult = await this.sendLineMessage(itTeamUserId, flexMessage);
    } else {
      messageResult = await this.sendLineBroadcast(flexMessage);
    }

    const webhookData: LineWebhookData = {
      type: 'new_ticket' as const,
      ticket: lineData,
      flexMessage: flexMessage
    };
    const webhookResult = await this.sendLineWebhook(webhookData);

    const finalResult = messageResult || webhookResult;
    return finalResult;
  }

  async sendStatusUpdateNotification(ticketData: TicketEmailData, oldStatus: string): Promise<boolean> {
    const lineData: LineNotificationData = {
      ...ticketData
    };

    const flexMessage = this.generateFlexMessage(lineData, 'status_update');
    
    // Get IT team user ID from environment or use broadcast
    const itTeamUserId = process.env.LINE_IT_TEAM_USER_ID;
    
    let messageResult = false;
    
    if (itTeamUserId) {
      // Send to specific IT team user
      messageResult = await this.sendLineMessage(itTeamUserId, flexMessage);
    } else {
      // Send as broadcast to all followers
      messageResult = await this.sendLineBroadcast(flexMessage);
    }
    
    // Also send to webhook if configured
    const webhookData: LineWebhookData = {
      type: 'status_update' as const,
      ticket: lineData,
      oldStatus: oldStatus,
      flexMessage: flexMessage
    };
    const webhookResult = await this.sendLineWebhook(webhookData);

    return messageResult || webhookResult;
  }

  async sendITTeamNotification(ticketData: TicketEmailData): Promise<boolean> {
    const lineData: LineNotificationData = {
      ...ticketData
    };

    const flexMessage = this.generateFlexMessage(lineData, 'it_team');
    
    // Get IT team user ID from environment or use broadcast
    const itTeamUserId = process.env.LINE_IT_TEAM_USER_ID;
    
    let messageResult = false;
    
    if (itTeamUserId) {
      // Send to specific IT team user
      messageResult = await this.sendLineMessage(itTeamUserId, flexMessage);
    } else {
      // Send as broadcast to all followers
      messageResult = await this.sendLineBroadcast(flexMessage);
    }
    
    // Also send to webhook if configured
    const webhookData: LineWebhookData = {
      type: 'it_team_urgent' as const,
      ticket: lineData,
      flexMessage: flexMessage
    };
    const webhookResult = await this.sendLineWebhook(webhookData);

    return messageResult || webhookResult;
  }

  private generateEmailRequestFlexMessage(data: EmailRequestData): LineFlexMessage {
    return {
      type: 'flex',
      altText: `ขออีเมลพนักงานใหม่ - ${data.thaiName}`,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📧 ขออีเมลพนักงานใหม่',
              weight: 'bold',
              color: '#FFFFFF',
              size: 'lg'
            },
            {
              type: 'text',
              text: 'คำขออีเมลพนักงานใหม่จากระบบ',
              color: '#FFFFFF',
              size: 'sm'
            }
          ],
          backgroundColor: '#7C3AED',
          paddingAll: '20px'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${data.thaiName} (${data.englishName})`,
              weight: 'bold',
              size: 'lg',
              wrap: true
            },
            {
              type: 'separator',
              margin: 'md'
            },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'ชื่อเล่น:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: data.nickname,
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'เบอร์โทร:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: data.phone,
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'ตำแหน่ง:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: data.position,
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'สังกัด:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: data.department,
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'อีเมลตอบกลับ:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: data.replyEmail,
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text: 'วันที่ขอ:',
                      color: '#666666',
                      size: 'sm',
                      flex: 2
                    },
                    {
                      type: 'text',
                      text: this.formatDate(data.requestedAt),
                      wrap: true,
                      color: '#333333',
                      size: 'sm',
                      flex: 3
                    }
                  ]
                }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              style: 'primary',
              height: 'sm',
              action: {
                type: 'uri',
                label: 'ดูในระบบ',
                uri: `${this.baseUrl}/dashboard/email-request`
              },
              color: '#7C3AED'
            },
            {
              type: 'spacer',
              size: 'sm'
            }
          ]
        }
      }
    };
  }

  async sendEmailRequestNotification(emailRequestData: EmailRequestData): Promise<boolean> {
    const flexMessage = this.generateEmailRequestFlexMessage(emailRequestData);

    const itTeamUserId = process.env.LINE_IT_TEAM_USER_ID;

    let messageResult = false;

    if (itTeamUserId) {
      messageResult = await this.sendLineMessage(itTeamUserId, flexMessage);
    } else {
      messageResult = await this.sendLineBroadcast(flexMessage);
    }

    const webhookData: LineWebhookData = {
      type: 'email_request' as const,
      emailRequest: emailRequestData,
      flexMessage: flexMessage
    };
    const webhookResult = await this.sendLineWebhook(webhookData);

    const finalResult = messageResult || webhookResult;
    return finalResult;
  }
}

export const lineNotificationService = new LineNotificationService();