// Quick test for LINE notification
// Run with: node test-line-quick.js

require('dotenv').config({ path: '.env.local' });

async function quickLineTest() {
  console.log('🚀 Quick LINE Test\n');

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const userId = process.env.LINE_IT_TEAM_USER_ID;

  console.log('📋 Configuration:');
  console.log('  Token:', token ? `SET (${token.length} chars)` : 'NOT SET');
  console.log('  User ID:', userId || 'NOT SET (will use Broadcast)');

  if (!token) {
    console.log('\n❌ No LINE_CHANNEL_ACCESS_TOKEN found!');
    return;
  }

  // Test message
  const testMessage = {
    type: 'text',
    text: `🧪 Quick Test - ${new Date().toLocaleString('th-TH')}\n\n✅ หากคุณเห็นข้อความนี้แสดงว่า LINE API ทำงานได้ปกติ!\n\n📱 NHF IT Support System`
  };

  try {
    let response;
    
    if (userId) {
      console.log('\n📤 Sending to specific user...');
      response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: userId,
          messages: [testMessage]
        }),
      });
    } else {
      console.log('\n📢 Sending broadcast...');
      response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [testMessage]
        }),
      });
    }

    console.log('Response status:', response.status);

    if (response.ok) {
      console.log('✅ SUCCESS! Check your LINE for the test message');
    } else {
      const errorText = await response.text();
      console.log('❌ FAILED:', errorText);
      
      if (response.status === 401) {
        console.log('\n💡 Fix: Check your LINE_CHANNEL_ACCESS_TOKEN');
      } else if (response.status === 400) {
        console.log('\n💡 Fix: Check your LINE_IT_TEAM_USER_ID or try broadcast mode');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickLineTest();