import nodemailer from 'nodemailer';
import { TicketEmailData } from '@/types/api';
import { getTicketCategoryLabel, getTicketPriorityLabel, getTicketStatusLabel, getPriorityHexColor, getStatusHexColor } from '@/lib/helpers/ticket-helpers';
import { formatDateTime } from '@/lib/helpers/date-helpers';

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter!: nodemailer.Transporter;
  private isTransporterReady: boolean = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
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
      pool: true, // Enable connection pooling
      maxConnections: 5, // Max concurrent connections
      maxMessages: 100, // Max messages per connection
      rateDelta: 1000, // Rate limiting: 1 second
      rateLimit: 5, // Max 5 messages per rateDelta
    });
  }

  private async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.isTransporterReady = true;
      return true;
    } catch (error) {
      console.error('❌ SMTP connection verification failed:', error);
      this.isTransporterReady = false;

      this.initializeTransporter();

      try {
        await this.transporter.verify();
        this.isTransporterReady = true;
        return true;
      } catch (retryError) {
        console.error('❌ SMTP connection failed after retry:', retryError);
        return false;
      }
    }
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
                        <span class="value">${getTicketCategoryLabel(data.category)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">ความสำคัญ:</span>
                        <span class="value">
                            <span class="badge" style="background-color: ${getPriorityHexColor(data.priority)}">
                                ${getTicketPriorityLabel(data.priority)}
                            </span>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="label">สถานะ:</span>
                        <span class="value">
                            <span class="badge" style="background-color: ${getStatusHexColor(data.status)}">
                                ${getTicketStatusLabel(data.status)}
                            </span>
                        </span>
                    </div>
                    <div class="info-row">
                        <span class="label">ผู้แจ้ง:</span>
                        <span class="value">${data.reportedBy.name}${data.reportedBy.department ? ` (${data.reportedBy.department})` : ''}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">วันที่สร้าง:</span>
                        <span class="value">${formatDateTime(data.createdAt)}</span>
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
                        <span class="status-badge" style="background-color: ${getStatusHexColor(oldStatus)}">
                            ${getTicketStatusLabel(oldStatus)}
                        </span>
                        <span class="arrow">→</span>
                        <span class="status-badge" style="background-color: ${getStatusHexColor(data.status)}">
                            ${getTicketStatusLabel(data.status)}
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
                        <span class="value">${getTicketCategoryLabel(data.category)}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">ความสำคัญ:</span>
                        <span class="value">
                            <span class="status-badge" style="background-color: ${getPriorityHexColor(data.priority)}; padding: 4px 12px; font-size: 12px;">
                                ${getTicketPriorityLabel(data.priority)}
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
                        <span class="value">${formatDateTime(data.updatedAt || data.createdAt)}</span>
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
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return false;
      }

      if (!this.isTransporterReady) {
        const connectionOk = await this.verifyConnection();
        if (!connectionOk) {
          console.error('❌ Cannot establish SMTP connection. Email not sent.');
          return false;
        }
      }

      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          attempt++;

          await this.transporter.sendMail({
            from: `"NHF IT Support" <${process.env.SMTP_USER}>`,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
          });

          return true;

        } catch (sendError: unknown) {
          const errorMessage = sendError instanceof Error ? sendError.message : 'Unknown error';
          const errorCode = sendError instanceof Error && 'code' in sendError ? (sendError as Error & { code: string }).code : undefined;
          console.error(`❌ Email send attempt ${attempt} failed:`, errorMessage);

          if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEDOUT' || errorCode === 'ENOTFOUND') {
            this.isTransporterReady = false;
            const reconnected = await this.verifyConnection();
            if (!reconnected && attempt === maxRetries) {
              console.error('❌ Failed to reconnect after all attempts');
              return false;
            }
          } else if (attempt === maxRetries) {
            console.error('❌ Failed to send email after all attempts:', sendError);
            return false;
          }

          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Unexpected error in sendEmail:', error);
      return false;
    }
  }

  async sendNewTicketNotification(ticketData: TicketEmailData): Promise<boolean> {
    const emailData: EmailData = {
      to: ticketData.reportedBy.email,
      subject: `[NHF IT] Ticket #${ticketData.ticketId} ถูกสร้างแล้ว - ${ticketData.title}`,
      html: this.generateNewTicketEmailHTML(ticketData),
      text: `Ticket #${ticketData.ticketId} ถูกสร้างแล้ว\n\nหัวข้อ: ${ticketData.title}\nคำอธิบาย: ${ticketData.description}\nสถานะ: ${getTicketStatusLabel(ticketData.status)}\nความสำคัญ: ${getTicketPriorityLabel(ticketData.priority)}\n\nดู Ticket ได้ที่: ${process.env.NEXTAUTH_URL}/dashboard/it-issues`
    };

    return await this.sendEmail(emailData);
  }

  async sendStatusUpdateNotification(ticketData: TicketEmailData, oldStatus: string): Promise<boolean> {
    const emailData: EmailData = {
      to: ticketData.reportedBy.email,
      subject: `[NHF IT] อัพเดทสถานะ Ticket #${ticketData.ticketId} - ${getTicketStatusLabel(ticketData.status)}`,
      html: this.generateStatusUpdateEmailHTML(ticketData, oldStatus),
      text: `สถานะ Ticket #${ticketData.ticketId} ได้รับการอัพเดท\n\nหัวข้อ: ${ticketData.title}\nสถานะเดิม: ${getTicketStatusLabel(oldStatus)}\nสถานะใหม่: ${getTicketStatusLabel(ticketData.status)}\n\nดู Ticket ได้ที่: ${process.env.NEXTAUTH_URL}/dashboard/it-issues`
    };

    return await this.sendEmail(emailData);
  }

  // Send notification to IT team for new high/urgent priority tickets
  async sendITTeamNotification(ticketData: TicketEmailData): Promise<boolean> {
    const itTeamEmail = process.env.IT_TEAM_EMAIL;
    if (!itTeamEmail) {
      return false;
    }

    const emailData: EmailData = {
      to: itTeamEmail,
      subject: `[NHF IT] Ticket ${ticketData.priority === 'URGENT' ? 'เร่งด่วน' : 'ความสำคัญสูง'} #${ticketData.ticketId} - ${ticketData.title}`,
      html: this.generateNewTicketEmailHTML(ticketData),
      text: `Ticket ใหม่ที่ต้องให้ความสำคัญ\n\nTicket #${ticketData.ticketId}\nหัวข้อ: ${ticketData.title}\nผู้แจ้ง: ${ticketData.reportedBy.name}\nความสำคัญ: ${getTicketPriorityLabel(ticketData.priority)}\n\nดู Ticket ได้ที่: ${process.env.NEXTAUTH_URL}/dashboard/it-issues`
    };

    return await this.sendEmail(emailData);
  }
}

export const emailService = new EmailService();