'use client';

import { useEffect, useState } from 'react';
import { db, app } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, TrendingUp, Calendar, Megaphone, Gift, Save, Send, Loader2, Lock } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true); // Novo estado para loading da tela

  // --- ESTADOS DO DASHBOARD ---
  const [stats, setStats] = useState({ todayRevenue: 0, weekRevenue: 0, totalUsers: 0 });
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // --- ESTADOS DE MARKETING ---
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [loadingBonus, setLoadingBonus] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [sendingPush, setSendingPush] = useState(false);

  // --- 1. VERIFICAÇÃO PROFISSIONAL (RBAC) ---
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // O usuário está logado, agora vamos ver se ele é CHEFE no banco de dados
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userDocRef);

            if (userSnap.exists() && userSnap.data().role === 'admin') {
                // É patrão! Libera o acesso.
                setIsAuthorized(true);
            } else {
                // É usuário comum tentando ser esperto. Tchau.
                router.push('/');
            }
        } catch (error) {
            console.error("Erro ao verificar permissão:", error);
            router.push('/');
        }
      } else {
        // Nem logado está
        router.push('/'); 
      }
      setCheckingAuth(false);
    });

    return () => unsubscribeAuth();
  }, [router]);

  // --- 2. CARREGAMENTO DE DADOS (SÓ RODA SE FOR ADMIN) ---
  useEffect(() => {
    if (!isAuthorized) return;
    setLoadingData(true);

    const loadConfig = async () => {
        try {
            const docRef = doc(db, 'config', 'daily_gift');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBonusActive(data.active);
                setBonusAmount(data.amount);
            }
        } catch (e) { console.error(e); }
    };
    loadConfig();

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

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc')); 
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      setStats(prev => ({ ...prev, totalUsers: snapshot.size }));
      setRecentUsers(snapshot.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingData(false);
    });

    return () => { unsubscribeDeposits(); unsubscribeUsers(); };
  }, [isAuthorized]);

  const handleSaveBonus = async () => {
    setLoadingBonus(true);
    try {
      await updateDoc(doc(db, 'config', 'daily_gift'), { active: bonusActive, amount: Number(bonusAmount) });
      alert('✅ Atualizado!');
    } catch (error) { alert('Erro ao salvar.'); }
    setLoadingBonus(false);
  };

  const handleSendPush = async () => {
    if (!notifTitle || !notifBody) return alert('Preencha tudo.');
    if (!confirm(`Enviar para TODOS?`)) return;
    setSendingPush(true);
    try {
      const res = await fetch('/api/send-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: notifTitle, body: notifBody })
      });
      const data = await res.json();
      if (data.success) { alert('🚀 Enviado!'); setNotifTitle(''); setNotifBody(''); } 
      else { alert('Erro: ' + JSON.stringify(data)); }
    } catch (error) { alert('Erro de conexão.'); }
    setSendingPush(false);
  };

  // TELA DE VERIFICAÇÃO (Loading seguro)
  if (checkingAuth) {
      return (
          <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin text-purple-500" size={40} />
              <p className="text-zinc-500 text-sm font-medium">Verificando credenciais de administrador...</p>
          </div>
      );
  }

  // Se não estiver autorizado, o useEffect já chutou para a Home, mas retornamos null por segurança
  if (!isAuthorized) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 p-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-2"><Lock className="text-green-500 mb-1" size={28}/> Painel Administrativo</h1>
            <p className="text-zinc-500">Gestão completa da plataforma.</p>
        </div>
      </div>

      {/* CARDS DE FATURAMENTO */}
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

      {/* CENTRAL DE MARKETING */}
      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-4">
          <Megaphone className="text-purple-500" /> Central de Marketing
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CONTROLE DO BÔNUS */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                <div className="p-3 bg-purple-500/20 rounded-full text-purple-400"><Gift size={24} /></div>
                <div>
                    <h3 className="text-lg font-bold text-white">Bônus Diário</h3>
                    <p className="text-xs text-zinc-500">Valor que o usuário ganha a cada 24h.</p>
                </div>
            </div>
            <div className="space-y-5">
                <div className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-zinc-700/50">
                    <span className="font-medium text-zinc-300">Campanha Ativa?</span>
                    <button onClick={() => setBonusActive(!bonusActive)} className={`w-14 h-8 rounded-full transition-colors relative ${bonusActive ? 'bg-green-500' : 'bg-zinc-700'}`}>
                    <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${bonusActive ? 'left-7' : 'left-1'}`}></div>
                    </button>
                </div>
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Valor (R$)</label>
                    <input type="number" value={bonusAmount} onChange={(e) => setBonusAmount(Number(e.target.value))} className="w-full bg-black/20 border border-zinc-700 rounded-xl py-3 px-4 text-white font-bold text-lg focus:border-purple-500 outline-none" />
                </div>
                <button onClick={handleSaveBonus} disabled={loadingBonus} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mt-2 transition-all active:scale-95">
                    {loadingBonus ? <Loader2 className="animate-spin" /> : <Save size={18} />} SALVAR
                </button>
            </div>
          </div>

          {/* ENVIAR NOTIFICAÇÃO */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                <div className="p-3 bg-yellow-500/20 rounded-full text-yellow-500"><Megaphone size={24} /></div>
                <div>
                    <h3 className="text-lg font-bold text-white">Enviar Notificação</h3>
                    <p className="text-xs text-zinc-500">Dispara para celular e sininho de todos.</p>
                </div>
            </div>
            <div className="space-y-4">
                <input type="text" placeholder="Título" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none" />
                <textarea rows={2} placeholder="Mensagem" value={notifBody} onChange={(e) => setNotifBody(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none resize-none" />
                <button onClick={handleSendPush} disabled={sendingPush} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 mt-2 transition-all active:scale-95">
                    {sendingPush ? <Loader2 className="animate-spin" /> : <Send size={18} />} ENVIAR PARA TODOS
                </button>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        {/* LISTA DE DEPÓSITOS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><DollarSign className="text-green-500" size={20}/> Últimos Depósitos</h3></div>
            <div className="divide-y divide-zinc-800">
                {recentDeposits.length > 0 ? recentDeposits.map((deposit) => (
                    <div key={deposit.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                        <div><p className="text-white font-bold text-lg">R$ {Number(deposit.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-zinc-500">{deposit.paidAt ? new Date(deposit.paidAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : 'Processando'}</p></div>
                        <span className="text-xs font-mono text-zinc-600 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">{deposit.userEmail || 'Anônimo'}</span>
                    </div>
                )) : <div className="p-8 text-center text-zinc-500 text-sm">Nenhum depósito hoje.</div>}
            </div>
        </div>
        {/* LISTA DE USUÁRIOS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><Users className="text-[#ffc700]" size={20}/> Novos Usuários ({stats.totalUsers})</h3></div>
            <div className="divide-y divide-zinc-800">
                {recentUsers.length > 0 ? recentUsers.map((user) => (
                    <div key={user.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-[#ffc700]">{user.email ? user.email.substring(0,2).toUpperCase() : 'U'}</div>
                            <div><p className="text-white font-medium text-sm">{user.email || 'Sem e-mail'}</p><p className="text-[10px] text-zinc-500">Cadastrado em {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desconhecida'}</p></div>
                        </div>
                        {user.balance > 0 && <span className="text-xs font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded">R$ {user.balance.toFixed(2)}</span>}
                    </div>
                )) : <div className="p-8 text-center text-zinc-500 text-sm">Nenhum usuário cadastrado.</div>}
            </div>
        </div>
      </div>
    </div>
  );
}