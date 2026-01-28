// @ts-nocheck
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import * as admin from 'firebase-admin';

// CONFIGURAÇÃO JÁ APLICADA COM SEU LINK REAL
const ICON_URL = 'https://www.raspadourada.com/icon-192x192.png';

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

    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const tokensToSend: string[] = [];

    // 1. Salva no histórico do banco
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
        
        // 2. Monta a mensagem com o ÍCONE GARANTIDO
        const message = {
            notification: {
                title: title,
                body: body,
                icon: ICON_URL, // <--- Link direto para a sua logo online
                image: image || "",
            },
            data: {
                title: title,
                body: body,
                image: image || "", 
                url: link || "/",
                click_action: link || "/" 
            },
            tokens: tokensToSend,
            android: {
                priority: 'high',
                notification: {
                    priority: 'max',
                    defaultSound: true,
                    defaultVibrateTimings: true,
                    icon: ICON_URL, // <--- Reforço para o Android
                    color: '#000000' 
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
            console.log(`Push com Link Absoluto enviado: ${successCount}`);
        } catch (pushError) {
            console.error("Erro push:", pushError);
        }
    }

    return NextResponse.json({ success: true, dbSaved: snapshot.size, pushSent: successCount });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}