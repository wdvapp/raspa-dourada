import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    console.log("--- WEBHOOK PIXUP INICIADO ---");
    
    // 1. Recebe os dados da Pixup
    const body = await req.json();
    console.log("Payload recebido:", JSON.stringify(body));

    // A Pixup geralmente manda: { transactionId: "...", status: "paid", amount: 10.00 }
    // O campo exato do status pode variar (paid, completed, approved). Vamos checar genericamente.
    const { transactionId, status, external_id } = body;

    if (!transactionId || !status) {
        return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // Só nos interessa se foi PAGO
    if (status !== 'paid' && status !== 'completed' && status !== 'approved') {
        console.log("Status não é de pagamento aprovado:", status);
        return NextResponse.json({ received: true });
    }

    // 2. Acha o depósito no nosso Banco de Dados
    const depositsRef = collection(db, 'deposits');
    const q = query(depositsRef, where('txid', '==', transactionId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.error("Depósito não encontrado para TXID:", transactionId);
        return NextResponse.json({ error: 'Depósito não encontrado' }, { status: 404 });
    }

    const depositDoc = querySnapshot.docs[0];
    const depositData = depositDoc.data();

    // 3. Segurança: Se já foi pago, não faz nada (evita saldo duplo)
    if (depositData.status === 'completed') {
        console.log("Esse depósito já foi processado antes.");
        return NextResponse.json({ received: true });
    }

    // 4. ATUALIZA O SALDO DO USUÁRIO
    const userId = depositData.userId;
    if (userId && userId !== 'anonimo') {
        const userRef = doc(db, 'users', userId);
        
        // Verifica se o usuário existe antes de dar saldo
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            await updateDoc(userRef, {
                balance: increment(depositData.amount) // Soma o valor ao saldo atual
            });
            console.log(`SUCESSO: R$ ${depositData.amount} adicionados para o usuário ${userId}`);
        }
    }

    // 5. Marca o depósito como concluído
    await updateDoc(depositDoc.ref, {
        status: 'completed',
        paidAt: new Date(),
        webhook_body: body // Salva o que a Pixup mandou por segurança
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("ERRO NO WEBHOOK:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}