'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, runTransaction, Timestamp } from 'firebase/firestore';
import { CheckCircle2, XCircle, Copy, ArrowLeft, AlertTriangle, Calendar, Wallet } from 'lucide-react';

export default function AdminWithdrawals() {
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'pending' | 'paid' | 'rejected'>('ALL');

  // CONEXÃO COM FIREBASE (TEMPO REAL)
  useEffect(() => {
    // Ordena por data de criação (do mais novo para o mais antigo)
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

  // --- FUNÇÃO PARA FORMATAR DATA (CORRIGE O "INVALID DATE") ---
  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'Data desconhecida';
    
    // Se for Timestamp do Firebase (tem .seconds)
    if (dateValue.seconds) {
        return new Date(dateValue.seconds * 1000).toLocaleString('pt-BR');
    }
    
    // Se for número (Date.now()) ou string
    return new Date(dateValue).toLocaleString('pt-BR');
  };

  // --- AÇÕES ---
  const handleApprove = async (id: string) => {
    if(!confirm("CONFIRMAÇÃO:\n\nVocê garante que JÁ FEZ o Pix para este usuário?\nAo clicar em OK, o saque será marcado como PAGO.")) return;
    
    try {
        await updateDoc(doc(db, 'withdrawals', id), { 
            status: 'paid', // Status oficial minúsculo
            paidAt: Date.now() 
        });
        alert("Saque marcado como PAGO com sucesso!");
    } catch (e) {
        alert("Erro ao aprovar.");
    }
  };

  const handleReject = async (item: any) => {
    const reason = prompt("Motivo da recusa (Isso devolve o dinheiro para o saldo do jogador):");
    if (!reason) return;
    
    try {
        await runTransaction(db, async (transaction) => {
            // 1. Atualiza o status do saque para rejected
            transaction.update(doc(db, 'withdrawals', item.id), { 
                status: 'rejected', 
                rejectionReason: reason 
            });
            // 2. Devolve o dinheiro para o usuário
            transaction.update(doc(db, 'users', item.userId), { 
                balance: increment(Number(item.amount)) 
            });
        });
        alert("Saque recusado e valor estornado.");
    } catch (error) {
        console.error(error);
        alert("Erro ao recusar.");
    }
  };

  // Lógica de Filtro
  const filteredList = withdrawals.filter(w => {
    if (filter === 'ALL') return true;
    return w.status === filter;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 text-white space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <button onClick={() => router.push('/admin')} className="bg-zinc-900 hover:bg-zinc-800 p-2 rounded-lg transition-colors border border-zinc-800">
                    <ArrowLeft size={24}/>
                </button>
                <div>
                    <h1 className="text-3xl font-black flex items-center gap-2">Gerenciar Saques</h1>
                    <p className="text-zinc-500">Controle financeiro e aprovação de pagamentos.</p>
                </div>
            </div>

            {/* FILTROS */}
            <div className="flex bg-zinc-900 p-1.5 rounded-xl border border-zinc-800">
                {[
                    { key: 'ALL', label: 'Todos' },
                    { key: 'pending', label: 'Pendentes' },
                    { key: 'paid', label: 'Pagos' },
                    { key: 'rejected', label: 'Recusados' }
                ].map((f) => (
                    <button 
                        key={f.key} 
                        onClick={() => setFilter(f.key as any)} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${filter === f.key ? 'bg-[#ffc700] text-black shadow-lg' : 'text-zinc-400 hover:text-white'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
        </div>

        {/* LISTA */}
        <div className="space-y-4">
            {loading ? (
                <div className="text-center py-20 text-zinc-500 animate-pulse">Carregando solicitações...</div>
            ) : filteredList.map((item) => (
                <div 
                    key={item.id} 
                    className={`relative overflow-hidden bg-zinc-900 border p-6 rounded-2xl flex flex-col lg:flex-row items-center justify-between gap-6 transition-all hover:border-zinc-700 ${item.status === 'pending' ? 'border-l-4 border-l-[#ffc700] border-y-zinc-800 border-r-zinc-800' : 'border-zinc-800 opacity-75 hover:opacity-100'}`}
                >
                    
                    {/* COLUNA 1: Valor e Info */}
                    <div className="flex items-center gap-4 w-full lg:w-auto">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${item.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' : item.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                            <Wallet size={24} />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-1">
                                <span className="flex items-center gap-1"><Calendar size={12}/> {formatDate(item.createdAt)}</span>
                                <span>•</span>
                                <span>{item.userEmail}</span>
                            </div>
                        </div>
                    </div>

                    {/* COLUNA 2: Chave Pix */}
                    <div className="bg-black/40 p-3 rounded-xl border border-zinc-800 w-full lg:w-1/3 flex items-center justify-between group">
                        <div className="overflow-hidden">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase block tracking-wider mb-0.5">Chave Pix ({item.pixKeyType || 'Desconhecida'})</span>
                            <span className="font-mono text-sm text-zinc-300 truncate block select-all group-hover:text-white transition-colors">
                                {item.pixKey}
                            </span>
                        </div>
                        <button 
                            onClick={() => {navigator.clipboard.writeText(item.pixKey); alert('Chave Pix Copiada!');}} 
                            className="p-2 text-[#ffc700] hover:bg-[#ffc700]/10 rounded-lg transition-colors" 
                            title="Copiar Chave"
                        >
                            <Copy size={18}/>
                        </button>
                    </div>

                    {/* COLUNA 3: Ações (Botões ou Status) */}
                    <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                        {item.status === 'pending' ? (
                            <>
                                <button 
                                    onClick={() => handleReject(item)} 
                                    className="flex-1 lg:flex-none px-4 py-3 bg-zinc-950 border border-zinc-800 hover:bg-red-900/20 hover:border-red-900/50 text-zinc-400 hover:text-red-500 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-2 transition-all"
                                >
                                    <XCircle size={18} /> Recusar
                                </button>
                                <button 
                                    onClick={() => handleApprove(item.id)} 
                                    className="flex-1 lg:flex-none px-6 py-3 bg-[#ffc700] hover:bg-[#e6b300] text-black rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10 transition-all active:scale-95"
                                >
                                    <CheckCircle2 size={18} /> Aprovar Pagto
                                </button>
                            </>
                        ) : (
                            <div className={`px-4 py-2 rounded-lg font-bold text-xs uppercase flex items-center gap-2 ${item.status === 'paid' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                {item.status === 'paid' ? <><CheckCircle2 size={16}/> PAGO</> : <><AlertTriangle size={16}/> RECUSADO</>}
                            </div>
                        )}
                    </div>

                </div>
            ))}

            {filteredList.length === 0 && !loading && (
                <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
                    <p className="text-zinc-500 font-medium">Nenhuma solicitação encontrada nesta aba.</p>
                </div>
            )}
        </div>
    </div>
  );
}