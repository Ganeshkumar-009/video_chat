# Video Chat App

Real-time video chat & messaging app with Firebase Auth, WebRTC, Socket.io.

## Local Setup
1. Firebase: Create project, enable Auth (Google, Phone), Firestore. Add web/app config to frontend/.env.local, service account to backend/.env.
2. Backend: `cd backend &amp;&amp; npm i &amp;&amp; npm run dev`
3. Frontend: `cd frontend &amp;&amp; npm i &amp;&amp; npm run dev`
4. Open http://localhost:3000

## Deploy to Render
1. Push to GitHub.
2. Frontend: New Static Site, build `npm install &amp;&amp; npm run build`, publish dir `out` (next export).
3. Backend: New Web Service, build `npm install`, start `npm start`, env vars.
4. Update frontend to point to Render backend URL.

## Env Vars
**frontend/.env.local**:
```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000  # Update for prod
```

**backend/.env**:
```
PORT=5000
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...  # Service account JSON multiline
FIREBASE_CLIENT_EMAIL=...
```

