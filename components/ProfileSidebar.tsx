'use client';

import { useState, useEffect } from 'react';
import { X, User as UserIcon, LogOut, PiggyBank, History, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, runTransaction, doc, serverTimestamp } from 'firebase/firestore';

interface ProfileSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    balance: number;
    onLogout: () => void;
}

export default function ProfileSidebar({ isOpen, onClose, user, balance, onLogout }: ProfileSidebarProps) {
    const [activeTab, setActiveTab] = useState<'PROFILE' | 'WITHDRAW' | 'HISTORY'>('PROFILE');
    
    // Estados do Saque
    const [pixKeyType, setPixKeyType] = useState<'CPF' | 'EMAIL' | 'TELEFONE' | 'ALEATORIA'>('CPF');
    const [pixKey, setPixKey] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState(''); 
    const [loadingWithdraw, setLoadingWithdraw] = useState(false);
    const [withdrawMessage, setWithdrawMessage] = useState({ type: '', text: '' });
    const [withdrawHistory, setWithdrawHistory] = useState<any[]>([]);

    // Formatação de Moeda
    const formatDisplayAmount = (rawValue: string) => {
        if (!rawValue) return 'R$ 0,00';
        const numberValue = parseInt(rawValue, 10) / 100;
        return numberValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const handleAmountChange = (e: any) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.replace(/^0+/, '');
        setWithdrawAmount(value);
    };

    const getActualAmount = () => {
        return withdrawAmount ? parseInt(withdrawAmount, 10) / 100 : 0;
    };

    // Carrega histórico
    useEffect(() => {
        if (user && activeTab === 'HISTORY') {
            const q = query(
                collection(db, 'withdrawals'),
                where('userId', '==', user.uid),
                orderBy('createdAt', 'desc')
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                setWithdrawHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            });
            return () => unsubscribe();
        }
    }, [user, activeTab]);

    // --- AQUI ESTÁ A CORREÇÃO CRÍTICA ---
    const handleWithdraw = async () => {
        setWithdrawMessage({ type: '', text: '' });
        const amountToWithdraw = getActualAmount();

        // Validações Básicas
        if (!pixKey) return setWithdrawMessage({ type: 'error', text: 'Digite sua chave Pix.' });
        if (amountToWithdraw <= 0) return setWithdrawMessage({ type: 'error', text: 'Valor inválido.' });
        if (amountToWithdraw < 10) return setWithdrawMessage({ type: 'error', text: 'Mínimo R$ 10,00.' }); // Ajuste conforme sua regra
        if (amountToWithdraw > balance) return setWithdrawMessage({ type: 'error', text: 'Saldo insuficiente.' });

        setLoadingWithdraw(true);

        try {
            // USANDO TRANSAÇÃO PARA GARANTIR SEGURANÇA
            await runTransaction(db, async (transaction) => {
                // 1. Ler o saldo atual do banco (para garantir que não mudou milésimos antes)
                const userRef = doc(db, 'users', user.uid);
                const userDoc = await transaction.get(userRef);

                if (!userDoc.exists()) throw "Usuário não encontrado.";
                
                const currentBalance = userDoc.data().balance || 0;

                // 2. Verificar saldo novamente dentro da transação
                if (currentBalance < amountToWithdraw) {
                    throw "Saldo insuficiente para realizar esta operação.";
                }

                // 3. Criar o documento de saque
                const newWithdrawRef = doc(collection(db, 'withdrawals'));
                transaction.set(newWithdrawRef, {
                    userId: user.uid,
                    userEmail: user.email,
                    amount: amountToWithdraw,
                    pixKeyType,
                    pixKey,
                    status: 'pending',
                    createdAt: Date.now()
                });

                // 4. SUBTRAIR O VALOR DO SALDO IMEDIATAMENTE
                transaction.update(userRef, {
                    balance: currentBalance - amountToWithdraw
                });
            });

            // Sucesso
            setWithdrawMessage({ type: 'success', text: 'Solicitação enviada! Valor descontado.' });
            setWithdrawAmount('');
            setPixKey('');
            
            // Redireciona para o histórico após 2 segundos
            setTimeout(() => {
                setWithdrawMessage({ type: '', text: '' });
                setActiveTab('HISTORY');
            }, 2000);

        } catch (error: any) {
            console.error("Erro no saque:", error);
            // Se for erro de string (nossos throws), mostra ele. Se não, erro genérico.
            const msg = typeof error === 'string' ? error : 'Erro ao processar. Tente novamente.';
            setWithdrawMessage({ type: 'error', text: msg });
        } finally {
            setLoadingWithdraw(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="bg-yellow-500/20 text-yellow-500 text-[10px] px-2 py-1 rounded-full font-bold uppercase">Pendente</span>;
            case 'paid': return <span className="bg-green-500/20 text-green-500 text-[10px] px-2 py-1 rounded-full font-bold uppercase">Pago</span>;
            case 'rejected': return <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-1 rounded-full font-bold uppercase">Recusado</span>;
            default: return null;
        }
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>

            <div className={`fixed inset-y-0 right-0 w-full md:w-[450px] bg-[#09090b] border-l border-white/10 z-[70] transform transition-transform duration-300 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-[#09090b]/95 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                            <UserIcon size={20} className="text-zinc-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-white leading-tight">{user?.email?.split('@')[0]}</h2>
                            <p className="text-xs text-zinc-500 font-medium">{user?.email}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex p-4 gap-2 bg-black/20">
                    <button onClick={() => setActiveTab('PROFILE')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'PROFILE' ? 'bg-[#ffc700] text-black shadow-lg' : 'bg-zinc-900 text-zinc-400'}`}>
                        <UserIcon size={14} /> Perfil
                    </button>
                    <button onClick={() => setActiveTab('WITHDRAW')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'WITHDRAW' ? 'bg-[#ffc700] text-black shadow-lg' : 'bg-zinc-900 text-zinc-400'}`}>
                        <PiggyBank size={14} /> Sacar
                    </button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'HISTORY' ? 'bg-[#ffc700] text-black shadow-lg' : 'bg-zinc-900 text-zinc-400'}`}>
                        <History size={14} /> Histórico
                    </button>
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto p-6">
                    
                    {activeTab === 'PROFILE' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 text-center relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-[#ffc700]"></div>
                                <span className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Saldo Disponível</span>
                                <h1 className="text-4xl font-black text-white mt-2 mb-1">
                                    R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </h1>
                            </div>
                            <button onClick={onLogout} className="w-full bg-zinc-900 hover:bg-red-900/30 text-zinc-400 hover:text-red-500 border border-zinc-800 hover:border-red-800 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all text-sm uppercase">
                                <LogOut size={18} /> Desconectar
                            </button>
                        </div>
                    )}

                    {activeTab === 'WITHDRAW' && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2">
                            <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20 flex gap-3">
                                <AlertTriangle className="text-yellow-500 flex-shrink-0" size={20} />
                                <p className="text-xs text-yellow-200/80 leading-relaxed">
                                    Saques processados em até 24h. O valor é descontado do seu saldo imediatamente.
                                </p>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Tipo de Chave</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {['CPF', 'EMAIL', 'TELEFONE', 'ALEATORIA'].map(type => (
                                            <button key={type} onClick={() => setPixKeyType(type as any)} className={`text-[10px] font-bold py-2 rounded border transition-all ${pixKeyType === type ? 'bg-[#ffc700] text-black border-[#ffc700]' : 'bg-zinc-950 text-zinc-500 border-zinc-800'}`}>
                                                {type === 'ALEATORIA' ? 'ALEATÓRIA' : type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Chave Pix</label>
                                    <input 
                                        type="text" 
                                        value={pixKey} 
                                        onChange={e => setPixKey(e.target.value)} 
                                        placeholder="Digite sua chave..."
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:border-[#ffc700] focus:outline-none transition-colors text-sm" 
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500 font-bold uppercase mb-2 block">Valor (R$)</label>
                                    <input 
                                        type="tel" 
                                        inputMode="numeric"
                                        value={formatDisplayAmount(withdrawAmount)} 
                                        onChange={handleAmountChange} 
                                        placeholder="R$ 0,00"
                                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:border-[#ffc700] focus:outline-none transition-colors text-xl font-bold" 
                                    />
                                </div>

                                {withdrawMessage.text && (
                                    <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${withdrawMessage.type === 'success' ? 'bg-green-500/20 text-green-500 border border-green-500/20' : 'bg-red-500/20 text-red-500 border border-red-500/20'}`}>
                                        {withdrawMessage.type === 'success' ? <CheckCircle2 size={16}/> : <AlertTriangle size={16}/>}
                                        {withdrawMessage.text}
                                    </div>
                                )}

                                <button disabled={loadingWithdraw} onClick={handleWithdraw} className="w-full bg-[#ffc700] hover:bg-[#e6b300] disabled:opacity-50 text-black font-black py-4 rounded-xl text-sm shadow-lg flex items-center justify-center gap-2 transition-all active:scale-95 uppercase tracking-wide">
                                    {loadingWithdraw ? <Loader2 className="animate-spin" size={18} /> : <PiggyBank size={18} />}
                                    CONFIRMAR SAQUE
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'HISTORY' && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                            {withdrawHistory.length > 0 ? (
                                withdrawHistory.map(item => (
                                    <div key={item.id} className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                                        <div>
                                            <span className="text-sm font-bold text-white block">R$ {Number(item.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                            <span className="text-[10px] text-zinc-500 uppercase">{item.pixKeyType === 'ALEATORIA' ? 'ALEATÓRIA' : item.pixKeyType} • {new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                                        </div>
                                        {getStatusBadge(item.status)}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 text-zinc-600 text-xs font-medium border-2 border-dashed border-zinc-800 rounded-xl">
                                    Nenhum saque ainda.
                                </div>
                            )}
                        </div>
                    )}

                </div>
            </div>
        </>
    );
}