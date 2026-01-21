import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { txid } = await req.json();
    console.log("🔍 [DEBUG] Iniciando check para TXID:", txid);

    // 1. Validação Básica
    const PIXUP_URL = process.env.PIXUP_API_URL;
    const CLIENT_ID = process.env.PIXUP_CLIENT_ID;
    const CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET;

    if (!PIXUP_URL) return NextResponse.json({ error: 'Configuração: Falta PIXUP_API_URL' }, { status: 400 });

    // 2. Busca Depósito no Firebase
    const depositsRef = collection(db, 'deposits');
    const q = query(depositsRef, where('txid', '==', txid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: `Depósito ${txid} não achado no Firebase` }, { status: 404 });
    }

    const depositDoc = querySnapshot.docs[0];
    const depositData = depositDoc.data();

    if (depositData.status === 'completed') {
        return NextResponse.json({ status: 'PAID', message: 'Já estava pago!' });
    }

    // 3. Autenticação na Pixup
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const authResponse = await fetch(`${PIXUP_URL}/v2/oauth/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ grant_type: 'client_credentials' })
    });

    if (!authResponse.ok) {
        const text = await authResponse.text();
        return NextResponse.json({ error: `Erro Auth Pixup: ${authResponse.status} - ${text}` }, { status: 400 });
    }

    const authData = await authResponse.json();
    const token = authData.access_token;

    // 4. Consulta o Status (Aqui é onde deve estar o problema)
    // Tenta consultar pelo endpoint de QRCode
    const checkUrl = `${PIXUP_URL}/v2/pix/qrcode/${txid}`;
    console.log("Consultando URL:", checkUrl);

    const checkResponse = await fetch(checkUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const responseText = await checkResponse.text();
    console.log("Resposta Bruta Pixup:", responseText);

    // Se a Pixup devolveu erro (ex: 404 ou 500), mostramos o que foi
    if (!checkResponse.ok) {
        return NextResponse.json({ 
            error: `Erro Consulta Pixup: ${checkResponse.status}`, 
            details: responseText 
        }, { status: 400 });
    }

    let pixupData;
    try {
        pixupData = JSON.parse(responseText);
    } catch (e) {
        return NextResponse.json({ error: 'Pixup não retornou JSON', details: responseText }, { status: 400 });
    }

    // 5. Liberação
    const isPaid = pixupData.status === 'PAID' || pixupData.status === 'COMPLETED' || pixupData.status === 'approved';

    if (isPaid) {
        if (depositData.userId) {
            const userRef = doc(db, 'users', depositData.userId);
            await updateDoc(userRef, { balance: increment(depositData.amount) });
        }
        
        await updateDoc(depositDoc.ref, { 
            status: 'completed', 
            paidAt: new Date(), 
            method: 'manual_check_v2' 
        });

        return NextResponse.json({ status: 'PAID', message: 'Liberado com sucesso!' });
    }

    return NextResponse.json({ 
        status: 'PENDING', 
        message: `Status na Pixup: ${pixupData.status || 'Desconhecido'}`,
        debug: pixupData 
    });

  } catch (error: any) {
    return NextResponse.json({ error: `Erro Interno: ${error.message}` }, { status: 200 }); // Retorna 200 pra mostrar na tela
  }
}