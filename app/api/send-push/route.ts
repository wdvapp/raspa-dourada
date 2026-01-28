// @ts-nocheck
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
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
  }
}

export async function POST(request: Request) {
  try {
    const { title, body, image, link } = await request.json();

    if (!title || !body) return NextResponse.json({ success: false, error: 'Dados incompletos' }, { status: 400 });

    // 1. Salva no Histórico do Usuário (Isso continua igual)
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const tokensToSend: string[] = [];

    const dbPromises = snapshot.docs.map(async (userDoc) => {
        await addDoc(collection(db, 'users', userDoc.id, 'notifications'), {
            title, body, image: image || null, link: link || '/', read: false, createdAt: serverTimestamp()
        });
        const tokenSnap = await getDocs(collection(db, 'users', userDoc.id, 'fcmTokens'));
        tokenSnap.forEach(t => {
            const tokenData = t.data();
            if (tokenData.token) tokensToSend.push(tokenData.token);
        });
    });

    await Promise.all(dbPromises);

    let successCount = 0;
    if (tokensToSend.length > 0 && admin.apps.length) {
        
        // --- A MÁGICA ACONTECE AQUI ---
        // Adicionamos o bloco 'notification' para o Android respeitar
        const message = {
            notification: {
                title: title,
                body: body,
                image: image || "", // A imagem aparece nativa do Android
            },
            data: {
                // Mantemos o data para garantir que o link funcione
                url: link || "/", 
                click_action: link || "/" 
            },
            tokens: tokensToSend,
            android: {
                priority: 'high', // Força prioridade máxima
                notification: {
                    priority: 'max',
                    defaultSound: true,
                    defaultVibrateTimings: true
                }
            },
            webpush: {
                headers: {
                    Urgency: "high"
                }
            }
        };
        
        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            successCount = response.successCount;
            console.log(`Push Híbrido enviado: ${successCount}`);
        } catch (pushError) {
            console.error("Erro push:", pushError);
        }
    }

    return NextResponse.json({ success: true, dbSaved: snapshot.size, pushSent: successCount });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}