'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // Importante para navegação
import { 
  Users, 
  DollarSign, 
  Settings, 
  LogOut, 
  Save,
  CheckCircle,
  LayoutDashboard,
  Trophy,
  Target,
  Palette
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function AdminDashboard() {
  const router = useRouter(); // Hook de navegação
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [games, setGames] = useState<any[]>([]);
  
  // Configuração da Trapaça Inteligente
  const [marketingConfig, setMarketingConfig] = useState({
    targetEmail: '', 
    gameId: '',
    prizeIndex: 0,
    roundNumber: 4 
  });
  const [isSaved, setIsSaved] = useState(false);

  // Dados Mockados
  const faturamentoHoje = 12000.00;
  const faturamento7Dias = 58000.00;

  const ultimosDepositantes = [
    { nome: 'Jéssica', email: 'jessica@gmail.com', valor: 10.00 },
    { nome: 'Marcos', email: 'marcao@gmail.com', valor: 10.00 },
    { nome: 'Pedro', email: 'pedro@hotmail.com', valor: 50.00 },
    { nome: 'Ana', email: 'ana.souza@uol.com.br', valor: 20.00 },
  ];

  const ultimosUsuarios = [
    { nome: 'Marcos', login: 'marcao@gmail.com' },
    { nome: 'Jéssica', login: 'jessica@gmail.com' },
    { nome: 'Felipe', login: 'felipe_99' },
    { nome: 'Bruno', login: 'bruno.gamer' },
  ];

  useEffect(() => {
    const fetchGames = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, 'games'));
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setGames(list);
        } catch (e) {
            console.error("Erro ao buscar jogos", e);
        }
    };
    fetchGames();
  }, []);

  const saveMarketingConfig = () => {
    if (!marketingConfig.targetEmail) return alert("Digite o e-mail do usuário alvo!");
    if (!marketingConfig.gameId) return alert("Selecione um jogo!");

    const configData = {
        targetUser: marketingConfig.targetEmail,
        targetGameId: marketingConfig.gameId,
        targetPrizeIndex: marketingConfig.prizeIndex,
        targetRound: marketingConfig.roundNumber
    };

    localStorage.setItem(`marketing_config_${marketingConfig.targetEmail}`, JSON.stringify(configData));
    localStorage.setItem(`marketing_round_${marketingConfig.targetEmail}`, '0'); 

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  // --- FUNÇÃO DE NAVEGAÇÃO INTELIGENTE ---
  const handleNavigation = (key: string) => {
      switch(key) {
          case 'GAMES':
              // Redireciona para a página de criação de jogos
              router.push('/admin/games');
              break;
          case 'USERS':
              // Exemplo: router.push('/admin/users');
              alert("Página de Usuários ainda não criada. Crie em /admin/users");
              break;
          case 'DEPOSITS':
              alert("Página de Depósitos ainda não criada.");
              break;
          case 'HOME':
              router.push('/'); // Voltar para o site
              break;
          default:
              // Se não for página externa, troca a aba interna (Dashboard/Marketing)
              setActiveTab(key);
      }
  };

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans flex">
      
      {/* SIDEBAR (Fixa no Desktop) */}
      <aside className="w-72 p-4 flex flex-col gap-2 border-r border-white/5 bg-[#1a1a1a] hidden md:flex">
        <div className="bg-[#FFC700] text-black font-black text-center py-3 rounded text-lg uppercase tracking-wider mb-6 shadow-lg shadow-yellow-500/20">
          CONTROLES
        </div>

        {/* Botões Internos (Abas) */}
        <SidebarButton label="Dashboard" icon={<LayoutDashboard size={18}/>} active={activeTab === 'DASHBOARD'} onClick={() => handleNavigation('DASHBOARD')} />
        <SidebarButton label="Modo Marketing" icon={<Settings size={18}/>} active={activeTab === 'MARKETING'} onClick={() => handleNavigation('MARKETING')} highlight />
        
        <div className="h-px bg-white/10 my-2"></div>

        {/* Botões Externos (Links para outras páginas) */}
        <SidebarButton label="Raspadinhas" icon={<Trophy size={18}/>} active={false} onClick={() => handleNavigation('GAMES')} />
        <SidebarButton label="Usuários" icon={<Users size={18}/>} active={false} onClick={() => handleNavigation('USERS')} />
        <SidebarButton label="Depósitos" icon={<DollarSign size={18}/>} active={false} onClick={() => handleNavigation('DEPOSITS')} />
        
        <div className="mt-auto pt-4 border-t border-white/10">
            <button onClick={() => handleNavigation('HOME')} className="flex items-center gap-2 text-zinc-500 hover:text-red-500 font-bold px-4 transition-colors w-full">
                <LogOut size={18} /> Voltar ao Site
            </button>
        </div>
      </aside>

      {/* CONTEÚDO */}
      <main className="flex-1 p-8 bg-[#121212] overflow-y-auto">
        
        {/* ABA DASHBOARD */}
        {activeTab === 'DASHBOARD' && (
            <div className="flex flex-col gap-8 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#377a3d] rounded-md h-40 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                        <span className="text-white/80 font-bold text-lg mb-1 relative z-10">Faturamento de Hoje</span>
                        <span className="text-white font-black text-5xl tracking-tighter relative z-10">
                            R${faturamentoHoje.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </span>
                    </div>

                    <div className="bg-[#785c08] rounded-md h-40 flex flex-col items-center justify-center shadow-lg relative overflow-hidden">
                        <span className="text-white/80 font-bold text-lg mb-1 relative z-10">Últimos 7 Dias</span>
                        <span className="text-white font-black text-5xl tracking-tighter relative z-10">
                            R${faturamento7Dias.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#2a2a2a] rounded-md overflow-hidden border border-white/5">
                        <div className="bg-[#333] p-4 text-center font-bold text-zinc-300 uppercase text-xs tracking-wider">
                            Últimos depositantes
                        </div>
                        <div className="flex flex-col divide-y divide-white/5">
                            {ultimosDepositantes.map((dep, i) => (
                                <div key={i} className="p-4 flex items-center justify-between hover:bg-white/5">
                                    <span className="font-bold text-white">R${dep.valor.toFixed(2)}</span>
                                    <span className="text-zinc-400 text-sm">{dep.nome} / {dep.email}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#2a2a2a] rounded-md overflow-hidden border border-white/5">
                        <div className="bg-[#333] p-4 text-center font-bold text-zinc-300 uppercase text-xs tracking-wider">
                            Últimos usuários
                        </div>
                        <div className="flex flex-col divide-y divide-white/5">
                            {ultimosUsuarios.map((user, i) => (
                                <div key={i} className="p-4 flex flex-col hover:bg-white/5">
                                    <div className="flex justify-between">
                                        <span className="text-zinc-400 text-sm">Nome: <b className="text-white">{user.nome}</b></span>
                                    </div>
                                    <span className="text-zinc-500 text-xs mt-1">Login: {user.login}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* ABA MODO MARKETING */}
        {activeTab === 'MARKETING' && (
            <div className="animate-in fade-in max-w-2xl mx-auto mt-6">
                <div className="bg-[#2a2a2a] border border-yellow-500/30 p-8 rounded-xl relative shadow-2xl">
                    <div className="absolute top-0 right-0 p-6 opacity-10 text-yellow-500">
                       <Target size={120} />
                    </div>

                    <h2 className="text-2xl font-black text-yellow-500 mb-2 uppercase flex items-center gap-2">
                        Modo Influencer <Settings className="animate-spin-slow" size={24}/>
                    </h2>
                    <p className="text-zinc-400 text-sm mb-8 border-b border-white/10 pb-4">
                        Escolha um usuário específico (sócio ou influencer) para ganhar o prêmio programado.
                    </p>

                    <div className="space-y-6">
                        
                        <div className="bg-[#1a1a1a] p-4 rounded-lg border border-yellow-500/20">
                            <label className="block text-xs font-bold text-yellow-500 uppercase mb-2 flex items-center gap-2">
                                <Target size={14}/> E-mail do Usuário Alvo
                            </label>
                            <input 
                                type="email"
                                placeholder="Ex: socio@gmail.com"
                                className="w-full bg-[#111] border border-zinc-700 rounded-lg p-3 text-white font-bold focus:border-yellow-500 outline-none transition-colors placeholder:text-zinc-600"
                                value={marketingConfig.targetEmail}
                                onChange={(e) => setMarketingConfig({...marketingConfig, targetEmail: e.target.value})}
                            />
                            <p className="text-[10px] text-zinc-500 mt-2">
                                Apenas este usuário terá o resultado manipulado.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">1. Jogo</label>
                                <select 
                                    className="w-full bg-[#151515] border border-zinc-700 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                                    value={marketingConfig.gameId}
                                    onChange={(e) => setMarketingConfig({...marketingConfig, gameId: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">2. Prêmio</label>
                                <select 
                                    className="w-full bg-[#151515] border border-zinc-700 rounded-lg p-3 text-white focus:border-yellow-500 outline-none"
                                    value={marketingConfig.prizeIndex}
                                    onChange={(e) => setMarketingConfig({...marketingConfig, prizeIndex: Number(e.target.value)})}
                                    disabled={!marketingConfig.gameId}
                                >
                                    <option value="-1">Selecione...</option>
                                    {marketingConfig.gameId && games.find(g => g.id === marketingConfig.gameId)?.prizes.map((p: any, i: number) => (
                                        <option key={i} value={i}>{p.name} (R$ {p.value})</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">3. Ganhar na rodada nº:</label>
                            <div className="flex items-center gap-4 bg-[#151515] p-3 rounded-lg border border-zinc-700">
                                <input 
                                    type="number" 
                                    min="1"
                                    className="w-20 bg-transparent text-white font-black text-xl text-center outline-none"
                                    value={marketingConfig.roundNumber}
                                    onChange={(e) => setMarketingConfig({...marketingConfig, roundNumber: Number(e.target.value)})}
                                />
                                <div className="text-zinc-500 text-sm border-l border-zinc-700 pl-4">
                                    O usuário perderá <strong>{marketingConfig.roundNumber - 1}</strong> vezes e ganhará na <strong>{marketingConfig.roundNumber}ª</strong>.
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={saveMarketingConfig}
                            className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-yellow-500/20 mt-4"
                        >
                            {isSaved ? <CheckCircle size={20} /> : <Save size={20} />}
                            {isSaved ? 'CONFIGURAÇÃO SALVA!' : 'ATIVAR MODO INFLUENCER'}
                        </button>
                    </div>
                </div>
            </div>
        )}

      </main>
    </div>
  );
}

function SidebarButton({ label, icon, active, onClick, highlight }: any) {
    return (
        <button 
            onClick={onClick}
            className={`w-full text-left px-4 py-3 rounded font-bold text-sm transition-all flex items-center gap-3 ${
                active 
                ? 'bg-zinc-700 text-white border-l-4 border-yellow-500 shadow-md' 
                : 'bg-[#2a2a2a] text-zinc-400 hover:bg-[#333] hover:text-white'
            } ${highlight ? 'ring-1 ring-yellow-500/50 text-yellow-500' : ''}`}
        >
            {icon}
            <span className="flex-1">{label}</span>
            {active && <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>}
        </button>
    );
}