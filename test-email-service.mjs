// Test the actual email service from your app
// Run with: npm run test:email-service

import { emailService } from './lib/email.js';

async function testEmailService() {
  console.log('🧪 Testing NHF Email Service...\n');

  // Test data matching your TicketEmailData interface
  const testTicketData = {
    ticketId: 999,
    title: 'ทดสอบระบบอีเมล - Email Service Test',
    description: 'นี่คือการทดสอบระบบส่งอีเมลของระบบ NHF IT Support\n\nหากคุณได้รับอีเมลนี้แสดงว่าระบบทำงานได้ปกติ',
    category: 'OTHER',
    priority: 'MEDIUM',
    status: 'OPEN',
    reportedBy: {
      name: 'ระบบทดสอบ Email',
      email: 'your-test-email@example.com', // ⚠️ UPDATE THIS TO YOUR EMAIL
      department: 'แผนกไอที'
    },
    createdAt: new Date().toISOString()
  };

  try {
    console.log('📧 Testing New Ticket Email...');
    const result1 = await emailService.sendNewTicketNotification(testTicketData);
    console.log(`   Result: ${result1 ? '✅ SUCCESS' : '❌ FAILED'}`);

    console.log('📧 Testing Status Update Email...');
    const result2 = await emailService.sendStatusUpdateNotification({
      ...testTicketData,
      status: 'IN_PROGRESS',
      updatedAt: new Date().toISOString()
    }, 'OPEN');
    console.log(`   Result: ${result2 ? '✅ SUCCESS' : '❌ FAILED'}`);

    if (testTicketData.priority === 'HIGH' || testTicketData.priority === 'URGENT') {
      console.log('📧 Testing IT Team Notification...');
      const result3 = await emailService.sendITTeamNotification(testTicketData);
      console.log(`   Result: ${result3 ? '✅ SUCCESS' : '❌ FAILED'}`);
    }

    console.log('\n✅ Email Service Test Completed!');
    
    if (result1 || result2) {
      console.log('\n📬 Check your email inbox (including spam/junk folder)');
      console.log('📱 If using Gmail, check that you are using an App Password');
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Verify your .env.local file has correct SMTP settings');
    console.log('2. For Gmail: Use App Password, not regular password');
    console.log('3. Check that nodemailer is installed: npm install nodemailer');
    console.log('4. Run the diagnostic: node email-diagnostic.js');
  }
}

// Export for use in other tests
export { testEmailService };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEmailService();
}