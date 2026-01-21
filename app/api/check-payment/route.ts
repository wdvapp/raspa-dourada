import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, increment, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { txid } = await req.json();
    console.log("🔍 Verificando status do Pix:", txid);

    // 1. Busca o depósito no seu banco
    const depositsRef = collection(db, 'deposits');
    const q = query(depositsRef, where('txid', '==', txid));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return NextResponse.json({ error: 'Depósito não encontrado' }, { status: 404 });
    }

    const depositDoc = querySnapshot.docs[0];
    const depositData = depositDoc.data();

    // Se já estiver pago no seu banco, retorna sucesso
    if (depositData.status === 'completed') {
        return NextResponse.json({ status: 'PAID', message: 'Já estava pago' });
    }

    // 2. Pergunta para a Pixup se realmente pagou
    const PIXUP_URL = process.env.PIXUP_API_URL;
    const CLIENT_ID = process.env.PIXUP_CLIENT_ID;
    const CLIENT_SECRET = process.env.PIXUP_CLIENT_SECRET;

    // Autenticação
    const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    const authResponse = await fetch(`${PIXUP_URL}/v2/oauth/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ grant_type: 'client_credentials' })
    });
    const authData = await authResponse.json();
    const token = authData.access_token;

    // Consulta o Status na Pixup (Usando o endpoint de consulta por txid)
    // NOTA: Se a URL da Pixup for diferente para consulta, ajustaremos aqui.
    // Geralmente é GET /v2/pix/qrcode/{txid} ou /v2/pix/orders/{txid}
    const checkResponse = await fetch(`${PIXUP_URL}/v2/pix/qrcode/${txid}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const pixupData = await checkResponse.json();
    console.log("RESPOSTA PIXUP:", pixupData);

    // 3. Se a Pixup disser que pagou, libera o saldo AGORA
    const isPaid = pixupData.status === 'PAID' || pixupData.status === 'COMPLETED' || pixupData.status === 'approved';

    if (isPaid) {
        // Atualiza usuário
        if (depositData.userId) {
            const userRef = doc(db, 'users', depositData.userId);
            await updateDoc(userRef, { balance: increment(depositData.amount) });
        }
        
        // Atualiza depósito
        await updateDoc(depositDoc.ref, { 
            status: 'completed', 
            paidAt: new Date(),
            method: 'manual_check'
        });

        return NextResponse.json({ status: 'PAID', message: 'Pagamento confirmado e saldo liberado!' });
    }

    return NextResponse.json({ status: 'PENDING', message: 'Ainda aguardando pagamento...' });

  } catch (error: any) {
    console.error("Erro na verificação:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}