'use client';

import { useState, useRef, useEffect } from 'react';
import ScratchCard from '../components/ScratchCard';
import DepositModal from '../components/DepositModal';
import { AuthModal } from '../components/AuthModal'; 
import ProfileSidebar from '../components/ProfileSidebar';
import NotificationManager from '../components/NotificationManager'; // <--- 1. IMPORTADO AQUI
import confetti from 'canvas-confetti';
import { db, app } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, onSnapshot, updateDoc, increment } from 'firebase/firestore'; 
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  User, Trophy, ChevronLeft, Home as HomeIcon, Grid, PlusCircle, Bell, Zap, Star, XCircle, RotateCw, Gift, ChevronRight, Play, LogOut, Loader2, Dices
} from 'lucide-react';

interface Prize {
  name: string;
  value: number;
  chance: number;
  image?: string; 
}

interface Game {
  id: string;
  name: string;
  price: number;
  cover: string;
  description?: string;
  prizes: Prize[];
}

export default function Home() {
  // --- ESTADOS GERAIS ---
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState(0); 
  const [view, setView] = useState<'LOBBY' | 'GAME'>('LOBBY');
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [prizesGrid, setPrizesGrid] = useState<Prize[]>([]); 
  const [loading, setLoading] = useState(false);
  const [gameId, setGameId] = useState(0);
  
  // --- MODAIS ---
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [layoutConfig, setLayoutConfig] = useState<any>({
    logo: '', banner: '', gameThumb: '', scratchCover: '', color: '#ffc700' 
  });

  const [isGameFinished, setIsGameFinished] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [resultType, setResultType] = useState<'WIN' | 'LOSS' | null>(null);
  const [winningIndices, setWinningIndices] = useState<number[]>([]);
  const [winAmount, setWinAmount] = useState<string>('');
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  // --- EFEITO INICIAL ---
  useEffect(() => {
    if (typeof window !== 'undefined') winAudioRef.current = new Audio('/win.mp3');

    const auth = getAuth(app);
    let unsubscribeSnapshot: any = null;

    const initData = async () => {
        try {
            const docRef = doc(db, 'config', 'layout');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setLayoutConfig(docSnap.data());

            const querySnapshot = await getDocs(collection(db, 'games'));
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Game[];
            setGamesList(list);
        } catch (error) {
            console.error("Erro carregamento inicial", error);
        }
    };

    initData();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setIsAuthOpen(false); 
        const userDocRef = doc(db, 'users', currentUser.uid);
        unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBalance(data.balance || 0);
            }
        });
      } else {
        setBalance(0);
        setIsAuthOpen(true);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // --- FUNÇÕES ---
  
  const handleOpenDeposit = () => {
    if (!user) {
      setIsAuthOpen(true); 
    } else {
      setIsDepositOpen(true); 
    }
  };

  const handleEnterGame = (game: Game) => {
    if (!user) {
      setIsAuthOpen(true); 
      return;
    }
    setActiveGame(game);
    setView('GAME');
    setTimeout(() => { setPrizesGrid([]); setLoading(true); }, 100);
  };

  const handleLogout = () => {
    const auth = getAuth(app);
    signOut(auth);
    setIsProfileOpen(false); 
  };

 // --- LÓGICA DO JOGO ---
  const playRound = async () => {
    if (!activeGame) return;
    
    if (balance < activeGame.price) {
        setIsDepositOpen(true); 
        return;
    }

    if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
            balance: increment(-activeGame.price)
        });
    }

    setLoading(true);
    setIsGameFinished(false);
    setShowPopup(false);
    setWinningIndices([]);
    setWinAmount('');
    setResultType(null);

    if (winAudioRef.current) { winAudioRef.current.pause(); winAudioRef.current.currentTime = 0; }
    await new Promise(resolve => setTimeout(resolve, 500));

    // Lógica simplificada de sorteio
    let winningPrize: Prize | null = null;
    const random = Math.random() * 100;
    let cumulativeChance = 0;
    
    for (const prize of activeGame.prizes) {
        cumulativeChance += (Number(prize.chance) || 0);
        if (random <= cumulativeChance) { winningPrize = prize; break; }
    }

    let finalGrid: Prize[] = [];
    const loserPlaceholder: Prize = { name: 'Tente+', value: 0, chance: 0, image: '' };

    if (winningPrize) {
        finalGrid.push(winningPrize, winningPrize, winningPrize);
        const otherOptions = activeGame.prizes.filter((p: Prize) => p.name !== winningPrize?.name);
        for (let i = 0; i < 6; i++) {
            let selectedFiller = loserPlaceholder;
            if (otherOptions.length > 0) {
                const candidate = otherOptions[Math.floor(Math.random() * otherOptions.length)];
                const count = finalGrid.filter(p => p.name === candidate.name).length;
                if (count < 2) selectedFiller = candidate;
            }
            finalGrid.push(selectedFiller);
        }
    } else {
        for (let i = 0; i < 9; i++) {
            if (Math.random() > 0.3) { finalGrid.push(loserPlaceholder); } 
            else {
                 const randomReal = activeGame.prizes[Math.floor(Math.random() * activeGame.prizes.length)];
                 if (randomReal) {
                     const count = finalGrid.filter(p => p.name === randomReal.name).length;
                     if (count < 2) finalGrid.push(randomReal);
                     else finalGrid.push(loserPlaceholder);
                 } else { finalGrid.push(loserPlaceholder); }
            }
        }
    }
    finalGrid = finalGrid.sort(() => Math.random() - 0.5);
    setPrizesGrid(finalGrid);
    setLoading(false);
    setGameId(prev => prev + 1);
  };

  const checkWinner = () => {
    const counts: Record<string, number[]> = {};
    prizesGrid.forEach((item, index) => {
      if (!counts[item.name]) counts[item.name] = [];
      counts[item.name].push(index);
    });
    const badItems = ['Perdeu', 'Tente+', 'Quase', 'Raspou', 'Não foi', 'Zebra', 'Zero', 'Erro', '0', 'R$ 0,00'];
    for (const [name, indices] of Object.entries(counts)) {
      if (indices.length >= 3 && !badItems.includes(name)) {
        const prizeObj = prizesGrid.find(p => p.name === name);
        const amountDisplay = prizeObj && prizeObj.value > 0 ? `R$ ${prizeObj.value}` : name;
        return { indices: indices, amount: amountDisplay };
      }
    }
    return null;
  };

  const handleGameFinish = () => {
    if (isGameFinished) return;
    setIsGameFinished(true);
    const result = checkWinner();
    if (result) {
      setResultType('WIN');
      setWinningIndices(result.indices);
      setWinAmount(result.amount);
      triggerWin();
          if (user) {
              const prizeValue = prizesGrid[result.indices[0]].value;
              const userRef = doc(db, 'users', user.uid);
              updateDoc(userRef, {
                  balance: increment(prizeValue)
              });
          }
    } else { setResultType('LOSS'); }
    setTimeout(() => { setShowPopup(true); }, 500);
  };

  const triggerWin = () => {
    if (winAudioRef.current) { winAudioRef.current.currentTime = 0; winAudioRef.current.play().catch(() => {}); }
    const duration = 3000;
    const end = Date.now() + duration;
    const interval: any = setInterval(() => {
      if (Date.now() > end) return clearInterval(interval);
      confetti({ startVelocity: 30, spread: 360, ticks: 60, particleCount: 50, origin: { x: Math.random(), y: Math.random() - 0.2 }, colors: [layoutConfig.color, '#ffffff'] });
    }, 250);
  };

  useEffect(() => { if (view === 'GAME' && activeGame) { playRound(); } }, [view, activeGame]);

  const handleBackToLobby = () => {
    setShowPopup(false);
    setIsGameFinished(false);
    setActiveGame(null);
    setView('LOBBY');
  };

  return (
    <>
      {/* 2. ADICIONADO AQUI: O GERENCIADOR DE NOTIFICAÇÕES */}
      <NotificationManager />

      {/* =========================================================================== */}
      {/* 1. LAYOUT MOBILE */}
      {/* =========================================================================== */}
      <div className="md:hidden min-h-screen bg-zinc-950 text-white font-sans pb-24" style={{ selectionBackgroundColor: layoutConfig.color } as any}>
        <header className="fixed top-0 w-full z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view === 'GAME' ? (
              <button onClick={handleBackToLobby} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={28} /></button>
            ) : (
              <div className="h-10 flex items-center justify-center">
                {layoutConfig.logo ? <img src={layoutConfig.logo} alt="Logo" className="h-8 w-auto object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: layoutConfig.color }}><Zap className="text-black fill-current" size={20} /></div>}
              </div>
            )}
            
            <div className="flex flex-col cursor-pointer" onClick={handleOpenDeposit}>
              <span className="text-xs text-zinc-400 font-medium">{user ? 'Saldo Disponível' : 'Faça Login'}</span>
              <span className="text-sm font-bold text-white flex items-center gap-1">
                {user ? `R$ ${balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'Entrar'} 
                <PlusCircle size={14} style={{ color: layoutConfig.color }} />
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-white relative"><Bell size={20} /><span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-800"></span></button>
            
            {user ? (
               <button onClick={() => setIsProfileOpen(true)} className="w-9 h-9 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center hover:bg-zinc-700 transition-colors">
                  <User size={18} className="text-zinc-400" />
               </button>
            ) : (
               <button onClick={() => setIsAuthOpen(true)} className="w-9 h-9 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center">
                  <User size={18} className="text-zinc-400" />
               </button>
            )}
          </div>
        </header>

        <div className="h-20"></div>

        {view === 'GAME' && activeGame ? (
          <main className="flex flex-col items-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-full max-w-sm flex justify-between items-end mb-4">
              <div><h1 className="text-2xl font-black italic text-white tracking-tight uppercase">{activeGame.name}</h1><p className="text-zinc-500 text-xs font-medium">Encontre 3 símbolos iguais</p></div>
              <div className="bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 flex items-center gap-2"><span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: layoutConfig.color }}></span><span className="text-xs text-zinc-300 font-bold">Ao Vivo</span></div>
            </div>
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-3xl p-1 shadow-2xl border border-zinc-800 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-32 opacity-40" style={{ background: `linear-gradient(to bottom, ${layoutConfig.color}33, transparent)` }}></div>
              <div className="relative bg-zinc-950 rounded-[20px] p-4 border border-zinc-800/50">
                {loading || prizesGrid.length === 0 ? (
                  <div className="w-full aspect-square flex flex-col items-center justify-center gap-4 text-zinc-500">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: layoutConfig.color }}></div>
                    <span className="text-xs font-medium uppercase tracking-widest">Carregando Bilhete...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg border-2 border-zinc-800 group">
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2 p-2 bg-zinc-900">
                        {prizesGrid.map((prize, index) => (
                          <div key={index} className={`rounded-lg flex flex-col items-center justify-center border transition-all duration-500 overflow-hidden relative ${winningIndices.includes(index) ? 'border-white z-10 scale-105 shadow-lg' : 'bg-white border-zinc-300'}`} style={winningIndices.includes(index) ? { backgroundColor: layoutConfig.color, boxShadow: `0 0 20px ${layoutConfig.color}99` } : {}}>
                            {prize.image ? <img src={prize.image} alt={prize.name} className="w-[80%] h-[80%] object-contain drop-shadow-sm" /> : <span className={`font-black text-center leading-tight select-none p-1 ${winningIndices.includes(index) ? 'text-black text-xs' : 'text-zinc-900 text-[10px]'}`}>{prize.name}</span>}
                          </div>
                        ))}
                      </div>
                      <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage={layoutConfig.scratchCover} />
                    </div>
                    {!isGameFinished ? (
                      <button onClick={handleGameFinish} className="w-full bg-zinc-800 hover:bg-zinc-700 font-bold py-3.5 rounded-xl border border-zinc-700 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg" style={{ color: layoutConfig.color }}><Zap size={18} className="fill-current" /> <span className="text-sm tracking-wide">REVELAR TUDO</span></button>
                    ) : (
                      <button onClick={playRound} className="w-full hover:opacity-90 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 animate-pulse" style={{ backgroundColor: layoutConfig.color, boxShadow: `0 4px 14px ${layoutConfig.color}66` }}><Zap size={18} className="fill-current" /> <span className="text-sm tracking-wide">COMPRAR NOVA (R$ {activeGame.price})</span></button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="w-full max-w-sm mt-8">
              <h3 className="text-zinc-400 text-sm font-bold mb-3 flex items-center gap-2"><Star size={14} style={{ color: layoutConfig.color }} className="fill-current" /> Tabela de Prêmios</h3>
              <div className="grid grid-cols-3 gap-3">
                 {activeGame.prizes && activeGame.prizes.map((p: any, i: number) => (
                     <div key={i} className="bg-zinc-900 p-2 rounded-xl border border-zinc-800 flex flex-col items-center justify-center gap-1 min-h-[80px]">
                         {p.image ? <img src={p.image} className="h-8 w-8 object-contain mb-1" /> : null}
                         <span className="font-bold text-[10px] text-center leading-tight text-white">{p.name}</span>
                         <span className="text-[10px] text-zinc-500 uppercase font-bold" style={{ color: layoutConfig.color }}>R$ {p.value}</span>
                     </div>
                 ))}
              </div>
            </div>
          </main>
        ) : (
          <main className="px-4 pb-8">
            <div className="w-full rounded-2xl relative overflow-hidden shadow-lg border border-zinc-800 mb-8 group bg-zinc-900">
              {layoutConfig.banner ? <img src={layoutConfig.banner} alt="Banner" className="w-full h-auto object-contain block" /> : <div className="h-52 relative overflow-hidden flex items-center justify-center bg-zinc-800"><span className="text-zinc-600 font-bold">Sem Banner</span></div>}
            </div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Grid size={18} style={{ color: layoutConfig.color }} /> Destaques</h3>
            <div className="flex flex-col gap-5">
              {gamesList.length > 0 ? (
                  gamesList.map((game) => {
                      const maxPrize = Math.max(...(game.prizes?.map(p => Number(p.value) || 0) || [0]));
                      const description = game.description || "Ache 3 símbolos iguais e ganhe prêmios instantâneos.";
                      return (
                      <div key={game.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-lg">
                          <div className="w-full h-44 bg-zinc-950 relative flex items-center justify-center overflow-hidden">
                               {game.cover ? <img src={game.cover} alt={game.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">Sem Imagem</div>}
                          </div>
                          <div className="p-4 flex flex-col gap-1 items-start text-left">
                              <h3 className="text-white font-bold text-lg leading-tight">{game.name}</h3>
                              <span className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: layoutConfig.color }}>PRÊMIOS DE ATÉ R$ {maxPrize.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2 mb-3">{description}</p>
                              <div className="w-full flex items-center justify-between mt-auto">
                                  <button onClick={() => handleEnterGame(game)} className="flex items-center gap-2 px-4 py-2 rounded-lg transition-transform active:scale-95 hover:brightness-110" style={{ backgroundColor: layoutConfig.color }}>
                                      <div className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center"><Zap size={10} className="text-black fill-current" /></div>
                                      <span className="text-black font-black text-sm uppercase">JOGAR</span>
                                      <div className="bg-black/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-black">R$ {game.price}</div>
                                  </button>
                                  <button className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors"><Gift size={12} /> VER PRÊMIOS <ChevronRight size={10} /></button>
                              </div>
                          </div>
                      </div>
                      );
                  })
              ) : <div className="text-center py-10 text-zinc-500 text-sm">Carregando jogos...</div>}
            </div>
          </main>
        )}

        <div className="fixed bottom-0 w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 pb-6 pt-2 px-6 flex justify-between items-center z-50 h-20 shadow-2xl">
          <button onClick={handleBackToLobby} className={`flex flex-col items-center gap-1 ${view === 'LOBBY' ? '' : 'text-zinc-500'}`} style={view === 'LOBBY' ? { color: layoutConfig.color } : {}}><HomeIcon size={24} strokeWidth={view === 'LOBBY' ? 3 : 2} /><span className="text-[10px] font-medium">Início</span></button>
          
          <button className="flex flex-col items-center gap-1 text-zinc-500"><Dices size={24} /><span className="text-[10px] font-medium">Roleta</span></button>
          
          <div className="relative -top-6"><button onClick={handleOpenDeposit} className="text-black p-4 rounded-full transition-transform active:scale-95 border-4 border-zinc-950" style={{ backgroundColor: layoutConfig.color, boxShadow: `0 0 20px ${layoutConfig.color}66` }}><PlusCircle size={32} strokeWidth={2.5} /></button></div>
          
          <button className="flex flex-col items-center gap-1 text-zinc-500"><Trophy size={24} /><span className="text-[10px] font-medium">Ganhadores</span></button>
          
          <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className={`flex flex-col items-center gap-1 ${isProfileOpen ? 'text-white' : 'text-zinc-500'}`}><User size={24} /><span className="text-[10px] font-medium">Perfil</span></button>
        </div>
      </div>

      {/* =========================================================================== */}
      {/* 2. LAYOUT DESKTOP */}
      {/* =========================================================================== */}
      <div className="hidden md:flex flex-col min-h-screen bg-[#09090b] text-white font-sans selection:bg-yellow-500/30">
        
        <header className="fixed top-0 w-full z-50 bg-zinc-950/95 backdrop-blur-md border-b border-white/5 h-20 flex items-center px-12 justify-between">
            <div className="flex items-center gap-10">
                <div className="flex items-center gap-2 cursor-pointer" onClick={handleBackToLobby}>
                    {layoutConfig.logo ? (
                        <img src={layoutConfig.logo} alt="Logo" className="h-10 w-auto object-contain" />
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: layoutConfig.color }}>
                                <Zap className="text-black fill-current" size={20} />
                            </div>
                            <span className="font-black text-2xl tracking-tighter italic">RASPA<span style={{ color: layoutConfig.color }}>DOURADA</span></span>
                        </div>
                    )}
                </div>

                <nav className="flex items-center gap-8">
                    <a href="#" className="text-sm font-bold text-white hover:text-yellow-500 transition-colors uppercase tracking-wide">Início</a>
                    <a href="#" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wide flex items-center gap-1"><Dices size={16}/> Roleta</a>
                    <a href="#" className="text-sm font-bold text-zinc-400 hover:text-white transition-colors uppercase tracking-wide">Promoções</a>
                </nav>
            </div>

            <div className="flex items-center gap-4">
                {user ? (
                    <>
                        <div className="flex flex-col items-end cursor-pointer group" onClick={handleOpenDeposit}>
                            <span className="text-xs text-zinc-400 font-medium group-hover:text-white">Saldo</span>
                            <span className="text-base font-bold text-white flex items-center gap-2 bg-zinc-900 px-4 py-1.5 rounded-full border border-zinc-800 group-hover:border-yellow-500 transition-all">
                                R$ {balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})} <PlusCircle size={18} style={{ color: layoutConfig.color }} />
                            </span>
                        </div>
                        <div className="h-8 w-px bg-white/10 mx-2"></div>
                        
                        <button onClick={() => setIsProfileOpen(true)} className="flex items-center gap-2 text-zinc-500 hover:text-white font-bold text-sm">
                           <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center"><User size={16}/></div>
                           Perfil
                        </button>
                    </>
                ) : (
                    <>
                          <button onClick={() => setIsAuthOpen(true)} className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm transition-colors">Cadastrar</button>
                          <button onClick={() => setIsAuthOpen(true)} className="bg-yellow-500 hover:bg-yellow-400 text-black px-6 py-2.5 rounded-lg font-black text-sm flex items-center gap-2 transition-colors">ENTRAR</button>
                    </>
                )}
            </div>
        </header>

        <div className="pt-24 pb-12 flex-1">
            {view === 'GAME' && activeGame ? (
                <div className="max-w-6xl mx-auto px-8 flex gap-12 items-start justify-center animate-in fade-in zoom-in duration-300">
                    <div className="flex-1 max-w-[500px]">
                        <div className="relative w-full aspect-square bg-zinc-900 rounded-[2rem] p-4 shadow-2xl border border-zinc-800 overflow-hidden ring-1 ring-white/5">
                            <div className="relative w-full h-full bg-zinc-950 rounded-[1.5rem] p-6 border border-zinc-800/50">
                                <div className="absolute inset-0 m-6 grid grid-cols-3 grid-rows-3 gap-3">
                                    {prizesGrid.map((prize, index) => (
                                        <div key={index} className={`rounded-xl flex flex-col items-center justify-center border transition-all duration-500 overflow-hidden relative bg-white ${winningIndices.includes(index) ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)] z-10 scale-105' : 'border-zinc-300 opacity-90'}`}>
                                            {prize.image ? <img src={prize.image} className="w-3/4 h-3/4 object-contain" /> : <span className="text-black font-black text-sm text-center">{prize.name}</span>}
                                        </div>
                                    ))}
                                </div>
                                {loading ? (
                                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-900 rounded-[1.5rem]">
                                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-yellow-500"></div>
                                        <span className="mt-4 text-sm font-bold uppercase tracking-widest text-zinc-500">Carregando...</span>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 m-6 rounded-xl overflow-hidden z-20 shadow-lg">
                                        <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage={layoutConfig.scratchCover} />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="w-[400px] flex flex-col gap-6 pt-4">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="bg-red-500/20 text-red-500 border border-red-500/50 px-3 py-1 rounded text-[10px] font-bold uppercase animate-pulse">Ao Vivo</span>
                                <h1 className="text-5xl font-black italic text-white uppercase tracking-tighter leading-none">{activeGame.name}</h1>
                            </div>
                            <p className="text-zinc-400 text-sm leading-relaxed">Encontre 3 símbolos iguais para ganhar. Prêmios creditados instantaneamente.</p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-xl">
                            {!isGameFinished ? (
                                <button onClick={handleGameFinish} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white hover:text-yellow-500 font-black py-5 rounded-2xl border border-zinc-700 flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg uppercase tracking-wider text-base">
                                    <Zap size={24} className="fill-current text-yellow-500" /> REVELAR TUDO
                                </button>
                            ) : (
                                <button onClick={playRound} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 animate-pulse shadow-lg uppercase tracking-wider text-base">
                                    <RotateCw size={24} strokeWidth={3} /> JOGAR DE NOVO (R$ {activeGame.price})
                                </button>
                            )}
                        </div>

                        <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6">
                            <h3 className="text-zinc-500 text-xs font-bold mb-4 uppercase tracking-widest flex items-center gap-2"><Star size={14}/> Tabela de Prêmios</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {activeGame.prizes && activeGame.prizes.map((p: any, i: number) => (
                                    <div key={i} className="bg-black/30 p-3 rounded-xl border border-white/5 flex flex-col items-center justify-center hover:bg-white/5 transition-colors">
                                        <span className="text-[10px] text-zinc-400 font-bold mb-1">{p.name}</span>
                                        <span className="text-sm font-black text-yellow-500">R$ {p.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-7xl mx-auto px-8">
                    <div className="w-full h-[400px] rounded-[2rem] relative overflow-hidden shadow-2xl border border-zinc-800 mb-12 group">
                        {layoutConfig.banner ? (
                            <img src={layoutConfig.banner} alt="Banner" className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" />
                        ) : (
                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-zinc-600 font-bold text-2xl">Banner Principal</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent flex items-end p-12 pointer-events-none">
                             <div className="pointer-events-auto">
                                <h2 className="text-6xl font-black text-white mb-4 drop-shadow-lg">RASPE E GANHE</h2>
                                <button onClick={() => !user && setIsAuthOpen(true)} className="bg-white hover:bg-zinc-200 text-black px-10 py-4 rounded-full font-black text-sm shadow-xl transition-transform hover:scale-105 flex items-center gap-2">
                                    <Play size={20} fill="black" /> COMEÇAR AGORA
                                </button>
                             </div>
                        </div>
                    </div>

                    <h3 className="text-3xl font-black text-white mb-8 flex items-center gap-3">
                        <Grid className="text-yellow-500" size={32} /> Jogos em Destaque
                    </h3>

                    <div className="grid grid-cols-4 gap-8">
                        {gamesList.length > 0 ? (
                            gamesList.map((game) => {
                                const maxPrize = Math.max(...(game.prizes?.map(p => Number(p.value) || 0) || [0]));
                                return (
                                <div key={game.id} className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-xl hover:border-yellow-500/50 hover:shadow-yellow-500/20 transition-all group flex flex-col h-[420px]">
                                    <div className="w-full h-56 bg-zinc-950 relative overflow-hidden">
                                        {game.cover ? <img src={game.cover} alt={game.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">Sem Imagem</div>}
                                        <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 text-white text-xs font-bold">R$ {game.price}</div>
                                    </div>
                                    <div className="p-6 flex flex-col gap-2 flex-1">
                                        <h3 className="text-white font-bold text-xl leading-tight group-hover:text-yellow-500 transition-colors">{game.name}</h3>
                                        <p className="text-zinc-500 text-sm line-clamp-2">{game.description || "Tente a sorte e ganhe prêmios instantâneos."}</p>
                                        
                                        <div className="mt-auto pt-4 border-t border-white/5 flex flex-col gap-3">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-zinc-400 font-bold uppercase">Prêmio Máximo</span>
                                                <span className="text-yellow-500 font-black text-base">R$ {maxPrize.toLocaleString('pt-BR')}</span>
                                            </div>
                                            <button onClick={() => handleEnterGame(game)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-3 rounded-xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg">
                                                <Zap size={18} className="fill-current" /> JOGAR
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })
                        ) : <div className="col-span-4 py-20 text-center text-zinc-500">Carregando jogos...</div>}
                    </div>
                </div>
            )}
        </div>
      </div>

      {showPopup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[70] p-6 animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 border border-zinc-800 text-center relative shadow-2xl">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 ${resultType === 'WIN' ? 'text-black shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`} style={resultType === 'WIN' ? { backgroundColor: layoutConfig.color, borderColor: '#fff' } : {}}>
              {resultType === 'WIN' ? <Trophy size={40} className="fill-current" /> : <XCircle size={40} />}
            </div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic">{resultType === 'WIN' ? 'Parabéns!' : 'Não foi dessa vez'}</h2>
            {resultType === 'WIN' ? (
              <div className="p-4 rounded-2xl border mb-6" style={{ backgroundColor: `${layoutConfig.color}1a`, borderColor: `${layoutConfig.color}33` }}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: layoutConfig.color }}>Você ganhou</p>
                <p className="text-4xl font-black tracking-tighter" style={{ color: layoutConfig.color }}>{winAmount}</p>
              </div>
            ) : <p className="text-zinc-400 text-sm mb-8 leading-relaxed">A sorte está acumulada! Tente novamente.</p>}
            <button onClick={playRound} className="w-full text-black font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform mb-3" style={{ backgroundColor: layoutConfig.color }}><RotateCw size={20} strokeWidth={3} /> JOGAR NOVAMENTE</button>
            <button onClick={handleBackToLobby} className="text-zinc-500 font-bold text-sm hover:text-white py-2">Voltar ao Início</button>
          </div>
        </div>
      )}

      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onLoginSuccess={(u) => {
            setUser(u);
            setIsDepositOpen(true); 
        }} 
      />

      <DepositModal 
        isOpen={isDepositOpen} 
        onClose={() => setIsDepositOpen(false)} 
        userId={user?.uid} 
        userEmail={user?.email} 
      />

      <ProfileSidebar 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        user={user}
        balance={balance}
        onLogout={handleLogout}
      />
    </>
  );
}