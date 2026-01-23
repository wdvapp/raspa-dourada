'use client';

import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { DollarSign, Users, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    todayRevenue: 0,
    weekRevenue: 0,
    totalUsers: 0
  });
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. MONITORAR DEPÓSITOS (Para Faturamento)
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
        
        // Conversão de Timestamp do Firebase para Date JS
        const date = data.paidAt ? new Date(data.paidAt.seconds * 1000 || data.paidAt) : new Date();

        // Cálculo Hoje
        if (date >= startOfDay) today += amount;
        
        // Cálculo 7 Dias
        if (date >= startOfWeek) week += amount;

        depositsList.push({ id: doc.id, ...data, paidAt: date });
      });

      // Ordenar por data (mais recente primeiro) e pegar os 5 últimos
      depositsList.sort((a, b) => b.paidAt - a.paidAt);
      setRecentDeposits(depositsList.slice(0, 5));

      setStats(prev => ({ ...prev, todayRevenue: today, weekRevenue: week }));
    });

    // 2. MONITORAR USUÁRIOS (Contagem e Lista Recente)
    const qUsers = query(collection(db, 'users'), orderBy('createdAt', 'desc')); // Pega todos para contar, ordena pra listar
    
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

  if (loading) return <div className="text-white text-center p-10">Carregando dados da empresa...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
            <h1 className="text-3xl font-black text-white">Dashboard</h1>
            <p className="text-zinc-500">Visão geral do faturamento em tempo real.</p>
        </div>
      </div>

      {/* CARDS DE FATURAMENTO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Hoje */}
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

        {/* Card 7 Dias */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LISTA DE DEPÓSITOS RECENTES */}
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

        {/* LISTA DE NOVOS USUÁRIOS */}
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