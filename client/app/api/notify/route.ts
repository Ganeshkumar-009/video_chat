import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../../../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase Admin Initialization Error:', error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token, title, body: notificationBody } = body;

    if (!token) {
      return NextResponse.json({ error: 'FCM Token is required' }, { status: 400 });
    }

    const message = {
      notification: {
        title,
        body: notificationBody,
      },
      token,
      android: {
        priority: 'high' as const,
        notification: {
          channelId: 'high_importance_channel',
          sound: 'default'
        }
      }
    };

    const response = await admin.messaging().send(message);
    
    return NextResponse.json({ success: true, response });
  } catch (error: any) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
