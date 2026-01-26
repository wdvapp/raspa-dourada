// @ts-nocheck
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import * as admin from 'firebase-admin';

// --- CONFIGURAÇÃO DO ADMIN (Lê do seu .env.local) ---
// Se não tiver admin iniciado, inicia agora
if (!admin.apps.length) {
  // Pega a chave privada e arruma as quebras de linha (\n) que o .env as vezes estraga
  const privateKey = process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined;

  if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
  } else {
      console.error("ERRO: Faltam chaves no .env.local (FIREBASE_CLIENT_EMAIL ou FIREBASE_PRIVATE_KEY)");
  }
}

export async function POST(request: Request) {
  try {
    const { title, body } = await request.json();

    if (!title || !body) return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });

    // 1. SALVAR NO BANCO (Sininho do App)
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    // Lista para guardar os tokens de quem aceitou receber notificação
    const tokensToSend: string[] = [];

    // Vamos varrer cada usuário
    const dbPromises = snapshot.docs.map(async (userDoc) => {
        // A. Salva no histórico do usuário
        await addDoc(collection(db, 'users', userDoc.id, 'notifications'), {
            title, body, read: false, createdAt: serverTimestamp()
        });

        // B. Procura se esse usuário tem um Token de Celular salvo
        const tokenSnap = await getDocs(collection(db, 'users', userDoc.id, 'fcmTokens'));
        tokenSnap.forEach(t => {
            const tokenData = t.data();
            if (tokenData.token) tokensToSend.push(tokenData.token);
        });
    });

    await Promise.all(dbPromises);

    // 2. ENVIAR O PUSH REAL (Vibrar Celular)
    let successCount = 0;
    
    // Só tenta enviar se tiver tokens e se o Admin estiver configurado
    if (tokensToSend.length > 0 && admin.apps.length) {
        // O Firebase pede para enviar em lotes de 500, mas como seu app é novo, 
        // vamos enviar um por um no loop para garantir (sendEachForMulticast facilita isso)
        const message = {
            notification: { title, body },
            tokens: tokensToSend,
        };
        
        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            successCount = response.successCount;
            console.log(`📢 PUSH ENVIADO: ${successCount} sucessos, ${response.failureCount} falhas.`);
        } catch (pushError) {
            console.error("Erro ao disparar PUSH:", pushError);
        }
    }

    return NextResponse.json({ success: true, dbSaved: snapshot.size, pushSent: successCount });

  } catch (error: any) {
    console.error("Erro fatal no envio:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}