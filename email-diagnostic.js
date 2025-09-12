// Email Diagnostic Script
// Run with: node email-diagnostic.js

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

async function diagnoseEmailService() {
  console.log('🔍 Email Service Diagnostic Tool\n');

  // 1. Check Environment Variables
  console.log('📋 Environment Variables Check:');
  console.log('  ✓ SMTP_HOST:', process.env.SMTP_HOST || '❌ NOT SET');
  console.log('  ✓ SMTP_PORT:', process.env.SMTP_PORT || '❌ NOT SET');
  console.log('  ✓ SMTP_SECURE:', process.env.SMTP_SECURE || '❌ NOT SET');
  console.log('  ✓ SMTP_USER:', process.env.SMTP_USER ? '✅ CONFIGURED' : '❌ NOT SET');
  console.log('  ✓ SMTP_PASS:', process.env.SMTP_PASS ? '✅ CONFIGURED' : '❌ NOT SET');
  console.log('  ✓ IT_TEAM_EMAIL:', process.env.IT_TEAM_EMAIL || '❌ NOT SET');
  console.log('  ✓ NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ NOT SET');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log('\n❌ Missing SMTP credentials. Please check your .env.local file.');
    return;
  }

  // 2. Create and Test SMTP Connection
  console.log('\n🔗 SMTP Connection Test:');
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 5,
  });

  try {
    console.log('  Testing SMTP connection...');
    await transporter.verify();
    console.log('  ✅ SMTP connection successful!');
  } catch (error) {
    console.log('  ❌ SMTP connection failed:', error.message);
    console.log('\n🔧 Troubleshooting Tips:');
    
    if (error.message.includes('Invalid login')) {
      console.log('  - Check your email and password/app password');
      console.log('  - For Gmail: Use App Password, not regular password');
      console.log('  - Enable 2FA and generate App Password at: https://myaccount.google.com/apppasswords');
    }
    
    if (error.message.includes('ENOTFOUND')) {
      console.log('  - Check your SMTP_HOST setting');
      console.log('  - Common hosts: smtp.gmail.com, smtp.outlook.com');
    }
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('  - Check your SMTP_PORT setting');
      console.log('  - Gmail: 587 (TLS) or 465 (SSL)');
      console.log('  - Outlook: 587 (TLS)');
    }
    
    return;
  }

  // 3. Test Email Sending (Optional)
  console.log('\n📧 Test Email Sending:');
  console.log('  Would you like to send a test email? (Update the testEmail below)');
  
  // Uncomment and update this section to send a test email
  /*
  const testEmail = 'your-test-email@example.com'; // UPDATE THIS
  
  try {
    const info = await transporter.sendMail({
      from: `"NHF IT Support Test" <${process.env.SMTP_USER}>`,
      to: testEmail,
      subject: 'Test Email from NHF IT System',
      text: 'This is a test email to verify SMTP configuration.',
      html: '<h2>Test Email</h2><p>This is a test email to verify SMTP configuration.</p>'
    });
    
    console.log('  ✅ Test email sent successfully!');
    console.log('  Message ID:', info.messageId);
    console.log('  Response:', info.response);
  } catch (error) {
    console.log('  ❌ Test email failed:', error.message);
  }
  */

  // 4. Connection Pool Status
  console.log('\n📊 Connection Pool Status:');
  console.log('  Pool enabled: Yes');
  console.log('  Max connections: 5');
  console.log('  Rate limit: 5 emails per second');

  console.log('\n✅ Diagnostic completed!');
  
  // Close the transporter
  transporter.close();
}

// Run the diagnostic
diagnoseEmailService().catch(console.error);