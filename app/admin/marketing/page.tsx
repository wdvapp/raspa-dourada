'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { Megaphone, Search, UserCheck, Trophy, Target, Save, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function InfluencerMode() {
  const [loading, setLoading] = useState(false);
  
  // 1. BUSCA DE USUÁRIO
  const [emailSearch, setEmailSearch] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);

  // 2. SELEÇÃO DO JOGO
  const [games, setGames] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any>(null);

  // 3. CONFIGURAÇÃO DA VITÓRIA
  const [selectedPrizeIndex, setSelectedPrizeIndex] = useState<string>(''); // Index do array de prêmios
  const [roundNumber, setRoundNumber] = useState(1); // Ganhar na 1ª, 2ª, 3ª tentativa...

  // Carrega os jogos disponíveis assim que abre a tela
  useEffect(() => {
    const fetchGames = async () => {
      const snap = await getDocs(collection(db, 'games'));
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    fetchGames();
  }, []);

  // Função para buscar usuário pelo E-mail
  const handleSearchUser = async () => {
    if (!emailSearch) return;
    setLoading(true);
    setFoundUser(null);
    try {
      // Busca exata pelo email
      const q = query(collection(db, 'users'), where('email', '==', emailSearch));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const userDoc = snap.docs[0];
        setFoundUser({ id: userDoc.id, ...userDoc.data() });
      } else {
        alert("Usuário não encontrado!");
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar usuário.");
    } finally {
      setLoading(false);
    }
  };

  // Função para Salvar a "Manipulação"
  const handleSaveRiggedResult = async () => {
    if (!foundUser || !selectedGame || selectedPrizeIndex === '') return alert("Preencha tudo!");

    setLoading(true);
    try {
      // Salva na coleção 'rigged_wins' (Vitórias Armadas)
      // O Jogo terá que ler essa coleção antes de sortear o resultado aleatório
      await addDoc(collection(db, 'rigged_wins'), {
        userId: foundUser.id,
        userEmail: foundUser.email,
        gameId: selectedGame.id,
        prizeIndex: Number(selectedPrizeIndex),
        triggerOnRound: Number(roundNumber), // Ex: Ganhar na tentativa 3
        active: true, // Ainda não foi usado
        createdAt: Date.now()
      });

      alert(`✅ SUCESSO!\n\nQuando o usuário ${foundUser.email} jogar "${selectedGame.name}", ele vai ganhar o prêmio na jogada nº ${roundNumber}.`);
      
      // Limpar campos
      setFoundUser(null);
      setEmailSearch('');
      setSelectedGame(null);
      setSelectedPrizeIndex('');
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar configuração.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 text-white space-y-8">
        
        <div>
            <h1 className="text-3xl font-black mb-2 flex items-center gap-2">
                <Megaphone className="text-[#ffc700]"/> Modo Influenciador
            </h1>
            <p className="text-zinc-500">Configure uma vitória garantida para gravar vídeos de divulgação.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* PASSO 1: ENCONTRAR O USUÁRIO */}
            <div className={`p-6 rounded-2xl border ${foundUser ? 'bg-green-900/10 border-green-500/50' : 'bg-zinc-900 border-zinc-800'}`}>
                <h3 className="font-bold text-[#ffc700] text-sm uppercase mb-4 flex items-center gap-2">1. Selecionar Influenciador</h3>
                
                <div className="flex gap-2 mb-4">
                    <input 
                        type="email" 
                        placeholder="E-mail do usuário..." 
                        value={emailSearch}
                        onChange={e => setEmailSearch(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm focus:border-[#ffc700] outline-none"
                    />
                    <button onClick={handleSearchUser} disabled={loading} className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-xl transition-colors">
                        <Search size={20} />
                    </button>
                </div>

                {foundUser && (
                    <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-green-900/30">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-500 flex items-center justify-center">
                            <UserCheck size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">{foundUser.email}</p>
                            <p className="text-xs text-zinc-500">ID: ...{foundUser.id.slice(-6)}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* PASSO 2: ESCOLHER O JOGO */}
            <div className={`p-6 rounded-2xl border ${selectedGame ? 'bg-[#ffc700]/5 border-[#ffc700]/30' : 'bg-zinc-900 border-zinc-800'} ${!foundUser ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="font-bold text-[#ffc700] text-sm uppercase mb-4 flex items-center gap-2">2. Escolher Raspadinha</h3>
                
                <select 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:border-[#ffc700] outline-none"
                    onChange={(e) => {
                        const game = games.find(g => g.id === e.target.value);
                        setSelectedGame(game);
                        setSelectedPrizeIndex(''); // Reseta prêmio se trocar jogo
                    }}
                >
                    <option value="">Selecione um jogo...</option>
                    {games.map(g => (
                        <option key={g.id} value={g.id}>{g.name} (R$ {Number(g.price).toFixed(2)})</option>
                    ))}
                </select>

                {selectedGame && (
                    <div className="mt-4 flex gap-3">
                        <img src={selectedGame.cover} className="w-16 h-16 object-cover rounded-lg border border-zinc-700" />
                        <div>
                            <p className="font-bold text-sm">{selectedGame.name}</p>
                            <p className="text-xs text-zinc-500">{selectedGame.prizes?.length || 0} prêmios disponíveis</p>
                        </div>
                    </div>
                )}
            </div>

            {/* PASSO 3: O PRÊMIO E A RODADA */}
            <div className={`md:col-span-2 p-6 rounded-2xl border bg-zinc-900 border-zinc-800 ${!selectedGame ? 'opacity-50 pointer-events-none' : ''}`}>
                <h3 className="font-bold text-[#ffc700] text-sm uppercase mb-4 flex items-center gap-2">3. Configurar Vitória</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Escolher Prêmio */}
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase block mb-2">Qual prêmio ele vai ganhar?</label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {selectedGame?.prizes?.map((prize: any, idx: number) => (
                                <div 
                                    key={idx}
                                    onClick={() => setSelectedPrizeIndex(idx.toString())}
                                    className={`p-3 rounded-xl border cursor-pointer flex items-center gap-2 transition-all ${selectedPrizeIndex === idx.toString() ? 'bg-green-500 text-black border-green-400' : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-600'}`}
                                >
                                    <Trophy size={16} />
                                    <div>
                                        <p className="font-bold text-xs">{prize.name}</p>
                                        <p className="text-[10px] opacity-80">R$ {Number(prize.value).toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Escolher Rodada */}
                    <div>
                        <label className="text-xs font-bold text-zinc-400 uppercase block mb-2">Em qual tentativa?</label>
                        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold">Rodada nº {roundNumber}</span>
                                <Target className="text-[#ffc700]" size={20} />
                            </div>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                step="1"
                                value={roundNumber}
                                onChange={(e) => setRoundNumber(Number(e.target.value))}
                                className="w-full accent-[#ffc700] h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                            />
                            <p className="text-xs text-zinc-500 mt-2">
                                {roundNumber === 1 ? 'Ele vai ganhar logo na PRIMEIRA vez que jogar.' : `Ele vai perder ${roundNumber - 1} vezes e ganhar na ${roundNumber}ª.`}
                            </p>
                        </div>

                        <button 
                            onClick={handleSaveRiggedResult}
                            disabled={loading || selectedPrizeIndex === ''}
                            className="w-full mt-6 bg-[#ffc700] hover:bg-[#e6b300] disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl shadow-lg shadow-yellow-500/10 flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                            {loading ? "Salvando..." : <><Save size={20} /> ARMAR VITÓRIA</>}
                        </button>
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
}