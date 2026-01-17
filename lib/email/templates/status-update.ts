import { type TicketEmailData } from "@/types/api";
import {
    getTicketCategoryLabel,
    getTicketPriorityLabel,
    getTicketStatusLabel,
    getPriorityHexColor,
    getStatusHexColor,
} from "@/lib/helpers/ticket-helpers";
import { formatDateTime } from "@/lib/helpers/date-helpers";

export function generateStatusUpdateEmailHTML(
    data: TicketEmailData,
    oldStatus: string
): string {
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
                      <span class="status-badge" style="background-color: ${getStatusHexColor(
                          oldStatus
                      )}">
                          ${getTicketStatusLabel(oldStatus)}
                      </span>
                      <span class="arrow">→</span>
                      <span class="status-badge" style="background-color: ${getStatusHexColor(
                          data.status
                      )}">
                          ${getTicketStatusLabel(data.status)}
                      </span>
                  </div>
              </div>
              
              <div class="ticket-info">
                  <div class="info-row">
                      <span class="label">หมายเลข Ticket:</span>
                      <span class="value"><strong>#${
                          data.ticketId
                      }</strong></span>
                  </div>
                  <div class="info-row">
                      <span class="label">หมวดหมู่:</span>
                      <span class="value">${getTicketCategoryLabel(
                          data.category
                      )}</span>
                  </div>
                  <div class="info-row">
                      <span class="label">ความสำคัญ:</span>
                      <span class="value">
                          <span class="status-badge" style="background-color: ${getPriorityHexColor(
                              data.priority
                          )}; padding: 4px 12px; font-size: 12px;">
                              ${getTicketPriorityLabel(data.priority)}
                          </span>
                      </span>
                  </div>
                  <div class="info-row">
                      <span class="label">ผู้แจ้ง:</span>
                      <span class="value">${data.reportedBy.name}${
        data.reportedBy.department ? ` (${data.reportedBy.department})` : ""
    }</span>
                  </div>
                  ${
                      data.assignedTo
                          ? `
                  <div class="info-row">
                      <span class="label">ผู้รับผิดชอบ:</span>
                      <span class="value">${data.assignedTo.name}</span>
                  </div>
                  `
                          : ""
                  }
                  <div class="info-row">
                      <span class="label">อัพเดทล่าสุด:</span>
                      <span class="value">${formatDateTime(
                          data.updatedAt || data.createdAt
                      )}</span>
                  </div>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                  <a href="${
                      process.env.NEXTAUTH_URL
                  }/dashboard/it-issues" class="button">
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
