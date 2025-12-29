import { NextRequest, NextResponse } from 'next/server';

// LINE Webhook handler for receiving events and getting User IDs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ตรวจสอบ events
    if (body.events && Array.isArray(body.events)) {
      for (const event of body.events) {
        if (event.source?.userId) {
          // User ID found - should be added to environment variables
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
export async function GET() {
  return NextResponse.json({
    message: 'LINE Webhook endpoint is working',
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
}