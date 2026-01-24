'use client';

import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
// Adicionei 'doc', 'getDoc', 'updateDoc' nos imports do Firestore
import { collection, query, orderBy, limit, onSnapshot, where, doc, getDoc, updateDoc } from 'firebase/firestore';
// Adicionei 'Megaphone', 'Gift', 'Save', 'Send', 'Loader2' nos ícones
import { DollarSign, Users, TrendingUp, Calendar, ArrowUpRight, Megaphone, Gift, Save, Send, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  // --- ESTADOS ORIGINAIS (DASHBOARD) ---
  const [stats, setStats] = useState({
    todayRevenue: 0,
    weekRevenue: 0,
    totalUsers: 0
  });
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // --- NOVOS ESTADOS (MARKETING & NOTIFICAÇÕES) ---
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [loadingBonus, setLoadingBonus] = useState(false);

  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingPush, setSendingPush] = useState(false);

  useEffect(() => {
    // 1. CARREGAR CONFIGURAÇÃO ATUAL DO BÔNUS (daily_gift)
    const loadConfig = async () => {
        try {
            const docRef = doc(db, 'config', 'daily_gift');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBonusActive(data.active);
                setBonusAmount(data.amount);
            }
        } catch (e) {
            console.error("Erro ao ler config de bônus", e);
        }
    };
    loadConfig();

    // 2. MONITORAR DEPÓSITOS (Original)
    const qDeposits = query(collection(db, 'deposits'), where('status', '==', 'completed'));
    const unsubscribeDeposits = onSnapshot(qDeposits, (snapshot) => {
      let today = 0;
      let week = 0;
      const now = new Date();
      const startOfDay = new Date(now.setHours(0,0,0,0));
      const startOfWeek = new Date(now.setDate(now.getDate() - 7));

      const depositsList: any[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const amount = Number(data.amount) || 0;
        const date = data.paidAt ? new Date(data.paidAt.seconds * 1000 || data.paidAt) : new Date();

        if (date >= startOfDay) today += amount;
        if (date >= startOfWeek) week += amount;

        depositsList.push({ id: doc.id, ...data, paidAt: date });
      });

      depositsList.sort((a, b) => b.paidAt - a.paidAt);
      setRecentDeposits(depositsList.slice(0, 5));
      setStats(prev => ({ ...prev, todayRevenue: today, weekRevenue: week }));
    });

    // 3. MONITORAR USUÁRIOS (Original)
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc')); 
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
      setRecentUsers(snapshot.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubscribeDeposits();
      unsubscribeUsers();
    };
  }, []);

  // --- FUNÇÃO: SALVAR BÔNUS ---
  const handleSaveBonus = async () => {
    setLoadingBonus(true);
    try {
      // Salva na coleção 'config', documento 'daily_gift'
      await updateDoc(doc(db, 'config', 'daily_gift'), {
        active: bonusActive,
        amount: Number(bonusAmount)
      });
      alert('✅ Bônus diário atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar configuração.');
    }
    setLoadingBonus(false);
  };

  // --- FUNÇÃO: ENVIAR NOTIFICAÇÃO (PUSH) ---
  const handleSendPush = async () => {
    if (!notifTitle || !notifBody) return alert('Preencha título e mensagem.');
    if (!confirm(`Enviar essa notificação para TODOS os usuários?`)) return;

    setSendingPush(true);
    try {
      // Chama a API que criamos (o motor)
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('🚀 Notificação enviada para todos!');
        setNotifTitle('');
        setNotifBody('');
      } else {
        alert('Erro no envio: ' + JSON.stringify(data));
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão com a API.');
    }
    setSendingPush(false);
  };

  if (loading) return <div className="text-white text-center p-10">Carregando dados da empresa...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black text-white">Dashboard</h1>
            <p className="text-zinc-500">Visão geral e controle da plataforma.</p>
        </div>
      </div>

      {/* CARDS DE FATURAMENTO (ORIGINAL) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-green-900 to-green-950 border border-green-800 p-8 rounded-3xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <DollarSign size={100} />
            </div>
            <p className="text-green-400 font-bold uppercase tracking-wider text-sm mb-2 flex items-center gap-2">
                <TrendingUp size={16} /> Faturamento Hoje
            </p>
            <h2 className="text-5xl font-black text-white">
                R$ {stats.todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h2>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <Calendar size={100} className="text-[#ffc700]" />
            </div>
            <p className="text-zinc-500 font-bold uppercase tracking-wider text-sm mb-2">
                Últimos 7 Dias
            </p>
            <h2 className="text-5xl font-black text-white">
                R$ {stats.weekRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </h2>
        </div>
      </div>

      {/* ================================================================================= */}
      {/* NOVA SEÇÃO: CENTRAL DE MARKETING */}
      {/* ================================================================================= */}
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-8">
          <Megaphone className="text-purple-500" /> Central de Marketing
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* CONTROLE DO BÔNUS DIÁRIO */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                <div className="p-3 bg-purple-500/20 rounded-full text-purple-400"><Gift size={24} /></div>
                <div>
                    <h3 className="text-lg font-bold text-white">Bônus Diário (Caixa Surpresa)</h3>
                    <p className="text-xs text-zinc-500">Configure quanto o usuário ganha por dia.</p>
                </div>
            </div>

            <div className="space-y-5">
                <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-zinc-700/50">
                    <span className="font-medium text-zinc-300">Campanha Ativa?</span>
                    <button 
                    onClick={() => setBonusActive(!bonusActive)}
                    className={`w-14 h-8 rounded-full transition-colors relative ${bonusActive ? 'bg-green-500' : 'bg-zinc-700'}`}
                    >
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${bonusActive ? 'left-7' : 'left-1'}`}></div>
                    </button>
                </div>

                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Valor do Prêmio (R$)</label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">R$</span>
                        <input 
                        type="number" 
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(Number(e.target.value))}
                        className="w-full bg-black/20 border border-zinc-700 rounded-xl py-3 pl-12 pr-4 text-white font-bold text-lg focus:border-purple-500 outline-none transition-all"
                        placeholder="0.00"
                        />
                    </div>
                </div>

                <button 
                    onClick={handleSaveBonus}
                    disabled={loadingBonus}
                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mt-2 transition-all active:scale-95"
                >
                    {loadingBonus ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                    SALVAR ALTERAÇÕES
                </button>
            </div>
          </div>

          {/* CONTROLE DE NOTIFICAÇÕES (PUSH) */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                <div className="p-3 bg-yellow-500/20 rounded-full text-yellow-500"><Megaphone size={24} /></div>
                <div>
                    <h3 className="text-lg font-bold text-white">Enviar Notificação</h3>
                    <p className="text-xs text-zinc-500">Dispara alerta para celular e sininho de todos.</p>
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Título</label>
                    <input 
                    type="text" 
                    placeholder="Ex: Bônus de Depósito!"
                    value={notifTitle}
                    onChange={(e) => setNotifTitle(e.target.value)}
                    className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none transition-all placeholder:text-zinc-600"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Mensagem</label>
                    <textarea 
                    rows={2}
                    placeholder="Ex: Deposite hoje e ganhe o dobro..."
                    value={notifBody}
                    onChange={(e) => setNotifBody(e.target.value)}
                    className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none resize-none transition-all placeholder:text-zinc-600"
                    />
                </div>

                <button 
                    onClick={handleSendPush}
                    disabled={sendingPush}
                    className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 mt-2 transition-all active:scale-95"
                >
                    {sendingPush ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                    ENVIAR PARA TODOS
                </button>
            </div>
          </div>

      </div>
      {/* ================================================================================= */}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LISTA DE DEPÓSITOS RECENTES (ORIGINAL) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2"><DollarSign className="text-green-500" size={20}/> Últimos Depósitos</h3>
            </div>
            <div className="divide-y divide-zinc-800">
                {recentDeposits.length > 0 ? recentDeposits.map((deposit) => (
                    <div key={deposit.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                        <div>
                            <p className="text-white font-bold text-lg">R$ {Number(deposit.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            <p className="text-xs text-zinc-500">
                                {deposit.paidAt ? new Date(deposit.paidAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : 'Processando'}
                            </p>
                        </div>
                        <span className="text-xs font-mono text-zinc-600 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                            {deposit.userEmail || 'Anônimo'}
                        </span>
                    </div>
                )) : (
                    <div className="p-8 text-center text-zinc-500 text-sm">Nenhum depósito hoje.</div>
                )}
            </div>
        </div>

        {/* LISTA DE NOVOS USUÁRIOS (ORIGINAL) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2"><Users className="text-[#ffc700]" size={20}/> Novos Usuários ({stats.totalUsers})</h3>
            </div>
            <div className="divide-y divide-zinc-800">
                {recentUsers.length > 0 ? recentUsers.map((user) => (
                    <div key={user.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-[#ffc700]">
                                {user.email ? user.email.substring(0,2).toUpperCase() : 'U'}
                            </div>
                            <div>
                                <p className="text-white font-medium text-sm">{user.email || 'Sem e-mail'}</p>
                                <p className="text-[10px] text-zinc-500">
                                    Cadastrado em {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desconhecida'}
                                </p>
                            </div>
                        </div>
                        {user.balance > 0 && (
                            <span className="text-xs font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded">
                                R$ {user.balance.toFixed(2)}
                            </span>
                        )}
                    </div>
                )) : (
                    <div className="p-8 text-center text-zinc-500 text-sm">Nenhum usuário cadastrado.</div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
}