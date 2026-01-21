import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { txid } = await req.json();
    console.log("🔍 [AUTO-CHECK] Verificando TXID:", txid);

    // 1. Configuração e Busca no Firebase
    const PIXUP_URL = process.env.PIXUP_API_URL;
    const CLIENT_ID = process.env.PIXUP_CLIENT_ID;
    const CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET;

    if (!PIXUP_URL) return NextResponse.json({ error: 'Faltam chaves na Vercel' }, { status: 500 });

    const depositsRef = collection(db, 'deposits');
    const q = query(depositsRef, where('txid', '==', txid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return NextResponse.json({ error: 'Depósito não encontrado no Firebase' }, { status: 404 });

    const depositDoc = querySnapshot.docs[0];
    const depositData = depositDoc.data();

    if (depositData.status === 'completed') {
        return NextResponse.json({ status: 'PAID', message: 'Já estava pago' });
    }

    // 2. Autenticação Pixup
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const authResponse = await fetch(`${PIXUP_URL}/v2/oauth/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials' })
    });

    if (!authResponse.ok) return NextResponse.json({ error: 'Erro Auth Pixup' }, { status: 400 });
    const { access_token } = await authResponse.json();

    // 3. TENTATIVA TRIPLA DE CONSULTA (A mágica acontece aqui)
    let pixupData = null;
    let success = false;

    // TENTATIVA A: Por Transaction ID (Padrão)
    console.log("Tentativa A: Consultando por TXID...");
    const respA = await fetch(`${PIXUP_URL}/v2/pix/qrcode/${txid}`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    if (respA.ok) {
        pixupData = await respA.json();
        success = true;
    } else {
        // TENTATIVA B: Por External ID (Caso o endpoint exija nosso ID)
        console.log("Tentativa B: Consultando por External ID...");
        const externalId = depositData.external_id;
        if (externalId) {
            // Alguns endpoints usam filtro por external_id
            const respB = await fetch(`${PIXUP_URL}/v2/pix/qrcode?external_id=${externalId}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            if (respB.ok) {
                const list = await respB.json();
                // Se retornar lista, pega o primeiro item
                if (Array.isArray(list) && list.length > 0) pixupData = list[0];
                else pixupData = list;
                
                if (pixupData) success = true;
            }
        }
    }

    if (!success || !pixupData) {
        // Se falhou tudo, retornamos o erro para você ver na tela
        return NextResponse.json({ error: 'Falha ao consultar status na Pixup (Tente aguardar mais uns segundos).' }, { status: 400 });
    }

    console.log("✅ Dados Pixup Recebidos:", JSON.stringify(pixupData));

    // 4. Liberação
    // Verifica várias possibilidades de onde o status pode estar
    const status = pixupData.status || pixupData.tx?.status || (pixupData.situacao ? pixupData.situacao : ''); 
    
    // Lista de palavras que significam "PAGO"
    const isPaid = ['PAID', 'COMPLETED', 'APPROVED', 'CONCLUDED', 'ATIVA', 'CONCLUIDA'].includes(status.toUpperCase());

    if (isPaid) {
        if (depositData.userId) {
            const userRef = doc(db, 'users', depositData.userId);
            await updateDoc(userRef, { balance: increment(depositData.amount) });
        }
        await updateDoc(depositDoc.ref, { status: 'completed', paidAt: new Date(), method: 'manual_auto_check' });
        return NextResponse.json({ status: 'PAID', message: 'Pagamento confirmado!' });
    }

    return NextResponse.json({ status: 'PENDING', message: 'Aguardando pagamento...' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}