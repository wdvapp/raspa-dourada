'use client';

import { useState, useRef, useEffect } from 'react';
import ScratchCard from '../components/ScratchCard';
import DepositModal from '../components/DepositModal';
import { AuthModal } from '../components/AuthModal'; 
import ProfileSidebar from '../components/ProfileSidebar';
import NotificationManager from '../components/NotificationManager';
// @ts-ignore
import confetti from 'canvas-confetti';
import { db, app } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, onSnapshot, updateDoc, increment, serverTimestamp, query, orderBy, addDoc, Unsubscribe } from 'firebase/firestore'; 
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  User, Trophy, ChevronLeft, Home as HomeIcon, PlusCircle, Bell, Zap, XCircle, Gift, X
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

interface NotificationMsg {
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: any;
    isGlobal?: boolean;
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState(0); 
  const [view, setView] = useState<'LOBBY' | 'GAME' | 'WINNERS'>('LOBBY');
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [winnersList, setWinnersList] = useState<Winner[]>([]); 
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [prizesGrid, setPrizesGrid] = useState<Prize[]>([]); 
  const [loading, setLoading] = useState(false);
  const [gameId, setGameId] = useState(0);
  
  const [dailyGiftConfig, setDailyGiftConfig] = useState({ active: false, amount: 0 });
  const [notifications, setNotifications] = useState<NotificationMsg[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.length; 

  const [showMysteryBox, setShowMysteryBox] = useState(false);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [claimingBonus, setClaimingBonus] = useState(false);

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Valores padrão para evitar erros de renderização inicial
  const [layoutConfig, setLayoutConfig] = useState<any>({
    logo: '', banner: '', gameThumb: '', scratchCover: '', color: '#ffc700' 
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

  useEffect(() => {
    if (typeof window !== 'undefined') winAudioRef.current = new Audio('/win.mp3');
    const auth = getAuth(app);
    
    // Referências para limpeza dos listeners
    let unsubSnap: Unsubscribe | null = null;
    let unsubPers: Unsubscribe | null = null;
    let unsubGlob: Unsubscribe | null = null;

    const initData = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'config', 'layout'));
            if (docSnap.exists()) setLayoutConfig(docSnap.data());
            
            onSnapshot(doc(db, 'config', 'daily_gift'), (snap) => { 
                if(snap.exists()) setDailyGiftConfig(snap.data() as any); 
            });

            const gSnap = await getDocs(collection(db, 'games'));
            setGamesList(gSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Game[]);
            
            const wSnap = await getDocs(collection(db, 'winners'));
            setWinnersList(wSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Winner[]);
        } catch (e) { console.error("Erro ao carregar dados iniciais:", e); }
    };

    initData();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      // Limpa listeners anteriores se o usuário mudar
      if (unsubSnap) unsubSnap();
      if (unsubPers) unsubPers();
      if (unsubGlob) unsubGlob();

      if (currentUser) {
        setIsAuthOpen(false); 
        unsubSnap = onSnapshot(doc(db, 'users', currentUser.uid), (snap) => {
            if (snap.exists()) {
                setBalance(snap.data().balance || 0);
                checkBonusAvailability(snap.data().lastDailyBonus);
            }
        });

        const updateNotifs = (p: NotificationMsg[], g: NotificationMsg[]) => {
            setNotifications([...p, ...g].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        };

        let pMsgs: NotificationMsg[] = [];
        let gMsgs: NotificationMsg[] = [];

        unsubPers = onSnapshot(query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('createdAt', 'desc')), (s) => {
            pMsgs = s.docs.map(d => ({ id: d.id, ...d.data(), isGlobal: false })) as NotificationMsg[];
            updateNotifs(pMsgs, gMsgs);
        });

        unsubGlob = onSnapshot(query(collection(db, 'global_notifications'), orderBy('createdAt', 'desc')), (s) => {
            gMsgs = s.docs.map(d => ({ id: d.id, ...d.data(), isGlobal: true })) as NotificationMsg[];
            updateNotifs(pMsgs, gMsgs);
        });
      } else {
        setBalance(0);
        // setIsAuthOpen(true); // Removido para não forçar login ao carregar a página
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubSnap) unsubSnap();
        if (unsubPers) unsubPers();
        if (unsubGlob) unsubGlob();
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
          await addDoc(collection(db, 'users', user.uid, 'notifications'), { 
            title: '🎁 Bônus!', 
            body: `Ganhou ${formatCurrency(dailyGiftConfig.amount)}!`, 
            read: false, 
            createdAt: serverTimestamp() 
          });
          triggerWin(); 
          setShowMysteryBox(false);
      } catch (e) { console.error(e); } finally { setClaimingBonus(false); }
  };

  const handleEnterGame = async (game: Game) => {
    if (!user) return setIsAuthOpen(true);
    if (balance < game.price) { 
        setActiveGame(game); 
        setIsDepositOpen(true); 
        return; 
    }
    setActiveGame(game);
    setView('GAME');
    await playRound(game); 
  };

  const playRound = async (gameOverride?: Game) => {
    const game = gameOverride || activeGame;
    if (!game || balance < game.price) return;
    
    setLoading(true);
    setIsGameFinished(false);
    setShowPopup(false);
    setWinningIndices([]);
    setWinAmount('');
    setResultType(null);

    try {
        if (user) await updateDoc(doc(db, 'users', user.uid), { balance: increment(-game.price) });

        await new Promise(r => setTimeout(r, 400));

        let winP: Prize | null = null;
        const rand = Math.random() * 100;
        let cumul = 0;
        for (const p of game.prizes) {
            cumul += Number(p.chance);
            if (rand <= cumul) { winP = p; break; }
        }

        let grid: Prize[] = [];
        if (winP) {
            grid.push(winP, winP, winP);
            const others = game.prizes.filter(p => p.name !== winP?.name);
            for (let i = 0; i < 6; i++) {
                grid.push(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : winP);
            }
        } else {
            const counts: Record<string, number> = {};
            for (let i = 0; i < 9; i++) {
                let cand = game.prizes[Math.floor(Math.random() * game.prizes.length)];
                if ((counts[cand.name] || 0) >= 2) {
                    const safes = game.prizes.filter(p => (counts[p.name] || 0) < 2);
                    cand = safes.length > 0 ? safes[Math.floor(Math.random() * safes.length)] : game.prizes[0];
                }
                grid.push(cand);
                counts[cand.name] = (counts[cand.name] || 0) + 1;
            }
        }

        setPrizesGrid(grid.sort(() => Math.random() - 0.5));
        setGameId(p => p + 1);
    } catch (e) {
        console.error("Erro na rodada:", e);
    } finally {
        setLoading(false);
    }
  };

  const handleGameFinish = () => {
    if (isGameFinished) return;
    setIsGameFinished(true);
    
    const counts: Record<string, number[]> = {};
    prizesGrid.forEach((p, i) => { 
        counts[p.name] = [...(counts[p.name] || []), i]; 
    });
    
    let winner: { idxs: number[], amount: string, val: number } | null = null;
    for (const [name, idxs] of Object.entries(counts)) {
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
    setTimeout(() => setShowPopup(true), 800);
  };

  const triggerWin = () => {
    if (winAudioRef.current) { 
        winAudioRef.current.currentTime = 0; 
        winAudioRef.current.play().catch(() => {}); 
    }
    confetti({ 
        particleCount: 150, 
        spread: 70, 
        origin: { y: 0.6 }, 
        colors: [layoutConfig.color || '#ffc700', '#ffffff'] 
    });
  };

  const handleBackToLobby = () => { 
    setShowPopup(false); 
    setIsGameFinished(false); 
    setActiveGame(null); 
    setView('LOBBY'); 
  };
  
  const handleLogout = () => { 
    signOut(getAuth(app)); 
    setIsProfileOpen(false); 
    setUser(null);
    setBalance(0);
  };

  return (
    <>
      <NotificationManager />
      <div className="min-h-screen bg-zinc-950 flex justify-center selection:bg-yellow-500/30 font-sans">
        <div className="w-full max-w-md bg-black min-h-screen relative shadow-2xl border-x border-zinc-800 pb-24">
            
            <header className="fixed top-0 w-full max-w-md z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {view !== 'LOBBY' ? (
                        <button onClick={handleBackToLobby} className="p-2 -ml-2 text-zinc-400 hover:text-white"><ChevronLeft size={28} /></button>
                    ) : (
                        <div className="h-10 flex items-center">{layoutConfig.logo ? <img src={layoutConfig.logo} className="h-8 w-auto" alt="Logo" /> : <Zap style={{ color: layoutConfig.color }} size={24} />}</div>
                    )}
                    <div className="flex flex-col cursor-pointer" onClick={() => user ? setIsDepositOpen(true) : setIsAuthOpen(true)}>
                        <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{user ? 'Saldo' : 'Entrar'}</span>
                        <span className="text-sm font-black text-white flex items-center gap-1">{user ? formatCurrency(balance) : 'Login'} <PlusCircle size={14} style={{ color: layoutConfig.color }} /></span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button onClick={() => setShowNotifications(!showNotifications)} className="bg-zinc-900 p-2.5 rounded-full text-zinc-400 relative border border-zinc-800">
                            <Bell size={20} />
                            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-zinc-950"></span>}
                        </button>
                        {showNotifications && (
                            <div className="absolute right-0 top-14 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="p-4 border-b border-zinc-800 bg-zinc-950 font-black text-xs uppercase flex justify-between"><span>Notificações</span><button onClick={() => setShowNotifications(false)}><X size={14}/></button></div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length > 0 ? notifications.map(n => (
                                        <div key={n.id} className={`p-4 border-b border-zinc-800/50 ${n.isGlobal ? 'bg-yellow-500/5' : ''}`}>
                                            <p className="text-xs font-bold text-white mb-1">{n.title}</p>
                                            <p className="text-[10px] text-zinc-500 leading-relaxed">{n.body}</p>
                                        </div>
                                    )) : <div className="p-10 text-center text-xs text-zinc-600">Vazio</div>}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="w-10 h-10 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center"><User size={20} className="text-zinc-400" /></button>
                </div>
            </header>

            <div className="h-20"></div>

            {view === 'WINNERS' && (
                <main className="px-4 pb-8 animate-in fade-in duration-500">
                    <div className="text-center mb-8 mt-4"><h2 className="text-2xl font-black italic uppercase">Galeria <span style={{ color: layoutConfig.color }}>Vip</span></h2></div>
                    <div className="flex flex-col gap-6">
                        {winnersList.map((w, i) => (
                            <div key={i} className="rounded-3xl overflow-hidden border border-zinc-800 relative bg-zinc-900 shadow-2xl">
                                <img src={w.image || w.url || w.photo} className="w-full aspect-square object-cover" alt="Winner" /> 
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-6">
                                    <p className="text-yellow-500 font-black text-xl">{formatCurrency(w.amount)}</p>
                                    <p className="text-white font-bold">{w.name}</p>
                                    <p className="text-zinc-400 text-xs">{w.city}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            {view === 'GAME' && activeGame && (
                <main className="px-4 flex flex-col items-center animate-in fade-in">
                    <div className="w-full mb-6 flex justify-between items-end">
                        <div><h1 className="text-2xl font-black italic uppercase leading-none">{activeGame.name}</h1><p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-tighter">Encontre 3 símbolos iguais</p></div>
                    </div>

                    <div className="w-full aspect-square bg-zinc-900 rounded-[40px] p-2 border border-zinc-800 shadow-2xl relative overflow-hidden">
                        {loading ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-zinc-500"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-white"></div><span className="text-[10px] font-black uppercase tracking-widest">Sorteando...</span></div>
                        ) : (
                            <div className="relative w-full h-full rounded-[32px] overflow-hidden bg-zinc-950">
                                <div className="grid grid-cols-3 grid-rows-3 gap-2 p-2 h-full">
                                    {prizesGrid.map((p, i) => (
                                        <div key={i} className={`rounded-2xl flex items-center justify-center transition-all duration-700 ${winningIndices.includes(i) ? 'z-10 scale-110 shadow-2xl border-2 border-white' : 'bg-white border-zinc-200'}`} style={winningIndices.includes(i) ? { backgroundColor: layoutConfig.color } : {}}>
                                            {p.image ? <img src={p.image} className="w-4/5 h-4/5 object-contain" alt={p.name} /> : <span className="font-black text-black text-xs">{p.name}</span>}
                                        </div>
                                    ))}
                                </div>
                                <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage={layoutConfig.scratchCover} />
                            </div>
                        )}
                    </div>

                    {!isGameFinished && !loading && <button onClick={handleGameFinish} className="w-full mt-6 bg-zinc-800 py-5 rounded-2xl font-black text-xs uppercase border border-zinc-700 shadow-xl">Revelar Tudo</button>}
                </main>
            )}

            {view === 'LOBBY' && (
                <main className="px-4 pb-8">
                    <div className="w-full rounded-[32px] overflow-hidden mb-8 border border-zinc-800 shadow-2xl bg-zinc-900">
                        {layoutConfig.banner ? <img src={layoutConfig.banner} className="w-full h-auto" alt="Banner" /> : <div className="h-40 flex items-center justify-center text-zinc-700 font-bold italic uppercase">Raspadinha</div>}
                    </div>
                    <div className="flex flex-col gap-6">
                        {gamesList.map(g => (
                            <div key={g.id} className="bg-zinc-900 rounded-[32px] overflow-hidden border border-zinc-800 shadow-xl">
                                <div className="h-48 bg-zinc-950 overflow-hidden">{g.cover ? <img src={g.cover} className="w-full h-full object-cover" alt={g.name} /> : null}</div>
                                <div className="p-6 flex items-center justify-between">
                                    <h3 className="text-white font-black text-lg italic uppercase">{g.name}</h3>
                                    <button onClick={() => handleEnterGame(g)} className="flex flex-col items-center px-6 py-3 rounded-2xl" style={{ backgroundColor: layoutConfig.color }}>
                                        <span className="text-black font-black text-xs uppercase italic">Jogar</span>
                                        <span className="text-black/60 text-[9px] font-bold">{formatCurrency(g.price)}</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            <nav className="fixed bottom-0 w-full max-w-md bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900 h-20 grid grid-cols-5 items-center z-40">
                <button onClick={handleBackToLobby} className={`flex flex-col items-center gap-1 ${view === 'LOBBY' ? 'text-white' : 'text-zinc-600'}`}><HomeIcon size={22} /><span className="text-[9px] font-black uppercase">Início</span></button>
                <button onClick={() => user ? setShowMysteryBox(true) : setIsAuthOpen(true)} className="flex flex-col items-center gap-1 text-zinc-600"><Gift size={22} /><span className="text-[9px] font-black uppercase">Bônus</span></button>
                <div className="relative flex justify-center"><button onClick={() => user ? setIsDepositOpen(true) : setIsAuthOpen(true)} className="absolute -top-12 p-4 rounded-full shadow-2xl border-4 border-zinc-950" style={{ backgroundColor: layoutConfig.color }}><PlusCircle size={28} className="text-black" /></button></div>
                <button onClick={() => setView('WINNERS')} className={`flex flex-col items-center gap-1 ${view === 'WINNERS' ? 'text-white' : 'text-zinc-600'}`}><Trophy size={22} /><span className="text-[9px] font-black uppercase">Vips</span></button>
                <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="flex flex-col items-center gap-1 text-zinc-600"><User size={22} /><span className="text-[9px] font-black uppercase">Perfil</span></button>
            </nav>
        </div>
      </div>

      {/* MODAIS GERAIS */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[70] p-6 animate-in fade-in">
          <div className="w-full max-w-xs bg-zinc-900 rounded-[40px] p-8 border border-zinc-800 text-center shadow-2xl">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 ${resultType === 'WIN' ? 'text-black shadow-lg' : 'text-zinc-600 border-zinc-800'}`} style={resultType === 'WIN' ? { backgroundColor: layoutConfig.color, borderColor: '#fff' } : {}}>{resultType === 'WIN' ? <Trophy size={40} /> : <XCircle size={40} />}</div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic">{resultType === 'WIN' ? 'Parabéns!' : 'Não foi dessa vez'}</h2>
            {resultType === 'WIN' ? <p className="text-4xl font-black tracking-tighter" style={{ color: layoutConfig.color }}>{winAmount}</p> : <p className="text-zinc-400 text-sm">Tente novamente!</p>}
            <button onClick={() => playRound()} className="w-full mt-6 py-4 rounded-2xl font-black text-black uppercase shadow-lg" style={{ backgroundColor: layoutConfig.color }}>Nova Rodada</button>
            <button onClick={handleBackToLobby} className="mt-4 text-zinc-600 font-bold text-xs uppercase tracking-widest">Sair</button>
          </div>
        </div>
      )}

      {showMysteryBox && (
          <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowMysteryBox(false)}>
              <div className="w-full max-w-xs bg-zinc-900 rounded-[40px] p-8 border border-zinc-800 relative text-center" onClick={e => e.stopPropagation()}>
                <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-purple-500 animate-bounce"><Gift size={32} className="text-purple-400" /></div>
                <h3 className="text-xl font-black text-white mb-4 uppercase italic">Bônus Diário</h3>
                {bonusAvailable ? (
                    <button onClick={claimDailyBonus} disabled={claimingBonus} className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs">{claimingBonus ? 'Coletando...' : 'Resgatar Agora'}</button>
                ) : (
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800"><p className="text-[10px] font-black text-zinc-600 uppercase mb-1">Próximo resgate em</p><div className="text-xl font-black text-white">{timeLeft}</div></div>
                )}
              </div>
          </div>
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={(u) => { setUser(u); setIsAuthOpen(false); }} />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} userId={user?.uid} userEmail={user?.email} />
      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} balance={balance} onLogout={handleLogout} />
    </>
  );
}