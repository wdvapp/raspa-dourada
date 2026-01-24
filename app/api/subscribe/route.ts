import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Inicia o Admin (igual ao send-push)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) return NextResponse.json({ error: 'Token é obrigatório' }, { status: 400 });

    // A MÁGICA: Inscreve esse celular no canal "all_users"
    // Assim, quando o Admin mandar mensagem pra "all_users", esse celular recebe.
    await admin.messaging().subscribeToTopic(token, 'all_users');
    
    console.log('✅ Token inscrito no tópico all_users:', token);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('❌ Erro ao inscrever:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}