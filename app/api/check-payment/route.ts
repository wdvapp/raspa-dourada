import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { txid } = await req.json();
    console.log("🔍 [AUTO-CHECK V2] Buscando:", txid);

    // 1. Configuração e Firebase
    const PIXUP_URL = process.env.PIXUP_API_URL;
    const CLIENT_ID = process.env.PIXUP_CLIENT_ID;
    const CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET;

    if (!PIXUP_URL) return NextResponse.json({ error: 'Configuração inválida na Vercel' }, { status: 500 });

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

    if (!authResponse.ok) return NextResponse.json({ error: 'Erro Auth Pixup' }, { status: 400 });
    const { access_token } = await authResponse.json();

    // 3. TENTATIVA MULTI-ROTAS (Aqui corrigimos o erro 405)
    let pixupData = null;
    let found = false;

    // Lista de Endpoints prováveis para CONSULTA (GET)
    // O erro 405 indicou que /qrcode/ID não aceita GET. Vamos tentar as alternativas padrão.
    const endpointsParaTestar = [
        `${PIXUP_URL}/v2/pix/orders/${txid}`,        // Padrão de mercado 1
        `${PIXUP_URL}/v2/pix/transactions/${txid}`,  // Padrão de mercado 2
        `${PIXUP_URL}/v2/pix/charges/${txid}`,       // Padrão de mercado 3
    ];

    console.log("--- Iniciando Varredura de Endpoints ---");

    for (const url of endpointsParaTestar) {
        if (found) break; // Se já achou, para.
        try {
            console.log(`Tentando: ${url}`);
            const resp = await fetch(url, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${access_token}` }
            });

            if (resp.ok) {
                pixupData = await resp.json();
                console.log(`✅ SUCESSO na URL: ${url}`);
                found = true;
            } else {
                console.log(`❌ Falha (${resp.status}) na URL: ${url}`);
            }
        } catch (e) {
            console.log(`Erro de conexão na URL: ${url}`);
        }
    }

    // TENTATIVA FINAL: Por External ID (Se as rotas por ID falharam)
    if (!found && depositData.external_id) {
        console.log("Tentando busca por External ID...");
        const urlExt = `${PIXUP_URL}/v2/pix/qrcode?external_id=${depositData.external_id}`;
        const respExt = await fetch(urlExt, {
             headers: { 'Authorization': `Bearer ${access_token}` }
        });
        if (respExt.ok) {
            const list = await respExt.json();
            if (Array.isArray(list) && list.length > 0) {
                pixupData = list[0];
                found = true;
            } else if (list && !Array.isArray(list)) {
                 pixupData = list;
                 found = true;
            }
        }
    }

    if (!found || !pixupData) {
        return NextResponse.json({ error: 'Não foi possível consultar o status em nenhum endpoint.' }, { status: 400 });
    }

    // 4. Liberação
    // Verifica status em qualquer formato que vier
    const status = pixupData.status || pixupData.tx?.status || pixupData.situacao || '';
    const isPaid = ['PAID', 'COMPLETED', 'APPROVED', 'CONCLUDED', 'ATIVA', 'CONCLUIDA'].includes(status.toUpperCase());

    if (isPaid) {
        if (depositData.userId) {
            const userRef = doc(db, 'users', depositData.userId);
            await updateDoc(userRef, { balance: increment(depositData.amount) });
        }
        await updateDoc(depositDoc.ref, { status: 'completed', paidAt: new Date(), method: 'manual_check_v3' });
        return NextResponse.json({ status: 'PAID', message: 'Pagamento confirmado!' });
    }

    return NextResponse.json({ status: 'PENDING', message: `Status atual: ${status || 'Pendente'}` });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}