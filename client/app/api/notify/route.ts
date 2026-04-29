import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Initialize Firebase Admin only once
if (!admin.apps.length) {
  try {
    const pk1 = "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDJI3vjlmKlt9IH\\nGKmVmDBXDCNmgLsEjymMhHpae9fAcjRkOJjGw7jMuIFUj8zywit9zS9I9Yyb51qB\\nd/qzEOR3ZctN5HWwU+1PFmqK2qrAmqD0cclOFtkWlo2AQzW/OwFtNNlrY+TWryOM\\nGasGssDxvRt1DRcWdILQV6FzUaOqTgfhZGLQLkm3nCK2zINiius+zg2GM0iHYLv7\\n4a1SbTZ+PWkcLDmePloh+HJtloQNqrWul5WM/OpTPi8rn2A/nLtfEMt2khE6UUFt\\naHdLBlgLKJJgeoK8IfwzqSYVSZHzJuf+it0o8N7WvNHyAvXXgQfiZmoogzdRN3rk\\nEyd7SDLxAgMBAAECggEAN8MfoJvbo2fP0WnT8gYsOKXD1rIPpxbthOhhZ154FQFU\\nZwiNymUOgasRJ9lqD08ncYwF9OsmXT6Jh+U0WppvTG6rK2AQBJ9v5gIn7XDr79Ou\\nlbZKAd0xuCJq/kkjyG1aWuVQ9YXPNnl9mGSxVn0OIrazuwKzCOWqMopo1yimABt9\\numj1UPjmpNrBIymQTrv7ayjp+wRYvnmAY3MnWx1AIdeHToFEtV6H38yPdw6azlNa\\nI1uUZ52cON59F/hEQX7IimKUwih7YtYC4GvGjbbNkTtTpCp6o0YMv6pNf+89955p\\n1V4TdfE/fbUY4KHwoFZ+p9Ot8uEA2OAlaVibk46KhQKBgQD1qjjnmYEbu8djd0kI\\nHhpWJAU6Njue8HHZ+/vcYkBAQuHNAZCC2WfBcVcF2cSwLbZa4nFA3g/049aHT5LN\\nqWg9qjBoFH+gKdzW5PxijgZdLJRcvNY/ORM1UW0ABiZc/vuFZyEe9H0RQEblXcd6\\nFwgAPbpJkhrMDC7KS90DyOKwRwKBgQDRmbghgQMMkNrKsLdh2Eui8F58mpjiAhkD\\nffeAc+TU/g6tOQUzx6cjW8LB10ub3kon5QW+fvaZOVFWeDsfYG/zNtchDSYME8Y9\\njT7v7bCQrFJXQ9QS2UriXPUiEX6C0RSGXm9Exw/tchmu5akgq6yglb8U175bfZrp\\nPkZxTUkXBwKBgQC8v3GDOCTDWy4h1PeOvho8DubZR+vc/R5sfjePpwl4liqI6WfP\\nsRwPu3ZCL4P4XNbb01lynmsiG5+rTM8dJsjJgCY7AWzhcOiVT1A+pKJtGiBPdGMk\\nJkUE1S/rMc5t6xby8z62WuBwzbLq7Xei7WkfTk3/0rq2BbI5ibog+0p4ZwKBgAJP\\nITotQ61VwzNMcxi+20Z2Q3Q398s1nrTtJFbj7/dwvRSndik139+B2UltZ8XV0xdR\\nbJjGqUzS1tSPCoez9kfFqOUSUgL8DMkMz06xXaqaW2Xet21lu292+rRfYPdr+j/o\\ntm0ZjFFfWm0U1qInggVa4PoHzm8PmS9MolYJNe7tAoGAO5w1Wtxx5B7Q4UAvdabL\\nN51GT3gLvFo6rx1P2m9BguEqA4R5eiTuNSL7Yn2ZzewxSpx5fmyTLMTGfpuNg0ir\\n";
    const pk2 = "ehFyU4ix/bztw93dzyv8dzaiMKe7moqtln0FMapOtLzeVJ2vlsiPuYFbSX/4up5p\\n4ukXz062pVk4+pFsWUsmcbo=\\n-----END PRIVATE KEY-----\\n";
    
    const serviceAccount = {
      projectId: "wechat-aa713",
      clientEmail: "firebase-adminsdk-fbsvc@wechat-aa713.iam.gserviceaccount.com",
      privateKey: (pk1 + pk2).replace(/\\n/g, '\n'),
    };
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
          sound: 'default',
          icon: '@mipmap/ic_launcher',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
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
