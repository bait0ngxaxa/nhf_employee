// Debug LINE Notification
// Run with: npm run debug:line

require('dotenv').config({ path: '.env.local' });

async function debugLineNotification() {
  console.log('🔍 LINE Notification Debug\n');

  // 1. ตรวจสอบ Environment Variables
  console.log('📋 Environment Variables:');
  console.log('  LINE_CHANNEL_ACCESS_TOKEN:', process.env.LINE_CHANNEL_ACCESS_TOKEN ? '✅ SET' : '❌ MISSING');
  console.log('  Token length:', process.env.LINE_CHANNEL_ACCESS_TOKEN?.length || 0);
  console.log('  LINE_IT_TEAM_USER_ID:', process.env.LINE_IT_TEAM_USER_ID ? '✅ SET' : '❌ MISSING');
  console.log('  LINE_WEBHOOK_URL:', process.env.LINE_WEBHOOK_URL || '❌ NOT SET');

  // 2. ตรวจสอบ Token format
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (token) {
    console.log('\n🔑 Token Analysis:');
    console.log('  First 10 chars:', token.substring(0, 10));
    console.log('  Length:', token.length, '(should be ~160+ chars)');
    
    if (token.length < 100) {
      console.log('  ❌ Token seems too short! LINE tokens are typically 160+ characters');
    }
  }

  // 3. ทดสอบ LINE API connection
  if (token && token.length > 50) {
    console.log('\n📱 Testing LINE API Connection...');
    
    try {
      // ทดสอบ Broadcast API
      const testMessage = {
        type: 'text',
        text: '🧪 Debug Test: LINE Notification System\n\nThis is a test message from NHF IT Support system.\n\nTime: ' + new Date().toLocaleString('th-TH')
      };

      const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [testMessage]
        }),
      });

      console.log('  Response status:', response.status);
      
      if (response.ok) {
        console.log('  ✅ LINE API connection successful!');
        console.log('  📱 Check your LINE OA for test message');
      } else {
        const errorText = await response.text();
        console.log('  ❌ LINE API failed:', errorText);
        
        if (response.status === 401) {
          console.log('  💡 Invalid token - check LINE_CHANNEL_ACCESS_TOKEN');
        } else if (response.status === 403) {
          console.log('  💡 Forbidden - check token permissions');
        }
      }
    } catch (error) {
      console.log('  ❌ Connection error:', error.message);
    }
  }

  // 4. แนะนำการแก้ไข
  console.log('\n🔧 Recommendations:');
  
  if (!token || token.length < 100) {
    console.log('  1. ❌ Get proper Channel Access Token from LINE Developers Console');
    console.log('     - Go to https://developers.line.biz/console/');
    console.log('     - Select your channel → Messaging API tab');
    console.log('     - Issue Channel Access Token (long-lived)');
  }
  
  if (!process.env.LINE_IT_TEAM_USER_ID) {
    console.log('  2. ⚠️ No specific User ID set - using Broadcast mode');
    console.log('     - All LINE OA followers will receive notifications');
    console.log('     - To send to specific user, set LINE_IT_TEAM_USER_ID');
  }
  
  console.log('  3. 📝 Check server console logs when creating tickets');
  console.log('  4. 🔍 Look for "📱 LINE result: SUCCESS/FAILED" messages');
}

// Run debug
debugLineNotification().catch(console.error);