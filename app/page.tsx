// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import ScratchCard from '../components/ScratchCard';
import DepositModal from '../components/DepositModal';
import { AuthModal } from '../components/AuthModal'; 
import ProfileSidebar from '../components/ProfileSidebar';
// NotificationManager removido para evitar erros
import confetti from 'canvas-confetti';
import { db, app } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, onSnapshot, updateDoc, increment, serverTimestamp, query, orderBy } from 'firebase/firestore'; 
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  User, Trophy, ChevronLeft, Home as HomeIcon, Grid, PlusCircle, Bell, Zap, Star, XCircle, RotateCw, Gift, ChevronRight, Play, X, Clock
} from 'lucide-react';

// --- INTERFACES ---
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

interface Winner {
  id: string;
  image?: string;
  url?: string;
  photo?: string;
  name?: string;
  city?: string;
  amount?: number;
}

export default function Home() {
  // --- ESTADOS GERAIS ---
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState(0); 
  const [view, setView] = useState<'LOBBY' | 'GAME' | 'WINNERS'>('LOBBY');
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [winnersList, setWinnersList] = useState<Winner[]>([]); 
  const [activeGame, setActiveGame] = useState<any>(null);
  const [prizesGrid, setPrizesGrid] = useState<Prize[]>([]); 
  const [loading, setLoading] = useState(false);
  const [gameId, setGameId] = useState(0);
   
  // --- CONFIGURAÇÃO ---
  const [dailyGiftConfig, setDailyGiftConfig] = useState({ active: false, amount: 0 });
  const [showNotifications, setShowNotifications] = useState(false);
  
  // --- POPUPS ---
  const [previewGame, setPreviewGame] = useState<Game | null>(null);
  const [showMysteryBox, setShowMysteryBox] = useState(false);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [claimingBonus, setClaimingBonus] = useState(false);

  // --- MODAIS ---
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // CONFIGURAÇÃO VISUAL (Capa Dourada Fixa)
  const [layoutConfig, setLayoutConfig] = useState<any>({
    logo: '', 
    banner: '/banner-tigre.jpg', 
    gameThumb: '', 
    scratchCover: '/gold.png', // Garante que a capa é o arquivo gold.png
    color: '#ffc700' 
  });

  const [isGameFinished, setIsGameFinished] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [resultType, setResultType] = useState<'WIN' | 'LOSS' | null>(null);
  const [winningIndices, setWinningIndices] = useState<number[]>([]);
  const [winAmount, setWinAmount] = useState<string>('');
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  const formatCurrency = (value: number | undefined) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  // --- STARTUP ---
  useEffect(() => {
    if (typeof window !== 'undefined') winAudioRef.current = new Audio('/win.mp3');
    const auth = getAuth(app);
    let unsubSnap: any = null;

    const initData = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'config', 'layout'));
            if (docSnap.exists()) setLayoutConfig((prev: any) => ({...prev, ...docSnap.data(), scratchCover: '/gold.png'}));
            
            onSnapshot(doc(db, 'config', 'daily_gift'), (snap) => { 
                if(snap.exists()) setDailyGiftConfig(snap.data() as any); 
            });

            const gSnap = await getDocs(collection(db, 'games'));
            setGamesList(gSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Game[]);
            
            const wSnap = await getDocs(collection(db, 'winners'));
            setWinnersList(wSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Winner[]);
        } catch (e) { console.error(e); }
    };

    initData();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (unsubSnap) unsubSnap();

      if (currentUser) {
        setIsAuthOpen(false); 
        unsubSnap = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
            if (snap.exists()) {
                setBalance(snap.data().balance || 0);
                checkBonusAvailability(snap.data().lastDailyBonus);
            }
        });
      } else {
        setBalance(0);
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubSnap) unsubSnap();
    };
  }, []);

  const checkBonusAvailability = (last: any) => {
      if (!last) { setBonusAvailable(true); return; }
      const lastDate = typeof last.toDate === 'function' ? last.toDate().getTime() : new Date(last).getTime();
      const diff = new Date().getTime() - lastDate;
      if (diff >= 86400000) setBonusAvailable(true);
      else {
          setBonusAvailable(false);
          const rem = 86400000 - diff;
          setTimeLeft(`${Math.floor(rem / 3600000)}h ${Math.floor((rem % 3600000) / 60000)}m`);
      }
  };

  const claimDailyBonus = async () => {
      if (!user || !bonusAvailable || !dailyGiftConfig.active) return;
      setClaimingBonus(true);
      try {
          await updateDoc(doc(db, 'users', user.uid), { balance: increment(dailyGiftConfig.amount), lastDailyBonus: serverTimestamp() });
          triggerWin(); 
          setShowMysteryBox(false);
      } catch (e) { console.error(e); } finally { setClaimingBonus(false); }
  };

  // --- LÓGICA DO JOGO ---
  const handleEnterGame = (game: Game) => {
    if (!user) return setIsAuthOpen(true);
    if (balance < game.price) { 
        setActiveGame(game); 
        setIsDepositOpen(true); 
        return; 
    }
    setActiveGame(game);
    setView('GAME');
    playRound(game); // INICIA JOGO IMEDIATAMENTE
  };

  const playRound = async (gameOverride?: Game) => {
    const game = gameOverride || activeGame;
    if (!game || balance < game.price) return;
    
    if (user) await updateDoc(doc(db, 'users', user.uid), { balance: increment(-game.price) });

    setLoading(true);
    setIsGameFinished(false);
    setShowPopup(false);
    setWinningIndices([]);
    setWinAmount('');
    setResultType(null);

    await new Promise(r => setTimeout(r, 600));

    let winP: Prize | null = null;
    const rand = Math.random() * 100;
    let cumul = 0;
    for (const p of game.prizes) {
        cumul += Number(p.chance);
        if (rand <= cumul) { winP = p; break; }
    }

    let grid: Prize[] = [];
    const loserPlaceholder: Prize = { name: 'Tente+', value: 0, chance: 0, image: '' }; 

    if (winP) {
        grid.push(winP, winP, winP);
        const others = game.prizes.filter(p => p.name !== winP?.name);
        for (let i = 0; i < 6; i++) {
            grid.push(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : loserPlaceholder);
        }
    } else {
        const counts: Record<string, number> = {};
        for (let i = 0; i < 9; i++) {
            let cand = game.prizes[Math.floor(Math.random() * game.prizes.length)];
            if ((counts[cand.name] || 0) >= 2) {
                cand = loserPlaceholder;
            }
            grid.push(cand);
            counts[cand.name] = (counts[cand.name] || 0) + 1;
        }
    }

    setPrizesGrid(grid.sort(() => Math.random() - 0.5));
    setLoading(false);
    setGameId(p => p + 1);
  };

  const handleGameFinish = () => {
    if (isGameFinished) return;
    setIsGameFinished(true); // REVELA TUDO
    
    const counts: Record<string, number[]> = {};
    prizesGrid.forEach((p, i) => { counts[p.name] = [...(counts[p.name] || []), i]; });
    
    let winner = null;
    const badItems = ['Tente+', '0', 'R$ 0,00'];

    for (const [name, idxs] of Object.entries(counts)) {
        if (badItems.includes(name)) continue;
        const pObj = prizesGrid.find(p => p.name === name);
        if (idxs.length >= 3 && pObj && pObj.value > 0) {
            winner = { idxs, amount: formatCurrency(pObj.value), val: pObj.value };
            break;
        }
    }

    if (winner) {
      setResultType('WIN');
      setWinningIndices(winner.idxs);
      setWinAmount(winner.amount);
      triggerWin();
      if (user) updateDoc(doc(db, 'users', user.uid), { balance: increment(winner.val) });
    } else { 
      setResultType('LOSS'); 
    }
    setTimeout(() => setShowPopup(true), 1000);
  };

  const triggerWin = () => {
    if (winAudioRef.current) { winAudioRef.current.currentTime = 0; winAudioRef.current.play().catch(() => {}); }
    // CHUVA DE CONFETES
    const duration = 3000;
    const end = Date.now() + duration;
    (function frame() {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#FFD700', '#FFF'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700', '#FFF'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    }());
  };

  const handleBackToLobby = () => { setShowPopup(false); setIsGameFinished(false); setActiveGame(null); setView('LOBBY'); };
  const handleLogout = () => { signOut(getAuth(app)); setIsProfileOpen(false); };

  return (
    <>
      {/* MOBILE CONTAINER (APP STYLE) */}
      <div className="md:hidden min-h-screen bg-zinc-950 text-white font-sans pb-24">
        <header className="fixed top-0 w-full z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'LOBBY' ? (
              <button onClick={handleBackToLobby} className="p-2 -ml-2 text-zinc-400 hover:text-white"><ChevronLeft size={28} /></button>
            ) : (
              <div className="h-10 flex items-center justify-center">
                 <span className="font-black italic text-xl tracking-tighter text-white">RASPA<span style={{color: layoutConfig.color}}>DOURADA</span></span>
              </div>
            )}
            <div className="flex flex-col cursor-pointer" onClick={() => user ? setIsDepositOpen(true) : setIsAuthOpen(true)}>
              <span className="text-xs text-zinc-400 font-bold uppercase text-[9px]">Saldo</span>
              <span className="text-sm font-bold text-white flex items-center gap-1">{user ? formatCurrency(balance) : 'Entrar'} <PlusCircle size={14} style={{ color: layoutConfig.color }} /></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-white relative">
                <Bell size={20} />
            </button>
            <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="w-9 h-9 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center">
                <User size={18} className="text-zinc-400" />
            </button>
          </div>
        </header>

        <div className="h-20"></div>

        {view === 'WINNERS' && (
             <main className="px-4 pb-8 animate-in fade-in">
                 <div className="text-center mb-8 mt-4"><h2 className="text-2xl font-black text-white uppercase italic">Galeria <span style={{ color: layoutConfig.color }}>Vip</span></h2></div>
                 <div className="flex flex-col gap-6">
                     {winnersList.map((winner, index) => (
                         <div key={index} className="rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative bg-zinc-900">
                             <img src={winner.image || winner.url || winner.photo} className="w-full h-auto object-cover" /> 
                             <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-6">
                                 <p className="text-yellow-500 font-black text-xl">{formatCurrency(winner.amount || 0)}</p>
                                 <p className="text-white font-bold">{winner.name}</p>
                                 <p className="text-zinc-400 text-xs">{winner.city}</p>
                             </div>
                         </div>
                     ))}
                 </div>
                 <button onClick={handleBackToLobby} className="w-full mt-8 bg-zinc-800 text-white font-bold py-4 rounded-xl">Voltar</button>
             </main>
        )}

        {view === 'GAME' && activeGame && (
          <main className="flex flex-col items-center px-4 animate-in fade-in">
            <div className="w-full max-w-sm flex justify-between items-end mb-4">
              <div><h1 className="text-2xl font-black italic text-white tracking-tight uppercase">{activeGame.name}</h1><p className="text-zinc-500 text-xs font-medium">Encontre 3 símbolos iguais</p></div>
              <div className="bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 flex items-center gap-2"><span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: layoutConfig.color }}></span><span className="text-xs text-zinc-300 font-bold">Ao Vivo</span></div>
            </div>
            
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-3xl p-1 shadow-2xl border border-zinc-800 overflow-hidden">
              <div className="relative bg-zinc-950 rounded-[20px] p-4 border border-zinc-800/50">
                {loading ? (
                  <div className="w-full aspect-square flex flex-col items-center justify-center gap-4 text-zinc-500">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: layoutConfig.color }}></div>
                      <span className="text-xs font-medium uppercase tracking-widest">Carregando...</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg border-2 border-zinc-800 group">
                      
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2 p-2 bg-zinc-900">
                        {prizesGrid.map((prize, index) => (
                          <div key={index} className={`rounded-lg flex flex-col items-center justify-center border transition-all duration-500 overflow-hidden relative ${winningIndices.includes(index) ? 'border-white z-10 scale-105 shadow-lg' : 'bg-white border-zinc-300'}`} style={winningIndices.includes(index) ? { backgroundColor: layoutConfig.color } : {}}>
                            {prize.image ? <img src={prize.image} className="w-[80%] h-[80%] object-contain" /> : <span className="font-black text-black text-[10px] text-center p-1">{prize.name}</span>}
                          </div>
                        ))}
                      </div>

                      <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage={layoutConfig.scratchCover} />
                    
                    </div>
                    {!isGameFinished ? 
                        <button onClick={handleGameFinish} className="w-full bg-zinc-800 hover:bg-zinc-700 font-bold py-3.5 rounded-xl border border-zinc-700 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg" style={{ color: layoutConfig.color }}><Zap size={18} className="fill-current" /> REVELAR TUDO</button> 
                        : 
                        <button onClick={() => playRound()} className="w-full hover:opacity-90 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 animate-pulse" style={{ backgroundColor: layoutConfig.color }}><RotateCw size={18} /> JOGAR NOVAMENTE</button>
                    }
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
                          <span className="text-[10px] text-zinc-500 uppercase font-bold" style={{ color: layoutConfig.color }}>{formatCurrency(p.value)}</span>
                      </div>
                  ))}
              </div>
            </div>
          </main>
        )}

        {view === 'LOBBY' && (
          <main className="px-4 pb-8">
            <div className="w-full rounded-2xl relative overflow-hidden shadow-lg border border-zinc-800 mb-8 bg-zinc-900">
              {layoutConfig.banner ? <img src={layoutConfig.banner} className="w-full h-auto object-contain block" /> : <div className="h-40 flex items-center justify-center text-zinc-600">Banner</div>}
            </div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Grid size={18} style={{ color: layoutConfig.color }} /> Destaques</h3>
            <div className="flex flex-col gap-5">
              {gamesList.map((game) => (
                  <div key={game.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-lg">
                      <div className="w-full h-44 bg-zinc-950 relative flex items-center justify-center overflow-hidden">
                           {game.cover ? <img src={game.cover} className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="p-4 flex flex-col gap-1 items-start text-left">
                          <h3 className="text-white font-bold text-lg leading-tight">{game.name}</h3>
                          <span className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: layoutConfig.color }}>PRÊMIOS DE ATÉ R$ 1.000</span>
                          <div className="w-full flex items-center justify-between mt-auto">
                              <button onClick={() => handleEnterGame(game)} className="flex items-center gap-2 px-4 py-2 rounded-lg transition-transform active:scale-95 hover:brightness-110" style={{ backgroundColor: layoutConfig.color }}>
                                  <div className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center"><Play size={10} className="text-black fill-current" /></div>
                                  <span className="text-black font-black text-sm uppercase">JOGAR</span>
                                  <div className="bg-black/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-black">{formatCurrency(game.price)}</div>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setPreviewGame(game); }} className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white"><Gift size={12} /> VER PRÊMIOS <ChevronRight size={10} /></button>
                          </div>
                      </div>
                  </div>
              ))}
            </div>
          </main>
        )}

        <div className="fixed bottom-0 w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 pb-2 pt-2 px-0 z-50 h-[80px] grid grid-cols-5 items-center">
          <button onClick={handleBackToLobby} className={`flex flex-col items-center justify-center gap-1 h-full ${view === 'LOBBY' ? '' : 'text-zinc-500'}`} style={view === 'LOBBY' ? { color: layoutConfig.color } : {}}><HomeIcon size={24} /> <span className="text-[10px] font-medium">Início</span></button>
          <button onClick={() => user ? setShowMysteryBox(true) : setIsAuthOpen(true)} className={`flex flex-col items-center justify-center gap-1 h-full text-zinc-500`}><Gift size={24} /> <span className="text-[10px] font-medium">Bônus</span></button>
          <div className="relative h-full flex items-center justify-center">
              <button onClick={() => user ? setIsDepositOpen(true) : setIsAuthOpen(true)} className="absolute -top-8 text-black p-4 rounded-full transition-transform active:scale-95 border-4 border-zinc-950 shadow-xl" style={{ backgroundColor: layoutConfig.color }}><PlusCircle size={32} /></button>
          </div>
          <button onClick={handleGoToWinners} className={`flex flex-col items-center justify-center gap-1 h-full ${view === 'WINNERS' ? 'text-white' : 'text-zinc-500'}`}><Trophy size={24} /> <span className="text-[10px] font-medium">Vips</span></button>
          <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className={`flex flex-col items-center justify-center gap-1 h-full text-zinc-500`}><User size={24} /> <span className="text-[10px] font-medium">Perfil</span></button>
        </div>
      </div>

      {/* DESKTOP VIEW (Mantida Simples) */}
      <div className="hidden md:flex flex-col min-h-screen bg-[#09090b] text-white font-sans justify-center items-center">
         <div className="text-zinc-500">Use em modo mobile (F12)</div>
      </div>

      {/* PREVIEW MODAL */}
      {previewGame && (
         <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPreviewGame(null)}>
             <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 border border-zinc-800 relative">
                <button onClick={() => setPreviewGame(null)} className="absolute top-4 right-4 text-white"><X size={20}/></button>
                <h3 className="text-xl font-black text-white mb-4 text-center">{previewGame.name}</h3>
                <div className="grid grid-cols-3 gap-3">
                    {previewGame.prizes.map((p: any, i: number) => (
                        <div key={i} className="bg-black p-2 rounded-lg border border-zinc-800 flex flex-col items-center">
                            {p.image && <img src={p.image} className="h-8 w-8 object-contain mb-1" />}
                            <span className="text-xs font-bold text-yellow-500">{formatCurrency(p.value)}</span>
                        </div>
                    ))}
                </div>
                <button onClick={() => { setPreviewGame(null); handleEnterGame(previewGame); }} className="w-full mt-6 bg-yellow-500 text-black font-black py-3 rounded-xl uppercase">JOGAR AGORA</button>
             </div>
         </div>
      )}

      {/* POPUP DE VITÓRIA / DERROTA */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[70] p-6 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 border border-zinc-800 text-center relative shadow-2xl">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 ${resultType === 'WIN' ? 'text-black shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`} style={resultType === 'WIN' ? { backgroundColor: layoutConfig.color, borderColor: '#fff' } : {}}>
              {resultType === 'WIN' ? <Trophy size={40} className="fill-current" /> : <XCircle size={40} />}
            </div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic">{resultType === 'WIN' ? 'Parabéns!' : 'Não foi dessa vez'}</h2>
            {resultType === 'WIN' ? <p className="text-4xl font-black tracking-tighter" style={{ color: layoutConfig.color }}>{winAmount}</p> : <p className="text-zinc-400 text-sm mb-6">Tente novamente.</p>}
            <button onClick={() => playRound()} className="w-full text-black font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform mb-3" style={{ backgroundColor: layoutConfig.color }}><RotateCw size={20} strokeWidth={3} /> JOGAR NOVAMENTE</button>
            <button onClick={handleBackToLobby} className="text-zinc-500 font-bold text-sm hover:text-white py-2">Voltar ao Início</button>
          </div>
        </div>
      )}

      {/* BÔNUS DIÁRIO */}
      {showMysteryBox && (
          <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowMysteryBox(false)}>
              <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-8 border border-zinc-800 text-center" onClick={e => e.stopPropagation()}>
                <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-purple-500 animate-bounce"><Gift size={32} className="text-purple-400" /></div>
                <h3 className="text-xl font-black text-white mb-4 uppercase italic">Bônus Diário</h3>
                {bonusAvailable ? (
                    <button onClick={claimDailyBonus} disabled={claimingBonus} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95">{claimingBonus ? 'Coletando...' : 'RESGATAR AGORA'}</button>
                ) : (
                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800"><p className="text-xs text-zinc-500 uppercase font-bold mb-1">Próximo bônus em</p><div className="text-2xl font-black text-white flex items-center justify-center gap-2"><Clock size={20} className="text-purple-500" /> {timeLeft}</div></div>
                )}
              </div>
          </div>
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={(u) => { setUser(u); setIsDepositOpen(true); }} />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} userId={user?.uid} userEmail={user?.email} />
      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} balance={balance} onLogout={handleLogout} />
    </>
  );
}