import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { txid } = await req.json();
    
    // 1. Configuração e Firebase
    const PIXUP_URL = process.env.PIXUP_API_URL;
    const CLIENT_ID = process.env.PIXUP_CLIENT_ID;
    const CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET;

    if (!PIXUP_URL) return NextResponse.json({ error: 'Configuração inválida' }, { status: 500 });

    const depositsRef = collection(db, 'deposits');
    const q = query(depositsRef, where('txid', '==', txid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return NextResponse.json({ error: 'Depósito não encontrado' }, { status: 404 });
    const depositDoc = querySnapshot.docs[0];
    const depositData = depositDoc.data();

    if (depositData.status === 'completed') {
        return NextResponse.json({ status: 'PAID', message: 'Já estava pago!' });
    }

    // 2. Autenticação Pixup
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const authResponse = await fetch(`${PIXUP_URL}/v2/oauth/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials' })
    });
    const { access_token } = await authResponse.json();

    // 3. CONSULTA (Estratégia: Filtro por External ID)
    // Muitos sistemas bloqueiam GET /id mas aceitam GET ?external_id=...
    console.log("Tentando consulta por filtro...");
    
    const url = `${PIXUP_URL}/v2/pix/qrcode?external_id=${depositData.external_id}`;
    
    const resp = await fetch(url, {
        headers: { 'Authorization': `Bearer ${access_token}` }
    });
    
    // Se der 405 de novo, retornamos erro amigável
    if (resp.status === 405) {
        return NextResponse.json({ 
            error: 'A Pixup não permite consulta manual (Erro 405).',
            detail: 'Por favor, aguarde o processamento automático.' 
        }, { status: 400 });
    }

    if (!resp.ok) {
        const text = await resp.text();
        return NextResponse.json({ error: `Erro na API Pixup: ${resp.status}`, detail: text }, { status: 400 });
    }

    const data = await resp.json();
    
    // O retorno pode ser uma lista ou um objeto
    let transaction = Array.isArray(data) ? data[0] : data;

    // 4. Liberação
    const status = transaction?.status || transaction?.tx?.status || '';
    const isPaid = ['PAID', 'COMPLETED', 'APPROVED', 'CONCLUDED', 'ATIVA', 'CONCLUIDA'].includes(status.toUpperCase());

    if (isPaid) {
        if (depositData.userId) {
            const userRef = doc(db, 'users', depositData.userId);
            await updateDoc(userRef, { balance: increment(depositData.amount) });
        }
        await updateDoc(depositDoc.ref, { status: 'completed', paidAt: new Date(), method: 'manual_filter_v4' });
        return NextResponse.json({ status: 'PAID', message: 'Confirmado!' });
    }

    return NextResponse.json({ status: 'PENDING', message: 'Aguardando pagamento...' });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}