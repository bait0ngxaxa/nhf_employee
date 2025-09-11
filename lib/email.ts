import nodemailer from 'nodemailer';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface TicketEmailData {
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
  assignedTo?: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
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

  private getPriorityColor(priority: string): string {
    const colors: Record<string, string> = {
      'LOW': '#6B7280',
      'MEDIUM': '#3B82F6',
      'HIGH': '#F59E0B',
      'URGENT': '#EF4444'
    };
    return colors[priority] || '#6B7280';
  }

  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'OPEN': '#3B82F6',
      'IN_PROGRESS': '#F59E0B',
      'RESOLVED': '#10B981',
      'CLOSED': '#6B7280',
      'CANCELLED': '#EF4444'
    };
    return colors[status] || '#6B7280';
  }

  private formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  generateNewTicketEmailHTML(data: TicketEmailData): string {
    return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Ticket ใหม่ - ${data.title}</title>
        <style>
            body { 
                font-family: 'Sarabun', Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background-color: #f8fafc;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%); 
                color: white; 
                padding: 30px 20px; 
                text-align: center; 
            }
            .header h1 { 
                margin: 0; 
                font-size: 24px; 
                font-weight: 600;
            }
            .content { 
                padding: 30px 20px; 
            }
            .ticket-info { 
                background: #f8fafc; 
                border-radius: 8px; 
                padding: 20px; 
                margin: 20px 0; 
                border-left: 4px solid #3B82F6;
            }
            .info-row { 
                display: flex; 
                justify-content: space-between; 
                margin: 10px 0; 
                align-items: center;
            }
            .label { 
                font-weight: 600; 
                color: #4B5563; 
                flex: 1;
            }
            .value { 
                flex: 2; 
                text-align: right;
            }
            .badge { 
                padding: 4px 12px; 
                border-radius: 20px; 
                font-size: 12px; 
                font-weight: 600; 
                color: white; 
                display: inline-block;
            }
            .description-box { 
                background: #f9fafb; 
                border: 1px solid #e5e7eb; 
                border-radius: 8px; 
                padding: 15px; 
                margin: 15px 0;
            }
            .footer { 
                background: #f8fafc; 
                padding: 20px; 
                text-align: center; 
                color: #6B7280; 
                font-size: 14px;
                border-top: 1px solid #e5e7eb;
            }
            .button { 
                display: inline-block; 
                padding: 12px 24px; 
                background: #3B82F6; 
                color: white; 
                text-decoration: none; 
                border-radius: 6px; 
                font-weight: 600; 
                margin: 20px 0;
            }
            .urgent { 
                border-left-color: #EF4444 !important; 
                background: #fef2f2;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎫 Ticket ใหม่ถูกสร้าง</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">ระบบแจ้งปัญหาไอที - NHF</p>
            </div>
            
            <div class="content">
                <h2 style="color: #1F2937; margin-top: 0;">${data.title}</h2>
                
                <div class="ticket-info ${data.priority === 'URGENT' ? 'urgent' : ''}">
                    <div class="info-row">
                        <span class="label">หมายเลข Ticket:</span>
                        <span class="value"><strong>#${data.ticketId}</strong></span>
                    </div>
                    <div class="info-row">
                        <span class="label">หมวดหมู่:</span>
                        <span class="value">${this.getCategoryLabel(data.category)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">ความสำคัญ:</span>
                        <span class="value">
                            <span class="badge" style="background-color: ${this.getPriorityColor(data.priority)}">
                                ${this.getPriorityLabel(data.priority)}
                            </span>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="label">สถานะ:</span>
                        <span class="value">
                            <span class="badge" style="background-color: ${this.getStatusColor(data.status)}">
                                ${this.getStatusLabel(data.status)}
                            </span>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="label">ผู้แจ้ง:</span>
                        <span class="value">${data.reportedBy.name}${data.reportedBy.department ? ` (${data.reportedBy.department})` : ''}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">วันที่สร้าง:</span>
                        <span class="value">${this.formatDate(data.createdAt)}</span>
                    </div>
                </div>

                <div>
                    <h3 style="color: #374151; margin-bottom: 10px;">รายละเอียดปัญหา:</h3>
                    <div class="description-box">
                        ${data.description.replace(/\n/g, '<br>')}
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.NEXTAUTH_URL}/dashboard/it-issues" class="button">
                        ดู Ticket ในระบบ
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p>อีเมลนี้ถูกส่งอัตโนมัติจากระบบแจ้งปัญหาไอที<br>
                National Health Foundation (NHF)</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  generateStatusUpdateEmailHTML(data: TicketEmailData, oldStatus: string): string {
    return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>อัพเดทสถานะ Ticket - ${data.title}</title>
        <style>
            body { 
                font-family: 'Sarabun', Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0; 
                background-color: #f8fafc;
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header { 
                background: linear-gradient(135deg, #10B981 0%, #059669 100%); 
                color: white; 
                padding: 30px 20px; 
                text-align: center; 
            }
            .header h1 { 
                margin: 0; 
                font-size: 24px; 
                font-weight: 600;
            }
            .content { 
                padding: 30px 20px; 
            }
            .status-update { 
                background: #f0fdf4; 
                border: 2px solid #10B981; 
                border-radius: 8px; 
                padding: 20px; 
                margin: 20px 0; 
                text-align: center;
            }
            .status-change { 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                gap: 15px; 
                margin: 15px 0;
            }
            .status-badge { 
                padding: 8px 16px; 
                border-radius: 20px; 
                font-size: 14px; 
                font-weight: 600; 
                color: white;
            }
            .arrow { 
                font-size: 20px; 
                color: #10B981;
            }
            .ticket-info { 
                background: #f8fafc; 
                border-radius: 8px; 
                padding: 20px; 
                margin: 20px 0; 
                border-left: 4px solid #10B981;
            }
            .info-row { 
                display: flex; 
                justify-content: space-between; 
                margin: 10px 0; 
                align-items: center;
            }
            .label { 
                font-weight: 600; 
                color: #4B5563; 
                flex: 1;
            }
            .value { 
                flex: 2; 
                text-align: right;
            }
            .footer { 
                background: #f8fafc; 
                padding: 20px; 
                text-align: center; 
                color: #6B7280; 
                font-size: 14px;
                border-top: 1px solid #e5e7eb;
            }
            .button { 
                display: inline-block; 
                padding: 12px 24px; 
                background: #10B981; 
                color: white; 
                text-decoration: none; 
                border-radius: 6px; 
                font-weight: 600; 
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔄 สถานะ Ticket อัพเดท</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">ระบบแจ้งปัญหาไอที - NHF</p>
            </div>
            
            <div class="content">
                <h2 style="color: #1F2937; margin-top: 0;">${data.title}</h2>
                
                <div class="status-update">
                    <h3 style="margin-top: 0; color: #065F46;">สถานะได้รับการอัพเดท</h3>
                    <div class="status-change">
                        <span class="status-badge" style="background-color: ${this.getStatusColor(oldStatus)}">
                            ${this.getStatusLabel(oldStatus)}
                        </span>
                        <span class="arrow">→</span>
                        <span class="status-badge" style="background-color: ${this.getStatusColor(data.status)}">
                            ${this.getStatusLabel(data.status)}
                        </span>
                    </div>
                </div>
                
                <div class="ticket-info">
                    <div class="info-row">
                        <span class="label">หมายเลข Ticket:</span>
                        <span class="value"><strong>#${data.ticketId}</strong></span>
                    </div>
                    <div class="info-row">
                        <span class="label">หมวดหมู่:</span>
                        <span class="value">${this.getCategoryLabel(data.category)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">ความสำคัญ:</span>
                        <span class="value">
                            <span class="status-badge" style="background-color: ${this.getPriorityColor(data.priority)}; padding: 4px 12px; font-size: 12px;">
                                ${this.getPriorityLabel(data.priority)}
                            </span>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="label">ผู้แจ้ง:</span>
                        <span class="value">${data.reportedBy.name}${data.reportedBy.department ? ` (${data.reportedBy.department})` : ''}</span>
                    </div>
                    ${data.assignedTo ? `
                    <div class="info-row">
                        <span class="label">ผู้รับผิดชอบ:</span>
                        <span class="value">${data.assignedTo.name}</span>
                    </div>
                    ` : ''}
                    <div class="info-row">
                        <span class="label">อัพเดทล่าสุด:</span>
                        <span class="value">${this.formatDate(data.updatedAt || data.createdAt)}</span>
                    </div>
                </div>

                <div style="text-align: center; margin-top: 30px;">
                    <a href="${process.env.NEXTAUTH_URL}/dashboard/it-issues" class="button">
                        ดู Ticket ในระบบ
                    </a>
                </div>
            </div>
            
            <div class="footer">
                <p>อีเมลนี้ถูกส่งอัตโนมัติจากระบบแจ้งปัญหาไอที<br>
                National Health Foundation (NHF)</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    try {
      console.log('🔍 Email Service Debug:');
      console.log('  - SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET');
      console.log('  - SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET');
      console.log('  - SMTP_USER:', process.env.SMTP_USER ? 'CONFIGURED' : 'NOT SET');
      console.log('  - SMTP_PASS:', process.env.SMTP_PASS ? 'CONFIGURED' : 'NOT SET');
      console.log('  - IT_TEAM_EMAIL:', process.env.IT_TEAM_EMAIL || 'NOT SET');
      console.log('  - Target email:', emailData.to);
      
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.warn('❌ SMTP credentials not configured. Email not sent.');
        return false;
      }

      const info = await this.transporter.sendMail({
        from: `"NHF IT Support" <${process.env.SMTP_USER}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text,
      });

      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Failed to send email:', error);
      return false;
    }
  }

  async sendNewTicketNotification(ticketData: TicketEmailData): Promise<boolean> {
    const emailData: EmailData = {
      to: ticketData.reportedBy.email,
      subject: `[NHF IT] Ticket #${ticketData.ticketId} ถูกสร้างแล้ว - ${ticketData.title}`,
      html: this.generateNewTicketEmailHTML(ticketData),
      text: `Ticket #${ticketData.ticketId} ถูกสร้างแล้ว\n\nหัวข้อ: ${ticketData.title}\nคำอธิบาย: ${ticketData.description}\nสถานะ: ${this.getStatusLabel(ticketData.status)}\nความสำคัญ: ${this.getPriorityLabel(ticketData.priority)}\n\nดู Ticket ได้ที่: ${process.env.NEXTAUTH_URL}/dashboard/it-issues`
    };

    return await this.sendEmail(emailData);
  }

  async sendStatusUpdateNotification(ticketData: TicketEmailData, oldStatus: string): Promise<boolean> {
    const emailData: EmailData = {
      to: ticketData.reportedBy.email,
      subject: `[NHF IT] อัพเดทสถานะ Ticket #${ticketData.ticketId} - ${this.getStatusLabel(ticketData.status)}`,
      html: this.generateStatusUpdateEmailHTML(ticketData, oldStatus),
      text: `สถานะ Ticket #${ticketData.ticketId} ได้รับการอัพเดท\n\nหัวข้อ: ${ticketData.title}\nสถานะเดิม: ${this.getStatusLabel(oldStatus)}\nสถานะใหม่: ${this.getStatusLabel(ticketData.status)}\n\nดู Ticket ได้ที่: ${process.env.NEXTAUTH_URL}/dashboard/it-issues`
    };

    return await this.sendEmail(emailData);
  }

  // Send notification to IT team for new high/urgent priority tickets
  async sendITTeamNotification(ticketData: TicketEmailData): Promise<boolean> {
    const itTeamEmail = process.env.IT_TEAM_EMAIL;
    if (!itTeamEmail) {
      console.warn('IT team email not configured');
      return false;
    }

    const emailData: EmailData = {
      to: itTeamEmail,
      subject: `[NHF IT] Ticket ${ticketData.priority === 'URGENT' ? 'เร่งด่วน' : 'ความสำคัญสูง'} #${ticketData.ticketId} - ${ticketData.title}`,
      html: this.generateNewTicketEmailHTML(ticketData),
      text: `Ticket ใหม่ที่ต้องให้ความสำคัญ\n\nTicket #${ticketData.ticketId}\nหัวข้อ: ${ticketData.title}\nผู้แจ้ง: ${ticketData.reportedBy.name}\nความสำคัญ: ${this.getPriorityLabel(ticketData.priority)}\n\nดู Ticket ได้ที่: ${process.env.NEXTAUTH_URL}/dashboard/it-issues`
    };

    return await this.sendEmail(emailData);
  }
}

export const emailService = new EmailService();