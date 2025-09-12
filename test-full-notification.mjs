// Comprehensive test for both Email and LINE notifications
// Run with: node test-full-notification.mjs

import { emailService } from './lib/email.js';
import { lineNotificationService } from './lib/line.js';

async function testFullNotificationSystem() {
  console.log('🚀 NHF Notification System Test\n');

  // Test data ที่จำลองการสร้าง ticket
  const testTicketData = {
    ticketId: 999,
    title: 'ทดสอบระบบแจ้งเตือน - Email + LINE',
    description: 'นี่คือการทดสอบระบบแจ้งเตือนแบบครบวงจร\n\nระบบจะส่งทั้ง Email และ LINE notification\n\nหากคุณได้รับข้อความนี้ทั้งในอีเมลและ LINE แสดงว่าระบบทำงานได้ปกติ!',
    category: 'OTHER',
    priority: 'HIGH', // ใช้ HIGH เพื่อทดสอบ IT team notification ด้วย
    status: 'OPEN',
    reportedBy: {
      name: 'ระบบทดสอบ Notification',
      email: 'baitongxaxaxa1@gmail.com', // เปลี่ยนเป็นอีเมลของคุณ
      department: 'แผนกไอที'
    },
    createdAt: new Date().toISOString()
  };

  console.log('📋 Test Data:');
  console.log(`   - Ticket #${testTicketData.ticketId}`);
  console.log(`   - Title: ${testTicketData.title}`);
  console.log(`   - Priority: ${testTicketData.priority}`);
  console.log(`   - Reporter: ${testTicketData.reportedBy.name}`);
  console.log('');

  // 1. ทดสอบ New Ticket Notification
  console.log('🎫 Testing New Ticket Notification...');
  try {
    // ส่ง Email
    console.log('  📧 Sending email notification...');
    const emailResult = await emailService.sendNewTicketNotification(testTicketData);
    console.log(`     Email: ${emailResult ? '✅ SUCCESS' : '❌ FAILED'}`);

    // ส่ง LINE
    console.log('  📱 Sending LINE notification...');
    const lineResult = await lineNotificationService.sendNewTicketNotification(testTicketData);
    console.log(`     LINE: ${lineResult ? '✅ SUCCESS' : '❌ FAILED'}`);

    console.log(`  📊 New Ticket Result: ${emailResult || lineResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  } catch (error) {
    console.log('  ❌ New Ticket Test Failed:', error.message);
  }

  console.log('');

  // 2. ทดสอบ Status Update Notification
  console.log('🔄 Testing Status Update Notification...');
  try {
    const updatedTicketData = {
      ...testTicketData,
      status: 'IN_PROGRESS',
      updatedAt: new Date().toISOString(),
      assignedTo: {
        name: 'ทีมไอที NHF',
        email: 'it-team@nhf.org'
      }
    };

    // ส่ง Email
    console.log('  📧 Sending status update email...');
    const emailResult = await emailService.sendStatusUpdateNotification(updatedTicketData, 'OPEN');
    console.log(`     Email: ${emailResult ? '✅ SUCCESS' : '❌ FAILED'}`);

    // ส่ง LINE
    console.log('  📱 Sending status update LINE...');
    const lineResult = await lineNotificationService.sendStatusUpdateNotification(updatedTicketData, 'OPEN');
    console.log(`     LINE: ${lineResult ? '✅ SUCCESS' : '❌ FAILED'}`);

    console.log(`  📊 Status Update Result: ${emailResult || lineResult ? '✅ SUCCESS' : '❌ FAILED'}`);
  } catch (error) {
    console.log('  ❌ Status Update Test Failed:', error.message);
  }

  console.log('');

  // 3. ทดสอบ IT Team Notification (เฉพาะ HIGH/URGENT priority)
  if (testTicketData.priority === 'HIGH' || testTicketData.priority === 'URGENT') {
    console.log('⚡ Testing IT Team Notification (High Priority)...');
    try {
      // ส่ง Email
      console.log('  📧 Sending IT team email...');
      const emailResult = await emailService.sendITTeamNotification(testTicketData);
      console.log(`     Email: ${emailResult ? '✅ SUCCESS' : '❌ FAILED'}`);

      // ส่ง LINE
      console.log('  📱 Sending IT team LINE...');
      const lineResult = await lineNotificationService.sendITTeamNotification(testTicketData);
      console.log(`     LINE: ${lineResult ? '✅ SUCCESS' : '❌ FAILED'}`);

      console.log(`  📊 IT Team Result: ${emailResult || lineResult ? '✅ SUCCESS' : '❌ FAILED'}`);
    } catch (error) {
      console.log('  ❌ IT Team Test Failed:', error.message);
    }
  }

  console.log('');
  console.log('🎉 Notification System Test Complete!');
  console.log('');
  console.log('📱 Check your notifications:');
  console.log('   1. Check your email inbox (including spam folder)');
  console.log('   2. Check your LINE messages');
  console.log('   3. Verify all notification types were received');
  console.log('');
  console.log('🔧 If notifications failed:');
  console.log('   - Run: node test-line-notification.js (for LINE setup)');
  console.log('   - Run: npm run email:diagnostic (for email setup)');
}

// Run the test
testFullNotificationSystem().catch(console.error);