import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { title, body } = await request.json();

    if (!title || !body) {
      return NextResponse.json({ success: false, error: 'Título e mensagem são obrigatórios' }, { status: 400 });
    }

    // 1. Pega a lista de todos os usuários
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);

    if (snapshot.empty) {
        return NextResponse.json({ success: false, message: 'Nenhum usuário encontrado para enviar.' });
    }

    // 2. Entrega a mensagem na caixa de correio de cada um
    const deliveryJobs = snapshot.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        
        await addDoc(collection(db, 'users', userId, 'notifications'), {
            title: title,
            body: body,
            read: false,
            createdAt: serverTimestamp()
        });
    });

    await Promise.all(deliveryJobs);

    return NextResponse.json({ success: true, count: snapshot.size });

  } catch (error: any) {
    console.error("Erro no envio:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}