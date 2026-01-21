import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

function gerarCpfFalso() {
  const r = () => Math.floor(Math.random() * 9);
  const n = [r(), r(), r(), r(), r(), r(), r(), r(), r()];
  let d1 = n.reduce((a, v, i) => a + v * (10 - i), 0) % 11;
  d1 = d1 < 2 ? 0 : 11 - d1;
  n.push(d1);
  let d2 = n.reduce((a, v, i) => a + v * (11 - i), 0) % 11;
  d2 = d2 < 2 ? 0 : 11 - d2;
  n.push(d2);
  return n.join('');
}

export async function POST(req: Request) {
  try {
    console.log("--- INICIANDO DEPÓSITO (CORREÇÃO WWW) ---");

    const PIXUP_URL = process.env.PIXUP_API_URL;
    const CLIENT_ID = process.env.PIXUP_CLIENT_ID;
    const CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET;

    // --- A CORREÇÃO ESTÁ AQUI: ADICIONAMOS O WWW ---
    const SEU_SITE = 'https://www.raspadourada.com'; 
    const WEBHOOK_URL = `${SEU_SITE}/api/webhook`;

    if (!PIXUP_URL || !CLIENT_ID || !CLIENT_SECRET) {
        return NextResponse.json({ error: 'Faltam chaves no .env.local' }, { status: 500 });
    }

    const { amount, email, userId } = await req.json();

    // 1. AUTENTICAÇÃO
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const authResponse = await fetch(`${PIXUP_URL}/v2/oauth/token`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials' })
    });

    const authData = await authResponse.json();
    if (!authResponse.ok || !authData.access_token) {
        throw new Error(`Falha Auth Pixup: ${JSON.stringify(authData)}`);
    }

    // 2. GERAR QR CODE
    const external_id = `raspa_${Date.now()}`;
    const cpfPagador = gerarCpfFalso(); 

    const qrResponse = await fetch(`${PIXUP_URL}/v2/pix/qrcode`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${authData.access_token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: parseFloat(amount),
            external_id: external_id,
            payerQuestion: "Creditos Raspa Dourada",
            postbackUrl: WEBHOOK_URL, // Agora aponta para www.raspadourada.com
            payer: {
                name: "Cliente Raspa Dourada",
                document: cpfPagador
            }
        })
    });

    const qrData = await qrResponse.json();

    if (!qrData.qrcode || !qrData.transactionId) {
        throw new Error(`Erro Pixup: ${JSON.stringify(qrData)}`);
    }

    // 3. SALVAR NO FIREBASE
    await addDoc(collection(db, 'deposits'), {
        txid: qrData.transactionId,
        external_id: external_id,
        userId: userId || 'anonimo',
        email: email || 'anonimo',
        amount: amount,
        status: 'pending',
        createdAt: serverTimestamp(),
        gateway: 'pixup',
        pixCopiaECola: qrData.qrcode
    });

    const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qrcode)}`;

    return NextResponse.json({
        qrcode_image: qrCodeImage,
        qrcode_text: qrData.qrcode,
        txid: qrData.transactionId
    });

  } catch (error: any) {
    console.error('ERRO FATAL:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}