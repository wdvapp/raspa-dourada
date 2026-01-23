'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { CheckCircle2, XCircle, Copy, ArrowLeft, AlertTriangle, Calendar, Wallet } from 'lucide-react';

export default function AdminWithdrawals() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // PADRÃO: Começa sempre em PENDENTE
  const [filter, setFilter] = useState<'pending' | 'paid' | 'rejected'>('pending');

  useEffect(() => {
    const q = query(collection(db, 'withdrawals'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setWithdrawals(list);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const formatDate = (dateValue: any) => {
    if (!dateValue) return '--/--';
    if (dateValue.seconds) return new Date(dateValue.seconds * 1000).toLocaleString('pt-BR');
    return new Date(dateValue).toLocaleString('pt-BR');
  };

  const handleApprove = async (id: string) => {
    if(!confirm("Tem certeza que enviou o PIX?")) return;
    try {
        await updateDoc(doc(db, 'withdrawals', id), { status: 'paid', paidAt: Date.now() });
    } catch (e) { alert("Erro ao salvar."); }
  };

  const handleReject = async (item: any) => {
    const reason = prompt("Motivo da recusa:");
    if (!reason) return;
    try {
        await runTransaction(db, async (transaction) => {
            transaction.update(doc(db, 'withdrawals', item.id), { status: 'rejected', rejectionReason: reason });
            transaction.update(doc(db, 'users', item.userId), { balance: increment(Number(item.amount)) });
        });
    } catch (error) { alert("Erro ao recusar."); }
  };

  // FILTRO ESTRITO (Sem aba "Todos")
  const filteredList = withdrawals.filter(w => {
    const status = w.status ? w.status.toLowerCase() : 'pending';
    return status === filter;
  });

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 text-white space-y-6 animate-in fade-in duration-500">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/admin')} className="bg-zinc-900 hover:bg-zinc-800 p-2 rounded-lg border border-zinc-800">
                    <ArrowLeft size={24}/>
                </button>
                <div>
                    <h1 className="text-2xl md:text-3xl font-black">Gerenciar Saques</h1>
                </div>
            </div>

            {/* ABAS (SOMENTE AS 3 NECESSÁRIAS) */}
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 w-full md:w-auto">
                {[
                    { key: 'pending', label: 'Pendentes' },
                    { key: 'paid', label: 'Pagos' },
                    { key: 'rejected', label: 'Recusados' }
                ].map((f) => (
                    <button 
                        key={f.key} 
                        onClick={() => setFilter(f.key as any)} 
                        className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === f.key ? 'bg-[#ffc700] text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
        </div>

        {/* LISTA */}
        <div className="space-y-4">
            {loading ? (
                <div className="text-center py-20 text-zinc-500">Carregando...</div>
            ) : filteredList.map((item) => (
                <div 
                    key={item.id} 
                    className={`bg-zinc-900 border p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center gap-5 transition-all ${item.status === 'pending' ? 'border-yellow-500/30' : 'border-zinc-800 opacity-80'}`}
                >
                    
                    {/* INFO PRINCIPAL */}
                    <div className="flex items-center gap-4 w-full md:w-auto min-w-[200px]">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${item.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : item.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            <Wallet size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                            <div className="text-xs text-zinc-500 flex flex-col">
                                <span>{formatDate(item.createdAt)}</span>
                                <span className="truncate max-w-[150px]">{item.userEmail}</span>
                            </div>
                        </div>
                    </div>

                    {/* CHAVE PIX (ADAPTÁVEL AO MOBILE) */}
                    <div className="bg-black/40 p-3 rounded-xl border border-zinc-800 w-full md:flex-1 flex items-center justify-between gap-3">
                        <div className="w-full overflow-hidden">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase block">Chave {item.pixKeyType}</span>
                            {/* break-all impede que chaves longas estourem a tela */}
                            <p className="font-mono text-sm text-white break-all select-all leading-tight">
                                {item.pixKey}
                            </p>
                        </div>
                        <button 
                            onClick={() => {navigator.clipboard.writeText(item.pixKey); alert('Copiado!');}} 
                            className="p-2 text-[#ffc700] hover:bg-[#ffc700]/10 rounded-lg flex-shrink-0"
                        >
                            <Copy size={18}/>
                        </button>
                    </div>

                    {/* BOTÕES DE AÇÃO (LARGURA TOTAL NO MOBILE) */}
                    <div className="w-full md:w-auto flex gap-2">
                        {item.status === 'pending' ? (
                            <>
                                <button 
                                    onClick={() => handleReject(item)} 
                                    className="flex-1 md:flex-none px-4 py-3 bg-zinc-950 border border-zinc-800 text-red-500 rounded-xl font-bold text-xs uppercase flex justify-center gap-2 hover:bg-red-950/30"
                                >
                                    <XCircle size={18} /> Recusar
                                </button>
                                <button 
                                    onClick={() => handleApprove(item.id)} 
                                    className="flex-[2] md:flex-none px-6 py-3 bg-[#ffc700] text-black rounded-xl font-black text-xs uppercase flex justify-center gap-2 hover:bg-[#e6b300] active:scale-95 transition-transform"
                                >
                                    <CheckCircle2 size={18} /> Aprovar
                                </button>
                            </>
                        ) : (
                            <div className={`w-full text-center px-4 py-2 rounded-lg font-bold text-xs uppercase border ${item.status === 'paid' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}`}>
                                {item.status === 'paid' ? 'PAGO' : `RECUSADO: ${item.rejectionReason || '-'}`}
                            </div>
                        )}
                    </div>

                </div>
            ))}

            {filteredList.length === 0 && !loading && (
                <div className="text-center py-10 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-500 text-sm">
                    Nenhuma solicitação {filter === 'pending' ? 'pendente' : filter === 'paid' ? 'paga' : 'recusada'}.
                </div>
            )}
        </div>
    </div>
  );
}