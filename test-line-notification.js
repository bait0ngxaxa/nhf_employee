// Test script สำหรับ LINE Messaging API
// Run with: node test-line-notification.js

require('dotenv').config({ path: '.env.local' });

async function testLineMessagingAPI() {
  console.log('📱 LINE Messaging API Test\n');

  // 1. ตรวจสอบ Environment Variables
  console.log('📋 Environment Variables Check:');
  console.log('  ✓ LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ CONFIGURED' : '❌ NOT SET');
  console.log('  ✓ LINE_IT_TEAM_USER_ID:', process.env.LINE_IT_TEAM_USER_ID ? '✅ CONFIGURED' : '❌ NOT SET');
  console.log('  ✓ LINE_WEBHOOK_URL:', process.env.LINE_WEBHOOK_URL ? '✅ CONFIGURED' : '❌ NOT SET');
  console.log('  ✓ NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ NOT SET');

  // 2. ทดสอบ LINE Messaging API Push Message
  if (process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_ACCESS_TOKEN !== 'your-channel-access-token-here') {
    console.log('\n🧪 Testing LINE Messaging API...');
    
    const testUserId = process.env.LINE_IT_TEAM_USER_ID;
    
    if (!testUserId || testUserId === 'your-it-team-user-id-here') {
      console.log('  ⚠️ LINE_IT_TEAM_USER_ID ไม่ได้ตั้งค่า - ทดสอบ Broadcast แทน');
      
      // Test Broadcast Message
      try {
        const testMessage = {
          type: 'text',
          text: '🧪 ทดสอบ LINE Messaging API\n\n📋 นี่คือข้อความทดสอบจากระบบ NHF IT Support\n⏰ เวลา: ' + new Date().toLocaleString('th-TH') + '\n\n✅ หากคุณได้รับข้อความนี้แสดงว่า LINE Messaging API ทำงานได้ปกติ!\n\n--------------------\nNHF IT Support System'
        };

        const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [testMessage]
          }),
        });

        if (response.ok) {
          console.log('  ✅ LINE Broadcast test สำเร็จ! ตรวจสอบข้อความใน LINE OA');
        } else {
          const errorText = await response.text();
          console.log('  ❌ LINE Broadcast test ล้มเหลว:', response.status, errorText);
          
          if (response.status === 401) {
            console.log('  💡 Channel Access Token ไม่ถูกต้อง - ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN');
          }
        }
      } catch (error) {
        console.log('  ❌ เกิดข้อผิดพลาด:', error.message);
      }
    } else {
      // Test Push Message to specific user
      try {
        const testMessage = {
          type: 'text',
          text: '🧪 ทดสอบ LINE Messaging API\n\n📋 นี่คือข้อความทดสอบจากระบบ NHF IT Support\n⏰ เวลา: ' + new Date().toLocaleString('th-TH') + '\n\n✅ หากคุณได้รับข้อความนี้แสดงว่า LINE Messaging API ทำงานได้ปกติ!\n\n--------------------\nNHF IT Support System'
        };

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: testUserId,
            messages: [testMessage]
          }),
        });

        if (response.ok) {
          console.log('  ✅ LINE Push Message test สำเร็จ! ตรวจสอบข้อความใน LINE');
        } else {
          const errorText = await response.text();
          console.log('  ❌ LINE Push Message test ล้มเหลว:', response.status, errorText);
          
          if (response.status === 401) {
            console.log('  💡 Channel Access Token ไม่ถูกต้อง - ตรวจสอบ LINE_CHANNEL_ACCESS_TOKEN');
          } else if (response.status === 400) {
            console.log('  💡 User ID ไม่ถูกต้อง - ตรวจสอบ LINE_IT_TEAM_USER_ID');
          }
        }
      } catch (error) {
        console.log('  ❌ เกิดข้อผิดพลาด:', error.message);
      }
    }
  } else {
    console.log('\n⚠️ LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ตั้งค่า - ข้าม LINE Messaging API test');
  }

  // 3. ทดสอบ LINE Webhook
  if (process.env.LINE_WEBHOOK_URL && process.env.LINE_WEBHOOK_URL !== 'your-line-webhook-url-here') {
    console.log('\n🧪 Testing LINE Webhook...');
    try {
      const testData = {
        type: 'test',
        message: 'ทดสอบ LINE Webhook',
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          system: 'NHF IT Support'
        }
      };

      const response = await fetch(process.env.LINE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      if (response.ok) {
        console.log('  ✅ LINE Webhook test สำเร็จ!');
      } else {
        console.log('  ❌ LINE Webhook test ล้มเหลว:', response.status);
      }
    } catch (error) {
      console.log('  ❌ เกิดข้อผิดพลาด:', error.message);
    }
  } else {
    console.log('\n⚠️ LINE_WEBHOOK_URL ไม่ได้ตั้งค่า - ข้าม Webhook test');
  }

  console.log('\n📝 วิธีการตั้งค่า LINE Messaging API:');
  console.log('\n1. 📱 LINE Messaging API (สำหรับ LINE Official Account):');
  console.log('   - ไปที่ https://developers.line.biz/console/');
  console.log('   - ล็อกอินด้วยบัญชี LINE Business Account');
  console.log('   - สร้าง Provider และ Channel ใหม่ (หรือเลือกที่มีอยู่)');
  console.log('   - เลือก "Messaging API" ในประเภท Channel');
  console.log('   - คัดลอก "Channel Access Token" มาใส่ใน LINE_CHANNEL_ACCESS_TOKEN');
  
  console.log('\n2. 🔗 LINE Webhook (สำหรับ LINE OA):');
  console.log('   - ตั้งค่า Webhook URL ในการตั้งค่า Channel');
  console.log('   - ใส่ URL ที่ต้องการรับข้อมูลใน LINE_WEBHOOK_URL');

  console.log('\n3. 👤 การหา User ID:');
  console.log('   - ให้ผู้ใช้ Add LINE OA เป็นเพื่อน');
  console.log('   - ส่งข้อความใดๆ ไปยัง webhook เพื่อดู User ID');
  console.log('   - ใส่ User ID ใน LINE_IT_TEAM_USER_ID');

  console.log('\n✅ LINE Messaging API Test เสร็จสิ้น!');
}

// Run the test
testLineMessagingAPI().catch(console.error);