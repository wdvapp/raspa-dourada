import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Inicia o Firebase Admin se ainda não estiver iniciado
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Corrige a formatação da chave privada (remove quebras de linha extras se houver)
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

export async function POST(request: Request) {
  try {
    const { title, body, userId } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ error: 'Título e mensagem são obrigatórios' }, { status: 400 });
    }

    console.log(`📨 Tentando enviar notificação: "${title}"`);

    // 1. SALVAR NO "SININHO" (Banco de Dados)
    // Se for para TODOS, teríamos que fazer um loop (isso é pesado, faremos depois).
    // Por enquanto, vamos focar em enviar para um usuário específico ou tópico.
    
    // Vamos enviar para o Tópico "all_users" (Geral)
    // Nota: O frontend precisa inscrever o usuário nesse tópico, mas vamos focar no envio agora.
    
    const message = {
      notification: {
        title: title,
        body: body,
      },
      topic: 'all_users' // Envia para todo mundo que aceitou notificação
    };

    // 2. ENVIAR PUSH (Celular Apita)
    const response = await admin.messaging().send(message);
    
    console.log('✅ Notificação enviada com sucesso:', response);

    return NextResponse.json({ success: true, messageId: response });

  } catch (error: any) {
    console.error('❌ Erro ao enviar notificação:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}