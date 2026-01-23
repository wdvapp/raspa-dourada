'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
// Ajuste para garantir que encontre o arquivo, igual ao seu deposit/route.ts
import { db } from '../../../lib/firebase'; 
import { collection, addDoc, getDocs, query, where, orderBy, limit, deleteDoc, doc } from 'firebase/firestore';
import { Megaphone, Search, UserCheck, Save, Trash2, ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function InfluencerMode() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // FORMULÁRIO
  const [emailSearch, setEmailSearch] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any>(null);
  const [selectedPrizeIndex, setSelectedPrizeIndex] = useState<string>('');
  const [roundNumber, setRoundNumber] = useState(1);

  // LISTA DE ARMAÇÕES ATIVAS
  const [activeRigs, setActiveRigs] = useState<any[]>([]);

  // 1. CARREGAR JOGOS E LISTA DE ARMAÇÕES
  const fetchData = async () => {
    try {
        // Jogos
        const gamesSnap = await getDocs(collection(db, 'games'));
        const gamesList = gamesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setGames(gamesList);

        // Lista de Vitórias Armadas
        const rigsQ = query(collection(db, 'rigged_wins'), orderBy('createdAt', 'desc'), limit(50));
        const rigsSnap = await getDocs(rigsQ);
        
        // Cruzar dados para mostrar nomes
        const rigsData = rigsSnap.docs.map(docSnap => {
          const data = docSnap.data();
          // Encontra o jogo correspondente
          const game: any = gamesList.find((g: any) => g.id === data.gameId);
          // Encontra o nome do prêmio
          const prizeName = game?.prizes?.[data.prizeIndex]?.name || 'Prêmio desconhecido';
          const gameName = game?.name || 'Jogo deletado';
          
          return { id: docSnap.id, ...data, gameName, prizeName };
        });
        
        setActiveRigs(rigsData);
    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. BUSCAR USUÁRIO
  const handleSearchUser = async () => {
    if (!emailSearch) return;
    setLoading(true);
    try {
        const q = query(collection(db, 'users'), where('email', '==', emailSearch));
        const snap = await getDocs(q);
        if (!snap.empty) {
            setFoundUser({ id: snap.docs[0].id, ...snap.docs[0].data() });
        } else {
            alert("Usuário não encontrado!");
            setFoundUser(null);
        }
    } catch (error) {
        console.error(error);
        alert("Erro ao buscar usuário.");
    } finally {
        setLoading(false);
    }
  };

  // 3. SALVAR ARMAÇÃO
  const handleSave = async () => {
    if (!foundUser || !selectedGame || selectedPrizeIndex === '') return alert("Preencha tudo!");
    setLoading(true);

    try {
      await addDoc(collection(db, 'rigged_wins'), {
        userId: foundUser.id,
        userEmail: foundUser.email,
        gameId: selectedGame.id,
        prizeIndex: Number(selectedPrizeIndex),
        triggerOnRound: Number(roundNumber),
        active: true,
        createdAt: Date.now()
      });

      alert(`✅ SUCESSO! Configuração salva para ${foundUser.email}.`);
      
      // Limpa formulário
      setFoundUser(null); 
      setEmailSearch(''); 
      setSelectedGame(null); 
      setSelectedPrizeIndex('');
      
      // Atualiza a lista imediatamente
      fetchData(); 

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  // 4. DELETAR ARMAÇÃO
  const handleDeleteRig = async (id: string) => {
    if(confirm("Tem certeza? O usuário voltará a ter resultados aleatórios normais.")) {
        try {
            await deleteDoc(doc(db, 'rigged_wins', id));
            // Remove da lista visualmente
            setActiveRigs(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert("Erro ao excluir.");
        }
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 text-white space-y-8 animate-in fade-in duration-500">
        
        {/* HEADER COM BOTÃO VOLTAR CORRIGIDO */}
        <div className="flex items-center gap-4">
            <button 
                onClick={() => router.push('/admin')} 
                className="bg-zinc-900 p-2 rounded-lg hover:bg-zinc-800 transition-colors border border-zinc-800"
            >
                <ArrowLeft size={24}/>
            </button>
            <div>
                <h1 className="text-3xl font-black flex items-center gap-2">
                    <Megaphone className="text-[#ffc700]"/> Modo Influenciador
                </h1>
                <p className="text-zinc-500">Configure resultados garantidos para vídeos.</p>
            </div>
        </div>

        {/* --- ÁREA DE CADASTRO --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SELEÇÃO USUÁRIO */}
            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
                <h3 className="text-[#ffc700] font-bold text-sm uppercase">1. Selecionar Influenciador</h3>
                <div className="flex gap-2">
                    <input 
                        value={emailSearch} 
                        onChange={e => setEmailSearch(e.target.value)} 
                        placeholder="E-mail do usuário..." 
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-[#ffc700] outline-none"
                    />
                    <button onClick={handleSearchUser} disabled={loading} className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-xl transition-colors border border-zinc-700">
                        <Search/>
                    </button>
                </div>
                {foundUser && (
                    <div className="flex items-center gap-3 bg-green-900/20 border border-green-900/50 p-3 rounded-xl text-green-500 font-bold animate-in fade-in">
                        <UserCheck size={20} /> {foundUser.email}
                    </div>
                )}
            </div>

            {/* SELEÇÃO JOGO E PRÊMIO */}
            <div className={`bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4 ${!foundUser ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="text-[#ffc700] font-bold text-sm uppercase">2. O que ele vai ganhar?</h3>
                <select 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-[#ffc700] outline-none" 
                    onChange={e => {
                        const g = games.find((game: any) => game.id === e.target.value);
                        setSelectedGame(g);
                    }}
                >
                    <option value="">Selecione a Raspadinha...</option>
                    {games.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>

                {selectedGame && (
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                        {selectedGame.prizes?.map((p: any, i: number) => (
                            <div 
                                key={i} 
                                onClick={() => setSelectedPrizeIndex(i.toString())} 
                                className={`p-2 border rounded-lg cursor-pointer text-xs transition-colors ${selectedPrizeIndex === i.toString() ? 'bg-green-500 text-black border-green-500 font-bold' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                            >
                                {p.name} <br/> <span className="opacity-70">R$ {Number(p.value).toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CONFIGURAÇÃO DA RODADA */}
            <div className={`lg:col-span-2 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 ${!selectedGame ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 w-full">
                        <h3 className="text-[#ffc700] font-bold text-sm uppercase mb-2">3. Ganha em qual rodada?</h3>
                        <div className="flex items-center gap-4">
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={roundNumber} 
                                onChange={e => setRoundNumber(Number(e.target.value))} 
                                className="flex-1 accent-[#ffc700] h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            />
                            <span className="font-black text-3xl text-white w-16 text-center">{roundNumber}ª</span>
                        </div>
                        <p className="text-zinc-500 text-xs mt-1">
                            {roundNumber === 1 
                                ? "O usuário ganha logo na PRIMEIRA tentativa." 
                                : `O usuário perde ${roundNumber - 1} vezes e ganha na ${roundNumber}ª.`}
                        </p>
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={loading || selectedPrizeIndex === ''}
                        className="w-full md:w-auto bg-[#ffc700] hover:bg-[#e6b300] disabled:opacity-50 text-black font-black py-4 px-8 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-yellow-500/10 transition-transform active:scale-95 whitespace-nowrap"
                    >
                        {loading ? "SALVANDO..." : <><Save size={20}/> SALVAR ARMAÇÃO</>}
                    </button>
                </div>
            </div>
        </div>

        {/* --- LISTA DE INFLUENCIADORES ATIVOS (AQUI FICA SALVO) --- */}
        <div className="pt-8 border-t border-zinc-800">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                <AlertTriangle className="text-blue-500" /> Influenciadores Configurados ({activeRigs.length})
            </h2>
            
            <div className="grid gap-3">
                {activeRigs.map((rig) => (
                    <div key={rig.id} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4 w-full">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 ${rig.active ? 'bg-green-500 text-black' : 'bg-zinc-700 text-zinc-400'}`}>
                                <CheckCircle2 size={20}/>
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm">{rig.userEmail}</p>
                                <p className="text-xs text-zinc-400">
                                    Jogo: <span className="text-white">{rig.gameName}</span> • 
                                    Prêmio: <span className="text-[#ffc700]">{rig.prizeName}</span> • 
                                    Na <span className="text-white font-bold">{rig.triggerOnRound}ª</span> rodada
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded whitespace-nowrap ${rig.active ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {rig.active ? 'AGUARDANDO JOGAR' : 'JÁ REALIZADO'}
                            </span>
                            <button onClick={() => handleDeleteRig(rig.id)} className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir Armação">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}

                {activeRigs.length === 0 && (
                    <div className="text-zinc-600 text-center py-8 bg-zinc-900/30 rounded-xl border border-dashed border-zinc-800">
                        <p>Nenhuma vitória armada no momento.</p>
                        <p className="text-xs mt-1">Use o formulário acima para configurar.</p>
                    </div>
                )}
            </div>
        </div>

    </div>
  );
}