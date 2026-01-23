import { NextResponse } from 'next/server';
// Tenta importar com @, se der erro no editor, mantenha o ../../../lib/firebase
import { db } from '@/lib/firebase'; 
import { collection, query, where, getDocs, updateDoc, doc, increment, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    console.log("--- WEBHOOK ESPIÃO INICIADO ---");
    
    // 1. Recebe e Analisa o Body
    const body = await req.json();
    
    // O pulo do gato: A Pixup manda dentro de 'requestBody' ou direto no body
    const data = body.requestBody || body;
    const { transactionId, status, external_id, amount } = data;

    // 2. 🚨 GRAVA O LOG NO FIREBASE
    try {
        await addDoc(collection(db, 'webhook_logs'), {
            receivedAt: serverTimestamp(),
            full_payload: body,
            processed_data: data,
            txid_buscado: transactionId,
            status_recebido: status,
            amount_recebido: amount
        });
    } catch (e) {
        console.error("Erro ao salvar log de debug:", e);
    }

    // 3. Validação
    if (!transactionId || !status) {
        return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
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

    // 5. LIBERA O SALDO + BÔNUS (LÓGICA NOVA AQUI ⬇️)
    let bonusApplied = 0;
    const amountVal = Number(amount); // Garante que é numero

    if (depositData.userId && depositData.userId !== 'anonimo') {
        const userRef = doc(db, 'users', depositData.userId);
        
        // --- INÍCIO DA MÁGICA DO BÔNUS ---
        const bonusConfigSnap = await getDoc(doc(db, 'config', 'bonus'));
        const userSnap = await getDoc(userRef);
        
        let finalAmount = amountVal;

        if (bonusConfigSnap.exists() && userSnap.exists()) {
            const config = bonusConfigSnap.data();
            const userData = userSnap.data();

            // Verifica: Bônus Ativo? + Usuário nunca recebeu?
            if (config.active && !userData.hasReceivedBonus) {
                const minDep = Number(config.minDeposit) || 0;
                
                // Verifica depósito mínimo
                if (amountVal >= minDep) {
                    // Calcula Bônus
                    bonusApplied = amountVal * (Number(config.percentage) / 100);
                    finalAmount = amountVal + bonusApplied;
                    
                    console.log(`🤑 BÔNUS APLICADO: R$ ${bonusApplied} (${config.percentage}%)`);
                }
            }
        }
        // --- FIM DA MÁGICA ---

        // Atualiza o usuário
        await updateDoc(userRef, {
            balance: increment(finalAmount), // Deposita Valor + Bônus
            hasReceivedBonus: true,          // Marca que já usou o bônus de boas-vindas
            totalDeposited: increment(amountVal) // Histórico do valor real
        });
    }

    // Atualiza o documento do depósito
    await updateDoc(depositDoc.ref, {
        status: 'completed',
        paidAt: new Date(),
        webhook_log: 'sucesso_com_bonus',
        bonusGiven: bonusApplied // Salva no histórico do depósito quanto foi dado de bônus
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("ERRO CRÍTICO:", error);
    try {
        await addDoc(collection(db, 'webhook_logs'), { error: error.message, date: serverTimestamp() });
    } catch(e) {}
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}