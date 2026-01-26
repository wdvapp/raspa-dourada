// @ts-nocheck
import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; 
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import * as admin from 'firebase-admin';

// --- CONFIGURAÇÃO DO ADMIN ---
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

    // 1. SALVA NO BANCO (HISTÓRICO)
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

    // 2. ENVIA O PUSH (FORMATO WEBPUSH PROFISSIONAL)
    let successCount = 0;
    if (tokensToSend.length > 0 && admin.apps.length) {
        
        const message = {
            // A. Dados Genéricos (Fallback)
            notification: { 
                title, 
                body 
            },
            // B. Dados Para o Clique Manual (Service Worker)
            data: {
                url: link || '/' 
            },
            // C. CONFIGURAÇÃO ESPECÍFICA PARA NAVEGADORES (O Segredo!)
            webpush: {
                headers: {
                    Urgency: "high"
                },
                notification: {
                    title: title,
                    body: body,
                    icon: '/icon-192x192.png', // Força o ícone do App
                    image: image || '',         // Força a Imagem Grande
                    requireInteraction: true,   // Faz a notificação ficar na tela até clicar
                    // Ação de clique nativa (Backup se o SW falhar)
                    data: {
                        url: link || '/'
                    }
                },
                fcm_options: {
                    link: link || '/' // Link nativo do Firebase
                }
            },
            tokens: tokensToSend,
        };
        
        try {
            const response = await admin.messaging().sendEachForMulticast(message);
            successCount = response.successCount;
            console.log(`Push enviado: ${successCount}`);
        } catch (pushError) {
            console.error("Erro push:", pushError);
        }
    }

    return NextResponse.json({ success: true, dbSaved: snapshot.size, pushSent: successCount });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}