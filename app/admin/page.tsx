// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { db, app } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, where, doc, getDoc, updateDoc, addDoc, deleteDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { DollarSign, Users, TrendingUp, Calendar, Megaphone, Gift, Save, Send, Loader2, Lock, Clock, Trash2, CheckCircle } from 'lucide-react';

// --- NOVO: IMPORTAMOS A BARRA DE BUSCA ---
import AdminUserSearch from '@/components/AdminUserSearch'; 
// ----------------------------------------

export default function AdminDashboard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ESTADOS GERAIS
  const [stats, setStats] = useState({ todayRevenue: 0, weekRevenue: 0, totalUsers: 0 });
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  
  // MARKETING
  const [bonusActive, setBonusActive] = useState(false);
  const [bonusAmount, setBonusAmount] = useState(0);
  const [loadingBonus, setLoadingBonus] = useState(false);

  // NOTIFICAÇÕES (ATUALIZADO COM IMAGEM E LINK)
  const [notifMode, setNotifMode] = useState<'NOW' | 'SCHEDULE'>('NOW');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifImage, setNotifImage] = useState(''); 
  const [notifLink, setNotifLink] = useState('');   
  const [scheduleDate, setScheduleDate] = useState(''); 
  const [scheduleTime, setScheduleTime] = useState(''); 
  const [sendingPush, setSendingPush] = useState(false);
  const [scheduledList, setScheduledList] = useState<any[]>([]);

  // 1. SEGURANÇA FANTASMA
  useEffect(() => {
    const auth = getAuth(app);
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userSnap = await getDoc(userDocRef);
            if (userSnap.exists() && userSnap.data().role === 'admin') {
                setIsAuthorized(true);
            } else {
                router.replace('/');
            }
        } catch (error) { router.replace('/'); }
      } else { router.replace('/'); }
      setCheckingAuth(false);
    });
    return () => unsubscribeAuth();
  }, [router]);

  // 2. CARREGAMENTO DE DADOS
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
      setRecentUsers(snap.docs.slice(0, 5).map(doc => ({ id: doc.id, ...doc.data() })));
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
        checkAndSendScheduled(snap.docs);
    });

    return () => { unsubDeposits(); unsubUsers(); unsubSchedule(); };
  }, [isAuthorized]);

  const checkAndSendScheduled = async (docs: any[]) => {
      const now = new Date();
      docs.forEach(async (docSnap) => {
          const data = docSnap.data();
          if(!data.scheduledAt) return;
          
          const scheduledTime = data.scheduledAt.toDate();
          
          if (scheduledTime <= now && data.status === 'pending') {
              console.log("Enviando mensagem agendada:", data.title);
              await updateDoc(doc(db, 'scheduled_messages', docSnap.id), { status: 'processing' });
              
              try {
                  await fetch('/api/send-push', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                          title: data.title, 
                          body: data.body,
                          image: data.image,
                          link: data.link
                      })
                  });
                  await updateDoc(doc(db, 'scheduled_messages', docSnap.id), { status: 'sent', sentAt: serverTimestamp() });
              } catch (e) {
                  console.error("Erro envio agendado", e);
                  await updateDoc(doc(db, 'scheduled_messages', docSnap.id), { status: 'error' });
              }
          }
      });
  };

  const handleSaveBonus = async () => {
    setLoadingBonus(true);
    try {
      await updateDoc(doc(db, 'config', 'daily_gift'), { active: bonusActive, amount: Number(bonusAmount) });
      alert('✅ Atualizado!');
    } catch (error) { alert('Erro ao salvar.'); }
    setLoadingBonus(false);
  };

  const handleNotificationSubmit = async () => {
    if (!notifTitle || !notifBody) return alert('Preencha título e mensagem.');
    
    setSendingPush(true);

    if (notifMode === 'NOW') {
        if (!confirm(`Enviar para TODOS agora?`)) { setSendingPush(false); return; }
        try {
            const res = await fetch('/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: notifTitle, 
                    body: notifBody,
                    image: notifImage,
                    link: notifLink
                })
            });
            const data = await res.json();
            if (data.success) { 
                alert('🚀 Enviado!'); 
                setNotifTitle(''); setNotifBody(''); setNotifImage(''); setNotifLink('');
            } 
            else { alert('Erro: ' + JSON.stringify(data)); }
        } catch (error) { alert('Erro de conexão.'); }

    } else {
        if (!scheduleDate || !scheduleTime) {
            alert("Escolha data e hora."); setSendingPush(false); return;
        }
        
        const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
        
        try {
            await addDoc(collection(db, 'scheduled_messages'), {
                title: notifTitle,
                body: notifBody,
                image: notifImage, 
                link: notifLink,   
                scheduledAt: Timestamp.fromDate(scheduledDateTime),
                status: 'pending',
                createdAt: serverTimestamp()
            });
            alert('📅 Mensagem Agendada com Sucesso!');
            setNotifTitle(''); setNotifBody(''); setNotifImage(''); setNotifLink(''); setScheduleDate(''); setScheduleTime('');
        } catch (e: any) {
            console.error(e); 
            alert("Erro ao agendar: " + e.message);
        }
    }
    setSendingPush(false);
  };

  const handleDeleteSchedule = async (id: string) => {
      if(confirm("Cancelar este agendamento?")) {
          await deleteDoc(doc(db, 'scheduled_messages', id));
      }
  };

  if (checkingAuth || !isAuthorized) return null;

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

      {/* --- AQUI ENTRA O COMPONENTE DE BUSCA (MODO DEUS) --- */}
      {/* Ele já vem estilizado com fundo escuro e bordas, encaixa perfeito */}
      <AdminUserSearch />
      {/* --------------------------------------------------- */}

      <h2 className="text-2xl font-bold text-white flex items-center gap-2 mt-4"><Megaphone className="text-purple-500" /> Central de Marketing</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* PAINEL DE NOTIFICAÇÃO */}
          <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800"><div className="p-3 bg-yellow-500/20 rounded-full text-yellow-500"><Megaphone size={24} /></div><div><h3 className="text-lg font-bold text-white">Criar Notificação</h3><p className="text-xs text-zinc-500">Envie agora ou agende para depois.</p></div></div>
            <div className="flex bg-zinc-950 p-1 rounded-xl mb-4 border border-zinc-800">
                <button onClick={() => setNotifMode('NOW')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${notifMode === 'NOW' ? 'bg-yellow-500 text-black shadow' : 'text-zinc-500 hover:text-white'}`}>ENVIAR AGORA</button>
                <button onClick={() => setNotifMode('SCHEDULE')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${notifMode === 'SCHEDULE' ? 'bg-purple-600 text-white shadow' : 'text-zinc-500 hover:text-white'}`}>AGENDAR</button>
            </div>
            <div className="space-y-4">
                <input type="text" placeholder="Título (ex: Bônus Surpresa!)" value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none font-bold" />
                <textarea rows={2} placeholder="Mensagem (ex: Ganhe 100% no depósito hoje)" value={notifBody} onChange={(e) => setNotifBody(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white focus:border-yellow-500 outline-none resize-none text-sm" />
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">URL da Imagem (Opcional)</label>
                          <input type="text" placeholder="https://..." value={notifImage} onChange={(e) => setNotifImage(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-2 text-white text-xs" />
                    </div>
                    <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Link de Destino (Opcional)</label>
                          <input type="text" placeholder="/games ou https://..." value={notifLink} onChange={(e) => setNotifLink(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-2 text-white text-xs" />
                    </div>
                </div>

                {notifMode === 'SCHEDULE' && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 pt-2 border-t border-zinc-800">
                        <div><label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Data</label><input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white text-sm" /></div>
                        <div><label className="text-[10px] uppercase font-bold text-zinc-500 mb-1 block">Hora</label><input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-full bg-black/20 border border-zinc-700 rounded-xl p-3 text-white text-sm" /></div>
                    </div>
                )}
                <button onClick={handleNotificationSubmit} disabled={sendingPush} className={`w-full font-black py-4 rounded-xl flex items-center justify-center gap-2 mt-2 transition-all active:scale-95 ${notifMode === 'NOW' ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : 'bg-purple-600 hover:bg-purple-500 text-white'}`}>{sendingPush ? <Loader2 className="animate-spin" /> : (notifMode === 'NOW' ? <><Send size={18}/> ENVIAR AGORA</> : <><Clock size={18}/> AGENDAR MENSAGEM</>)}</button>
            </div>
          </div>

          <div className="space-y-8">
              {/* BÔNUS DIÁRIO */}
              <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
                <div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-500/20 rounded-full text-purple-400"><Gift size={20} /></div><span className="font-bold text-white text-sm">Bônus Diário</span></div><div className="flex items-center bg-black/20 p-1 rounded-lg border border-zinc-700"><span className="text-xs text-zinc-400 mr-2 ml-2">Ativo?</span><button onClick={() => setBonusActive(!bonusActive)} className={`w-10 h-5 rounded-full relative transition-colors ${bonusActive ? 'bg-green-500' : 'bg-zinc-700'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${bonusActive ? 'left-5.5' : 'left-0.5'}`}></div></button></div></div>
                <div className="flex gap-2"><input type="number" value={bonusAmount} onChange={(e) => setBonusAmount(Number(e.target.value))} className="flex-1 bg-black/20 border border-zinc-700 rounded-xl px-3 text-white font-bold" /><button onClick={handleSaveBonus} disabled={loadingBonus} className="bg-purple-600 hover:bg-purple-500 text-white px-4 rounded-xl font-bold text-sm">{loadingBonus ? '...' : 'Salvar'}</button></div>
              </div>

              {/* FILA DE MENSAGENS */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden h-[300px] flex flex-col">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-950/50"><h3 className="font-bold text-white text-sm flex items-center gap-2"><Clock size={16} className="text-purple-500"/> Fila de Agendamentos</h3></div>
                  <div className="overflow-y-auto flex-1 p-2 space-y-2">{scheduledList.length > 0 ? scheduledList.map((item) => (<div key={item.id} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex justify-between items-center group"><div><p className="text-xs font-bold text-white">{item.title}</p><p className="text-[10px] text-zinc-500">{item.scheduledAt?.toDate().toLocaleString('pt-BR')}</p></div><button onClick={() => handleDeleteSchedule(item.id)} className="text-zinc-600 hover:text-red-500 p-2"><Trash2 size={16}/></button></div>)) : <div className="text-center text-zinc-600 text-xs py-10">Nenhuma mensagem agendada.</div>}</div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"><div className="p-6 border-b border-zinc-800 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><DollarSign className="text-green-500" size={20}/> Últimos Depósitos</h3></div><div className="divide-y divide-zinc-800">{recentDeposits.length > 0 ? recentDeposits.map((deposit) => (<div key={deposit.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors"><div><p className="text-white font-bold text-lg">R$ {Number(deposit.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-xs text-zinc-500">{deposit.paidAt ? new Date(deposit.paidAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : 'Processando'}</p></div><span className="text-xs font-mono text-zinc-600 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">{deposit.userEmail || 'Anônimo'}</span></div>)) : <div className="p-8 text-center text-zinc-500 text-sm">Nenhum depósito hoje.</div>}</div></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden"><div className="p-6 border-b border-zinc-800 flex justify-between items-center"><h3 className="font-bold text-white flex items-center gap-2"><Users className="text-[#ffc700]" size={20}/> Novos Usuários ({stats.totalUsers})</h3></div><div className="divide-y divide-zinc-800">{recentUsers.length > 0 ? recentUsers.map((user) => (<div key={user.id} className="p-4 flex justify-between items-center hover:bg-zinc-800/50 transition-colors"><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-[#ffc700]">{user.email ? user.email.substring(0,2).toUpperCase() : 'U'}</div><div><p className="text-white font-medium text-sm">{user.email || 'Sem e-mail'}</p><p className="text-[10px] text-zinc-500">Cadastrado em {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : 'Data desconhecida'}</p></div></div>{user.balance > 0 && <span className="text-xs font-bold text-green-500 bg-green-900/20 px-2 py-1 rounded">R$ {user.balance.toFixed(2)}</span>}</div>)) : <div className="p-8 text-center text-zinc-500 text-sm">Nenhum usuário cadastrado.</div>}</div></div>
      </div>
    </div>
  );
}