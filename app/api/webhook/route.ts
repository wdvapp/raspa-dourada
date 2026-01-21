import { NextResponse } from 'next/server';
// Tenta importar com @, se der erro no editor, mantenha o ../../../lib/firebase
import { db } from '@/lib/firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, increment, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    console.log("--- WEBHOOK ESPIÃO INICIADO ---");
    
    // 1. Recebe e Analisa o Body
    const body = await req.json();
    
    // O pulo do gato: A Pixup manda dentro de 'requestBody'
    const data = body.requestBody || body;
    const { transactionId, status, external_id, amount } = data;

    // 2. 🚨 GRAVA O LOG NO FIREBASE (Para a gente ver o que está chegando)
    // Se isso aparecer no seu banco, a conexão Pixup -> Vercel está funcionando!
    try {
        await addDoc(collection(db, 'webhook_logs'), {
            receivedAt: serverTimestamp(),
            full_payload: body,      // O que chegou bruto
            processed_data: data,    // O que a gente extraiu
            txid_buscado: transactionId,
            status_recebido: status,
            amount_recebido: amount
        });
    } catch (e) {
        console.error("Erro ao salvar log de debug:", e);
    }

    // 3. Validação
    if (!transactionId || !status) {
        return NextResponse.json({ error: 'Dados incompletos (Verifique webhook_logs no Firebase)' }, { status: 400 });
    }

    // Aceita PAID, paid, APPROVED, etc.
    const isPaid = ['PAID', 'paid', 'APPROVED', 'approved', 'COMPLETED', 'completed'].includes(status);

    if (!isPaid) {
        return NextResponse.json({ message: `Status ${status} ignorado` });
    }

    // 4. Busca e Atualiza o Depósito
    const depositsRef = collection(db, 'deposits');
    
    // Tenta achar pelo ID da Transação (txid)
    let q = query(depositsRef, where('txid', '==', transactionId));
    let querySnapshot = await getDocs(q);

    // Se não achar pelo txid, tenta pelo external_id (plano B)
    if (querySnapshot.empty && external_id) {
        q = query(depositsRef, where('external_id', '==', external_id));
        querySnapshot = await getDocs(q);
    }

    if (querySnapshot.empty) {
        return NextResponse.json({ error: 'Depósito não encontrado no banco' }, { status: 404 });
    }

    const depositDoc = querySnapshot.docs[0];
    const depositData = depositDoc.data();

    if (depositData.status === 'completed') {
        return NextResponse.json({ message: 'Já estava pago' });
    }

    // 5. Libera o Saldo
    if (depositData.userId && depositData.userId !== 'anonimo') {
        const userRef = doc(db, 'users', depositData.userId);
        await updateDoc(userRef, {
            balance: increment(Number(amount))
        });
    }

    await updateDoc(depositDoc.ref, {
        status: 'completed',
        paidAt: new Date(),
        webhook_log: 'sucesso_espiao'
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("ERRO CRÍTICO:", error);
    // Tenta salvar o erro no firebase também
    try {
        await addDoc(collection(db, 'webhook_logs'), { error: error.message, date: serverTimestamp() });
    } catch(e) {}
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}