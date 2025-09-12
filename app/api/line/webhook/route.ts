import { NextRequest, NextResponse } from 'next/server';

// LINE Webhook handler for receiving events and getting User IDs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('📱 [LINE WEBHOOK] Received event:', JSON.stringify(body, null, 2));
    
    // ตรวจสอบ events
    if (body.events && Array.isArray(body.events)) {
      for (const event of body.events) {
        console.log('🔍 Event type:', event.type);
        
        if (event.source?.userId) {
          console.log('👤 User ID found:', event.source.userId);
          console.log('💡 To use this User ID, add to your .env.local:');
          console.log(`LINE_IT_TEAM_USER_ID="${event.source.userId}"`);
        }
        
        // Log different event types
        switch (event.type) {
          case 'message':
            if (event.message?.text) {
              console.log('📝 Message received:', event.message.text);
            }
            break;
          case 'follow':
            console.log('➕ User followed the account');
            break;
          case 'unfollow':
            console.log('➖ User unfollowed the account');
            break;
          default:
            console.log('📋 Other event type:', event.type);
        }
      }
    }
    
    // Return 200 OK to acknowledge receipt
    return NextResponse.json({ 
      status: 'ok',
      message: 'Webhook processed successfully'
    });
    
  } catch (error) {
    console.error('❌ [LINE WEBHOOK] Error processing webhook:', error);
    return NextResponse.json({ 
      error: 'Webhook processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// สำหรับ LINE verification และ health check
export async function GET(request: NextRequest) {
  console.log('🏥 [LINE WEBHOOK] Health check requested');
  
  return NextResponse.json({ 
    message: 'LINE Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
}