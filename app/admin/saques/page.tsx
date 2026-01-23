'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { CheckCircle2, XCircle, Copy, ArrowLeft, Search, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminWithdrawals() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'pending' | 'paid' | 'rejected'>('pending');

  // CONEXÃO DIRETA COM O FIREBASE (TEMPO REAL)
  useEffect(() => {
    // Escuta a coleção 'withdrawals' ordenando por data
    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setWithdrawals(list);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  // Copiar chave Pix
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Chave Pix copiada!");
  };

  // Ações Manuais (já que o automático da Pixup precisa de credencial)
  const handleManualApprove = async (id: string) => {
    if(!confirm("Marcar como PAGO? (Certifique-se que já fez o Pix)")) return;
    await updateDoc(doc(db, 'withdrawals', id), { status: 'paid', paidAt: Date.now() });
  };

  const handleManualReject = async (item: any) => {
    const reason = prompt("Motivo da recusa:");
    if (!reason) return;
    
    // Devolve o dinheiro pro usuário
    await runTransaction(db, async (transaction) => {
        const wRef = doc(db, 'withdrawals', item.id);
        const uRef = doc(db, 'users', item.userId);
        transaction.update(wRef, { status: 'rejected', rejectionReason: reason });
        transaction.update(uRef, { balance: increment(item.amount) });
    });
  };

  const filteredList = withdrawals.filter(w => filter === 'ALL' ? true : w.status === filter);

  return (
    <div className="max-w-6xl mx-auto p-6 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2"><ArrowLeft className="cursor-pointer" onClick={() => router.back()}/> Gerenciar Saques</h1>
                <p className="text-zinc-500 text-sm">Lista em tempo real do Firebase.</p>
            </div>
            <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl">
                {['pending', 'paid', 'rejected', 'ALL'].map(f => (
                    <button key={f} onClick={() => setFilter(f as any)} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${filter === f ? 'bg-[#ffc700] text-black' : 'text-zinc-400'}`}>
                        {f === 'ALL' ? 'Todos' : f === 'pending' ? 'Pendentes' : f === 'paid' ? 'Pagos' : 'Recusados'}
                    </button>
                ))}
            </div>
        </div>

        <div className="space-y-4">
            {loading ? <p>Carregando solicitações...</p> : filteredList.map(item => (
                <div key={item.id} className={`bg-zinc-900 border p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 ${item.status === 'pending' ? 'border-yellow-500/30' : 'border-zinc-800 opacity-60'}`}>
                    <div>
                        <p className="text-2xl font-black">R$ {item.amount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        <p className="text-xs text-zinc-400">{item.userEmail} • {new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    
                    <div className="bg-black/40 p-3 rounded-lg border border-zinc-800 flex items-center gap-4 min-w-[300px] justify-between">
                        <div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Chave {item.pixKeyType}</span>
                            <span className="font-mono text-sm">{item.pixKey}</span>
                        </div>
                        <button onClick={() => copyToClipboard(item.pixKey)} className="text-[#ffc700]"><Copy size={16}/></button>
                    </div>

                    {item.status === 'pending' && (
                        <div className="flex gap-2">
                            <button onClick={() => handleManualReject(item)} className="bg-zinc-800 hover:text-red-500 px-4 py-3 rounded-xl font-bold text-xs uppercase">Recusar</button>
                            <button onClick={() => handleManualApprove(item.id)} className="bg-[#ffc700] text-black px-6 py-3 rounded-xl font-bold text-xs uppercase">Aprovar Manualmente</button>
                        </div>
                    )}
                    {item.status !== 'pending' && <span className={`text-xs font-bold uppercase px-3 py-1 rounded ${item.status === 'paid' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{item.status === 'paid' ? 'Pago' : 'Recusado'}</span>}
                </div>
            ))}
            {filteredList.length === 0 && <p className="text-center text-zinc-500 py-10">Nenhuma solicitação encontrada.</p>}
        </div>
    </div>
  );
}