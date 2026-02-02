// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { db, app } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, getDoc, updateDoc, addDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, TrendingUp, Calendar, Megaphone, Gift, Send, Loader2, Lock, Clock, Trash2, Search, Plus, Minus } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ESTADOS GERAIS
  const [stats, setStats] = useState({ todayRevenue: 0, weekRevenue: 0, totalUsers: 0 });
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  
  // --- NOVO: ESTADOS DE BUSCA ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // ------------------------------

  // MARKETING
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [loadingBonus, setLoadingBonus] = useState(false);

  // NOTIFICAÇÕES
  const [notifMode, setNotifMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifImage, setNotifImage] = useState(''); 
  const [notifLink, setNotifLink] = useState('');   
  const [scheduleDate, setScheduleDate] = useState(''); 
  const [scheduleTime, setScheduleTime] = useState(''); 
  const [sendingPush, setSendingPush] = useState(false);
  const [scheduledList, setScheduledList] = useState<any[]>([]);

  // 1. SEGURANÇA
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists() && userSnap.data().role === 'admin') {
                setIsAuthorized(true);
            } else { router.replace('/'); }
        } catch (error) { router.replace('/'); }
      } else { router.replace('/'); }
      setCheckingAuth(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  // 2. CARREGAMENTO DE DADOS (REALTIME)
  useEffect(() => {
    if (!isAuthorized) return;

    getDoc(doc(db, 'config', 'daily_gift')).then(snap => {
        if(snap.exists()) { setBonusActive(snap.data().active); setBonusAmount(snap.data().amount); }
    });

    const qDeposits = query(collection(db, 'deposits'), where('status', '==', 'completed'));
    const unsubDeposits = onSnapshot(qDeposits, (snapshot) => {
      let today = 0, week = 0;
      const now = new Date();
      const startOfDay = new Date(now.setHours(0,0,0,0));
      const startOfWeek = new Date(now.setDate(now.getDate() - 7));
      const list: any[] = [];
      snapshot.docs.forEach(doc => {
        const d = doc.data();
        const amt = Number(d.amount) || 0;
        const date = d.paidAt ? new Date(d.paidAt.seconds * 1000 || d.paidAt) : new Date();
        if (date >= startOfDay) today += amt;
        if (date >= startOfWeek) week += amt;
        list.push({ id: doc.id, ...d, paidAt: date });
      });
      list.sort((a, b) => b.paidAt - a.paidAt);
      setRecentDeposits(list.slice(0, 5));
      setStats(prev => ({ ...prev, todayRevenue: today, weekRevenue: week }));
    });

    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc')); 
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setStats(prev => ({ ...prev, totalUsers: snap.size }));
      // Só atualiza a lista padrão se NÃO estiver buscando
      if (!searchTerm) {
          setRecentUsers(snap.docs.slice(0, 10).map(doc => ({ id: doc.id, ...doc.data() })));
      }
    });

    const qSchedule = query(collection(db, 'scheduled_messages'), where('status', '==', 'pending'));
    const unsubSchedule = onSnapshot(qSchedule, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => {
            const dateA = a.scheduledAt?.seconds || 0;
            const dateB = b.scheduledAt?.seconds || 0;
            return dateA - dateB;
        });
        setScheduledList(list);
    });

    return () => { unsubDeposits(); unsubUsers(); unsubSchedule(); };
  }, [isAuthorized, searchTerm]); // Adicionei searchTerm na dependencia para controlar o update

  // --- FUNÇÃO DE BUSCA (ACIONADA AO DIGITAR) ---
  const handleSearch = async (text: string) => {
    setSearchTerm(text);
    if (text.length === 0) {
        setIsSearching(false);
        setSearchResults([]);
        return;
    }

    setIsSearching(true);
    // Usa a API de busca que criamos no passo anterior
    try {
        const res = await fetch(`/api/admin/search-users?q=${text}`);
        const data = await res.json();
        setSearchResults(data.users || []);
    } catch (error) {
        console.error("Erro busca", error);
    }
  };

  // --- FUNÇÃO DE SALDO (AGORA DENTRO DO DASHBOARD) ---
  const handleUpdateBalance = async (userId: string, type: 'add' | 'remove', currentName: string) => {
    const amountStr = prompt(type === 'add' ? `Adicionar saldo para ${currentName}?` : `Remover saldo de ${currentName}?`);
    if (!amountStr) return;
    const amount = parseFloat(amountStr.replace(',', '.'));
    if (isNaN(amount)) return alert("Valor inválido");

    try {
        const res = await fetch('/api/admin/update-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amount, type })
        });
        const data = await res.json();
        if (data.success) {
            alert("✅ Saldo atualizado!");
            // Atualiza a lista localmente para ver a mudança na hora
            const updateList = (list: any[]) => list.map(u => u.id === userId ? { ...u, balance: data.newBalance } : u);
            setRecentUsers(updateList(recentUsers));
            setSearchResults(updateList(searchResults));
        } else {
            alert("Erro: " + data.error);
        }
    } catch (error) {
        alert("Erro de conexão");
    }
  };

  // --- MKT & NOTIFICAÇÕES (IGUAL ANTES) ---
  const handleSaveBonus = async () => {
    setLoadingBonus(true);
    try { await updateDoc(doc(db, 'config', 'daily_gift'), { active: bonusActive, amount: Number(bonusAmount) }); alert('✅ Atualizado!'); } catch (error) { alert('Erro.'); }
    setLoadingBonus(false);
  };

  const handleNotificationSubmit = async () => {
    if (!notifTitle || !notifBody) return alert('Preencha tudo.');
    setSendingPush(true);

    const payload = { title: notifTitle, body: notifBody, image: notifImage, link: notifLink };

    if (notifMode === 'NOW') {
        if (!confirm(`Enviar para TODOS agora?`)) { setSendingPush(false); return; }
        try {
            await fetch('/api/send-push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            alert('🚀 Enviado!'); setNotifTitle(''); setNotifBody('');
        } catch (error) { alert('Erro.'); }
    } else {
        if (!scheduleDate || !scheduleTime) { alert("Data/Hora?"); setSendingPush(false); return; }
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        await addDoc(collection(db, 'scheduled_messages'), { ...payload, scheduledAt: Timestamp.fromDate(scheduledDateTime), status: 'pending', createdAt: serverTimestamp() });
        alert('📅 Agendado!');
        setNotifTitle(''); setNotifBody('');
    }
    setSendingPush(false);
  };
  
  const handleDeleteSchedule = async (id: string) => { if(confirm("Cancelar?")) await deleteDoc(doc(db, 'scheduled_messages', id)); };

  if (checkingAuth || !isAuthorized) return null;

  // Decide qual lista mostrar: A busca ou os Recentes
  const displayUsers = searchTerm ? searchResults : recentUsers;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 p-6">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black text-white flex items-center gap-2"><Lock className="text-green-500 mb-1" size={28}/> Painel Administrativo</h1><p className="text-zinc-500">Gestão completa da plataforma.</p></div>
      </div>

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-green-900 to-green-950 border border-green-800 p-8 rounded-3xl relative overflow-hidden group"><div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform"><DollarSign size={100} /></div><p className="text-green-400 font-bold uppercase tracking-wider text-sm mb-2 flex items-center gap-2"><TrendingUp size={16} /> Faturamento Hoje</p><h2 className="text-5xl font-black text-white">R$ {stats.todayRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2></div>
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl relative overflow-hidden"><div className="absolute top-0 right-0 p-8 opacity-5"><Calendar size={100} className="text-[#ffc700]" /></div><p className="text-zinc-500 font-bold uppercase tracking-wider text-sm mb-2">Últimos 7 Dias</p><h2 className="text-5xl font-black text-white">R$ {stats.weekRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2></div>
      </div>

      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-4"><Megaphone className="text-purple-500" /> Central de Marketing</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* PAINEL DE NOTIFICAÇÃO */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
            {/* ... (Mesmo código de notificação de antes) ... */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800"><div className="p-3 bg-yellow-500/20 rounded-full text-yellow-500"><Megaphone size={24} /></div><div><h3 className="text-lg font-bold text-white">Criar Notificação</h3><p className="text-xs text-zinc-500">Envie agora ou agende para depois.</p></div></div>
            <div className="flex bg-zinc-950 p-1 rounded-xl mb-4 border border-zinc-800">
                <button onClick={() => setNotifMode('NOW')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${notifMode === 'NOW' ? 'bg-yellow-500 text-black shadow' : 'text-zinc-500 hover:text-white'}`}>ENVIAR AGORA</button>
                <button onClick={() => setNotifMode('SCHEDULE')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${notifMode === 'SCHEDULE' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}>AGENDAR</button>
            </div>
            <div className="space-y-4">
                <input type="text" placeholder="Título" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none font-bold" />
                <textarea rows={2} placeholder="Mensagem" value={notifBody} onChange={(e) => setNotifBody(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none resize-none text-sm" />
                <div className="grid grid-cols-2 gap-4">
                    <input type="text" placeholder="URL Imagem" value={notifImage} onChange={(e) => setNotifImage(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-2 text-white text-xs" />
                    <input type="text" placeholder="Link Destino" value={notifLink} onChange={(e) => setNotifLink(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-2 text-white text-xs" />
                </div>
                {notifMode === 'SCHEDULE' && (
                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800">
                        <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white text-sm" />
                        <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white text-sm" />
                    </div>
                )}
                <button onClick={handleNotificationSubmit} disabled={sendingPush} className={`w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 mt-2 transition-all active:scale-95 ${notifMode === 'NOW' ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>{sendingPush ? <Loader2 className="animate-spin" /> : <><Send size={18}/> ENVIAR</>}</button>
            </div>
          </div>

          <div className="space-y-8">
              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
                <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-500/20 rounded-full text-purple-400"><Gift size={20} /></div><span className="font-bold text-white text-sm">Bônus Diário</span></div><div className="flex items-center bg-black/20 p-1 rounded-lg border border-zinc-700"><span className="text-xs text-zinc-400 mr-2 ml-2">Ativo?</span><button onClick={() => setBonusActive(!bonusActive)} className={`w-10 h-5 rounded-full relative transition-colors ${bonusActive ? 'bg-green-500' : 'bg-zinc-700'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${bonusActive ? 'left-5.5' : 'left-0.5'}`}></div></button></div></div>
                <div className="flex gap-2"><input type="number" value={bonusAmount} onChange={(e) => setBonusAmount(Number(e.target.value))} className="flex-1 bg-black/20 border border-zinc-700 rounded-xl px-3 text-white font-bold" /><button onClick={handleSaveBonus} disabled={loadingBonus} className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold text-sm">{loadingBonus ? '...' : 'Salvar'}</button></div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden h-[300px] flex flex-col">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950/50"><h3 className="font-bold text-white text-sm flex items-center gap-2"><Clock size={16} className="text-purple-500"/> Fila de Agendamentos</h3></div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">{scheduledList.length > 0 ? scheduledList.map((item) => (<div key={item.id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex justify-between items-center group"><div><p className="text-xs font-bold text-white">{item.title}</p><p className="text-[10px] text-zinc-500">{item.scheduledAt?.toDate().toLocaleString('pt-BR')}</p></div><button onClick={() => handleDeleteSchedule(item.id)} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={16}/></button></div>)) : <div className="text-center text-zinc-600 text-xs py-10">Nenhuma mensagem agendada.</div>}</div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        
        {/* LISTA DE DEPÓSITOS (Inalterado) */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2"><DollarSign className="text-green-500" size={20}/> Últimos Depósitos</h3>
            </div>
            <div className="divide-y divide-zinc-800">
                {recentDeposits.length > 0 ? recentDeposits.map((deposit) => (<div key={deposit.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors"><div><p className="text-white font-bold text-lg">R$ {Number(deposit.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-zinc-500">{deposit.paidAt ? new Date(deposit.paidAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : 'Processando'}</p></div><span className="text-xs font-mono text-zinc-600 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">{deposit.userEmail || 'Anônimo'}</span></div>)) : <div className="p-8 text-center text-zinc-500 text-sm">Nenhum depósito hoje.</div>}
            </div>
        </div>

        {/* --- LISTA DE USUÁRIOS COM BUSCA INTEGRADA (CERTO) --- */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col min-h-[400px]">
            <div className="p-6 border-b border-zinc-800 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2"><Users className="text-[#ffc700]" size={20}/> {searchTerm ? 'Resultados da Busca' : `Novos Usuários (${stats.totalUsers})`}</h3>
                </div>
                
                {/* O INPUT DE BUSCA FICA AQUI DENTRO AGORA */}
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Buscar por nome ou e-mail..." 
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl py-3 pl-4 pr-10 text-white text-sm focus:border-yellow-500 outline-none"
                    />
                    <div className="absolute right-3 top-3 text-zinc-500">
                        {isSearching ? <Loader2 size={18} className="animate-spin"/> : <Search size={18} />}
                    </div>
                </div>
            </div>

            <div className="divide-y divide-zinc-800 flex-1 overflow-y-auto max-h-[500px]">
                {displayUsers.length > 0 ? displayUsers.map((user) => (
                    <div key={user.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-[#ffc700] shrink-0">
                                {user.email ? user.email.substring(0,2).toUpperCase() : 'U'}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-white font-medium text-sm truncate max-w-[150px]">{user.email || 'Sem e-mail'}</p>
                                <p className="text-[10px] text-zinc-500 truncate">{user.name || 'Sem nome'}</p>
                            </div>
                        </div>

                        {/* AQUI ESTÃO OS BOTÕES DE SALDO NA MESMA LINHA */}
                        <div className="flex items-center gap-2">
                             <span className={`text-xs font-bold px-2 py-1 rounded ${user.balance > 0 ? 'text-green-500 bg-green-900/20' : 'text-zinc-500 bg-zinc-800'}`}>
                                R$ {user.balance?.toFixed(2) || '0.00'}
                             </span>
                             
                             <button 
                                onClick={() => handleUpdateBalance(user.id, 'add', user.email)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-green-600 hover:bg-green-500 text-white"
                                title="Adicionar Saldo"
                             >
                                <Plus size={12} />
                             </button>

                             <button 
                                onClick={() => handleUpdateBalance(user.id, 'remove', user.email)}
                                className="w-6 h-6 flex items-center justify-center rounded bg-red-600 hover:bg-red-500 text-white"
                                title="Remover Saldo"
                             >
                                <Minus size={12} />
                             </button>
                        </div>
                    </div>
                )) : (
                    <div className="p-8 text-center text-zinc-500 text-sm">
                        {searchTerm ? 'Nenhum usuário encontrado.' : 'Carregando lista...'}
                    </div>
                )}
            </div>
        </div>

      </div>

      {/* RODAPÉ DO ADMIN - MODO FANTASMA (AQUI ESTÁ A NOVIDADE) */}
      <div className="mt-12 p-6 border-t border-zinc-800 text-center">
        <p className="text-zinc-500 text-xs mb-4">Ferramentas de Desenvolvedor</p>
        
        <button 
          onClick={() => {
            const isGhost = localStorage.getItem('RASPA_INTERNAL_USER');
            if (isGhost) {
              localStorage.removeItem('RASPA_INTERNAL_USER');
              alert('👁️ Você agora ESTÁ VISÍVEL para o Analytics.');
            } else {
              localStorage.setItem('RASPA_INTERNAL_USER', 'true');
              alert('👻 Modo Fantasma ATIVADO! Suas visitas não contam mais.');
            }
          }}
          className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 py-2 px-4 rounded-full border border-zinc-700 transition-colors"
        >
          Alternar Modo Fantasma (Analytics)
        </button>
      </div>

    </div>
  );
}