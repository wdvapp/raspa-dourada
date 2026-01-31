import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase'; // Seu cliente firebase (só pra pegar tipos se precisar)
import * as admin from 'firebase-admin';

// Inicializa o Admin se não estiver rodando
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
    const { userId, amount, type } = await request.json(); // type pode ser 'add' ou 'remove'

    if (!userId || !amount || !type) {
      return NextResponse.json({ success: false, error: 'Dados faltando' }, { status: 400 });
    }

    const userRef = admin.firestore().collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 });
    }

    const currentBalance = userSnap.data()?.balance || 0;
    const value = parseFloat(amount);
    
    // Calcula o novo saldo
    let newBalance = currentBalance;
    if (type === 'add') {
      newBalance += value;
    } else if (type === 'remove') {
      newBalance -= value;
      // Opcional: Impedir saldo negativo
      // if (newBalance < 0) newBalance = 0; 
    }

    // ATUALIZAÇÃO ATÔMICA (Segura)
    await userRef.update({
      balance: newBalance
    });

    // CRIA UM REGISTRO NO EXTRATO (Importante para controle)
    await admin.firestore().collection('transactions').add({
      userId: userId,
      type: type === 'add' ? 'deposit_admin' : 'withdraw_admin', // Tipo especial para identificar que foi o Admin
      amount: value,
      status: 'completed',
      description: type === 'add' ? 'Crédito Administrativo' : 'Remoção Administrativa',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return NextResponse.json({ success: true, newBalance });

  } catch (error: any) {
    console.error("Erro ao atualizar saldo:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}