import { type TicketEmailData } from "@/types/api";
import {
    getTicketCategoryLabel,
    getTicketPriorityLabel,
    getTicketStatusLabel,
    getPriorityHexColor,
    getStatusHexColor,
} from "@/lib/helpers/ticket-helpers";
import { formatDateTime } from "@/lib/helpers/date-helpers";

export function generateNewTicketEmailHTML(data: TicketEmailData): string {
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
              
              <div class="ticket-info ${
                  data.priority === "URGENT" ? "urgent" : ""
              }">
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
                          <span class="badge" style="background-color: ${getPriorityHexColor(
                              data.priority
                          )}">
                              ${getTicketPriorityLabel(data.priority)}
                          </span>
                      </span>
                  </div>
                  <div class="info-row">
                      <span class="label">สถานะ:</span>
                      <span class="value">
                          <span class="badge" style="background-color: ${getStatusHexColor(
                              data.status
                          )}">
                              ${getTicketStatusLabel(data.status)}
                          </span>
                      </span>
                  </div>
                  <div class="info-row">
                      <span class="label">ผู้แจ้ง:</span>
                      <span class="value">${data.reportedBy.name}${
        data.reportedBy.department ? ` (${data.reportedBy.department})` : ""
    }</span>
                  </div>
                  <div class="info-row">
                      <span class="label">วันที่สร้าง:</span>
                      <span class="value">${formatDateTime(
                          data.createdAt
                      )}</span>
                  </div>
              </div>

              <div>
                  <h3 style="color: #374151; margin-bottom: 10px;">รายละเอียดปัญหา:</h3>
                  <div class="description-box">
                      ${data.description.replace(/\n/g, "<br>")}
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
