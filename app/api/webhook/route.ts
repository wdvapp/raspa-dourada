import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment, getDoc, setDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    console.log("--- WEBHOOK PIXUP (CORREÇÃO REQUESTBODY) ---");
    
    // 1. Recebe os dados brutos
    const body = await req.json();
    console.log("Payload Recebido:", JSON.stringify(body, null, 2));

    // 2. DESEMBRULHA O PACOTE (O Segredo estava aqui!)
    // A Pixup manda tudo dentro de "requestBody".
    // Se vier solto (teste manual), usa o body direto. Se vier da Pixup, usa requestBody.
    const data = body.requestBody || body;

    const { transactionId, status, external_id, amount } = data;

    // Validação de segurança
    if (!transactionId || !status) {
        console.error("Dados incompletos:", data);
        return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
    }

    // 3. Verifica se pagou (Pixup manda "PAID")
    const isPaid = status === 'PAID' || status === 'paid' || status === 'approved';

    if (!isPaid) {
        console.log("Status não é de pagamento:", status);
        return NextResponse.json({ received: true });
    }

    // 4. Busca o depósito no Firebase pelo ID da Transação
    const depositsRef = collection(db, 'deposits');
    const q = query(depositsRef, where('txid', '==', transactionId));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        // Tenta buscar pelo external_id se falhar pelo txid
        console.log("TxID não achado, tentando por External ID:", external_id);
        const qExt = query(depositsRef, where('external_id', '==', external_id));
        const snapExt = await getDocs(qExt);
        
        if (snapExt.empty) {
            console.error("Depósito não encontrado nem por ID nem por External ID.");
            return NextResponse.json({ error: 'Depósito não encontrado' }, { status: 404 });
        }
        // Achou pelo external_id
        await processarPagamento(snapExt.docs[0], amount);
    } else {
        // Achou pelo transactionId
        await processarPagamento(querySnapshot.docs[0], amount);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("ERRO NO WEBHOOK:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Função auxiliar para evitar repetição de código
async function processarPagamento(depositDoc: any, amountPix: number) {
    const depositData = depositDoc.data();

    // Evita pagamento duplo
    if (depositData.status === 'completed') {
        console.log("Depósito já estava pago. Ignorando.");
        return;
    }

    // Atualiza saldo do usuário
    if (depositData.userId && depositData.userId !== 'anonimo') {
        const userRef = doc(db, 'users', depositData.userId);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
            await updateDoc(userRef, {
                balance: increment(Number(amountPix)) 
            });
            console.log(`✅ SUCESSO! R$ ${amountPix} entregues para ${depositData.userId}`);
        }
    }

    // Marca depósito como concluído
    await updateDoc(depositDoc.ref, {
        status: 'completed',
        paidAt: new Date(),
        gateway_status: 'PAID'
    });
}