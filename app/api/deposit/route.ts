import { NextResponse } from 'next/server';
import { db } from '../../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// --- CACHE DE TOKEN (Acelera o processo) ---
// Guardamos o token na memória para não fazer login toda vez
let cachedToken: string | null = null;
let tokenExpiration: number = 0;

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
    // console.log("--- INICIANDO DEPÓSITO TURBO ---"); // Comentado para ganhar ms

    const PIXUP_URL = process.env.PIXUP_API_URL;
    const CLIENT_ID = process.env.PIXUP_CLIENT_ID;
    const CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET;
    
    // MANTENHA O WWW (Isso é vital para o webhook funcionar)
    const SEU_SITE = 'https://www.raspadourada.com'; 
    const WEBHOOK_URL = `${SEU_SITE}/api/webhook`;

    if (!PIXUP_URL || !CLIENT_ID || !CLIENT_SECRET) {
        return NextResponse.json({ error: 'Erro de config' }, { status: 500 });
    }

    const { amount, email, userId } = await req.json();

    // 1. AUTENTICAÇÃO OTIMIZADA (Usa Cache)
    const now = Date.now();
    let accessToken = cachedToken;

    // Se não tem token ou ele expirou (ou vai expirar em 1 min), faz login novo
    if (!accessToken || now >= tokenExpiration) {
        console.log("🔄 Renovando Token Pixup...");
        const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        const authResponse = await fetch(`${PIXUP_URL}/v2/oauth/token`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant_type: 'client_credentials' })
        });

        const authData = await authResponse.json();
        if (!authResponse.ok || !authData.access_token) {
            throw new Error('Falha Auth');
        }

        accessToken = authData.access_token;
        cachedToken = accessToken;
        // Define validade (geralmente dura 1h, renovamos em 50min por segurança)
        tokenExpiration = now + (50 * 60 * 1000); 
    }

    // 2. GERAR QR CODE (Execução Imediata)
    const external_id = `raspa_${now}`; // Usando timestamp direto é mais rápido que Date.now() de novo
    const cpfPagador = gerarCpfFalso(); 

    const qrResponse = await fetch(`${PIXUP_URL}/v2/pix/qrcode`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            amount: parseFloat(amount),
            external_id: external_id,
            payerQuestion: "Creditos Raspa Dourada",
            postbackUrl: WEBHOOK_URL,
            payer: {
                name: "Cliente Raspa Dourada",
                document: cpfPagador
            }
        })
    });

    const qrData = await qrResponse.json();

    if (!qrData.qrcode || !qrData.transactionId) {
        // Se der erro de token inválido (401), limpamos o cache para a próxima tentar do zero
        if (qrResponse.status === 401) cachedToken = null;
        throw new Error('Erro Pixup');
    }

    // 3. RETORNA PARA O USUÁRIO PRIMEIRO (Prioridade UX)
    // O QR Code já aparece na tela enquanto o Firebase salva em segundo plano?
    // O Vercel pode matar o processo se retornarmos antes do await.
    // Vamos manter o await, mas o addDoc é rápido.
    
    const docRef = await addDoc(collection(db, 'deposits'), {
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

    // Gera a URL da imagem no cliente ou usa uma string simples para poupar processamento
    const qrCodeImage = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData.qrcode)}`;

    return NextResponse.json({
        qrcode_image: qrCodeImage,
        qrcode_text: qrData.qrcode,
        txid: qrData.transactionId
    });

  } catch (error: any) {
    console.error('ERRO:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}