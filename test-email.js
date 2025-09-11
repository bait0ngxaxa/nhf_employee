// Test script for email service
// Run with: node test-email.js

const { emailService } = require('./lib/email.ts');

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');

  // Test data
  const testTicketData = {
    ticketId: 123,
    title: 'ทดสอบระบบอีเมล - เครื่องคอมพิวเตอร์เปิดไม่ติด',
    description: 'เครื่องคอมพิวเตอร์ในห้องทำงานเปิดไม่ติด มีไฟแสดงสถานะสีแดงกระพริบ',
    category: 'HARDWARE',
    priority: 'HIGH',
    status: 'OPEN',
    reportedBy: {
      name: 'ทดสอบ ระบบอีเมล',
      email: 'test@example.com',
      department: 'แผนกไอที'
    },
    createdAt: new Date().toISOString()
  };

  try {
    // Test HTML template generation
    console.log('✅ Testing New Ticket Email Template Generation...');
    const newTicketHTML = emailService.generateNewTicketEmailHTML(testTicketData);
    console.log(`   - Template generated: ${newTicketHTML.length} characters`);

    console.log('✅ Testing Status Update Email Template Generation...');
    const statusUpdateHTML = emailService.generateStatusUpdateEmailHTML(testTicketData, 'OPEN');
    console.log(`   - Template generated: ${statusUpdateHTML.length} characters`);

    // Test email configuration (without actually sending)
    console.log('✅ Testing Email Configuration...');
    console.log(`   - SMTP Host: ${process.env.SMTP_HOST || 'Not configured'}`);
    console.log(`   - SMTP Port: ${process.env.SMTP_PORT || 'Not configured'}`);
    console.log(`   - SMTP User: ${process.env.SMTP_USER ? '***configured***' : 'Not configured'}`);
    console.log(`   - IT Team Email: ${process.env.IT_TEAM_EMAIL || 'Not configured'}`);

    console.log('\n✅ Email Service Test Completed Successfully!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Configure your SMTP settings in .env.local');
    console.log('   2. Create a test ticket to verify email delivery');
    console.log('   3. Check spam/junk folders if emails are not received');

  } catch (error) {
    console.error('❌ Email Service Test Failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Check that nodemailer is installed');
    console.log('   2. Verify email service imports');
    console.log('   3. Check environment variable configuration');
  }
}

// Run the test
testEmailService();