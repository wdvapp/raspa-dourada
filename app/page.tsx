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
  User, Trophy, ChevronLeft, Home as HomeIcon, PlusCircle, Bell, Gift, X, Star, Zap, Search, Settings, LogOut
} from 'lucide-react';

// --- INTERFACES (Isso resolve 90% dos erros vermelhos) ---
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
  // --- ESTADOS (Mantendo toda a sua lógica original) ---
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

  // Configuração Visual exata das suas fotos
  const [layoutConfig, setLayoutConfig] = useState<any>({
    logo: '', 
    banner: '/banner-tigre.jpg', // Ajustado para o banner que vi nas fotos
    gameThumb: '', 
    scratchCover: '/gold.png', // Ajustado para o arquivo que vi no seu VS Code
    color: '#FFD700' // Dourado
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

  // --- FIREBASE LISTENERS ---
  useEffect(() => {
    if (typeof window !== 'undefined') winAudioRef.current = new Audio('/win.mp3');
    const auth = getAuth(app);
    let unsubSnap: Unsubscribe | null = null;
    let unsubPers: Unsubscribe | null = null;
    let unsubGlob: Unsubscribe | null = null;

    const initData = async () => {
        try {
            const docSnap = await getDoc(doc(db, 'config', 'layout'));
            if (docSnap.exists()) setLayoutConfig((prev: any) => ({ ...prev, ...docSnap.data() }));
            
            onSnapshot(doc(db, 'config', 'daily_gift'), (snap) => { 
                if(snap.exists()) setDailyGiftConfig(snap.data() as any); 
            });

            const gSnap = await getDocs(collection(db, 'games'));
            setGamesList(gSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Game[]);
            
            const wSnap = await getDocs(collection(db, 'winners'));
            setWinnersList(wSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Winner[]);
        } catch (e) { console.error("Erro ao carregar dados:", e); }
    };

    initData();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Limpeza de listeners antigos
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
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubSnap) unsubSnap();
        if (unsubPers) unsubPers();
        if (unsubGlob) unsubGlob();
    };
  }, []);

  // --- LÓGICA DE NEGÓCIO ---

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
    
    // Deduzir saldo
    if (user) await updateDoc(doc(db, 'users', user.uid), { balance: increment(-game.price) });

    setLoading(true);
    setIsGameFinished(false);
    setShowPopup(false);
    setWinningIndices([]);
    setWinAmount('');
    setResultType(null);

    await new Promise(r => setTimeout(r, 400));

    // Lógica de Sorteio Ponderado
    let winP: Prize | null = null;
    const rand = Math.random() * 100;
    let cumul = 0;
    for (const p of game.prizes) {
        cumul += Number(p.chance);
        if (rand <= cumul) { winP = p; break; }
    }

    let grid: Prize[] = [];
    if (winP) {
        // Vitória garantida: coloca 3 prêmios iguais
        grid.push(winP, winP, winP);
        const others = game.prizes.filter(p => p.name !== winP?.name);
        for (let i = 0; i < 6; i++) {
            grid.push(others.length > 0 ? others[Math.floor(Math.random() * others.length)] : winP);
        }
    } else {
        // Derrota: garante que não tenha 3 iguais
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
    setLoading(false);
    setGameId(p => p + 1);
  };

  const handleGameFinish = () => {
    if (isGameFinished) return;
    setIsGameFinished(true);
    
    const counts: Record<string, number[]> = {};
    prizesGrid.forEach((p, i) => { counts[p.name] = [...(counts[p.name] || []), i]; });
    
    let winner = null;
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
    if (winAudioRef.current) { winAudioRef.current.currentTime = 0; winAudioRef.current.play().catch(() => {}); }
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: [layoutConfig.color || '#FFD700', '#FFFFFF'] });
  };

  const handleBackToLobby = () => { setShowPopup(false); setIsGameFinished(false); setActiveGame(null); setView('LOBBY'); };
  
  const handleLogout = () => { 
    signOut(getAuth(app)); 
    setIsProfileOpen(false); 
    setUser(null);
    setBalance(0);
  };

  // --- RENDERIZAÇÃO ---
  return (
    <>
      <NotificationManager />
      {/* Container Principal: Responsivo (Mobile: App Style / Desktop: Wide) */}
      <div className="min-h-screen bg-[#050505] flex justify-center selection:bg-yellow-500/30 font-sans text-white">
        <div className="w-full max-w-md md:max-w-6xl bg-black min-h-screen relative shadow-2xl border-x border-zinc-800 pb-28 mx-auto">
            
            {/* HEADER */}
            <header className="fixed top-0 w-full max-w-md md:max-w-6xl left-1/2 -translate-x-1/2 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {view !== 'LOBBY' ? (
                        <button onClick={handleBackToLobby} className="p-2 -ml-2 text-zinc-400 hover:text-white"><ChevronLeft size={28} /></button>
                    ) : (
                        <div className="h-10 flex items-center">
                            {/* Logo ou Texto Raspa Dourada */}
                            {layoutConfig.logo ? 
                                <img src={layoutConfig.logo} className="h-8 w-auto" alt="Logo" /> : 
                                <div className="flex flex-col leading-none">
                                    <span className="text-xl font-black italic tracking-tighter uppercase text-white">RASPA</span>
                                    <span className="text-lg font-black italic tracking-tighter uppercase text-[#FFD700]">DOURADA</span>
                                </div>
                            }
                        </div>
                    )}
                </div>

                {/* Right Side Icons */}
                <div className="flex items-center gap-3">
                     {/* Saldo Pill */}
                    <div className="flex flex-col items-end cursor-pointer bg-zinc-900 py-1 px-3 rounded-2xl border border-zinc-800" onClick={() => user ? setIsDepositOpen(true) : setIsAuthOpen(true)}>
                        <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Saldo</span>
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-[#FFD700]">{user ? formatCurrency(balance) : 'Entrar'}</span>
                            <PlusCircle size={12} className="text-[#FFD700]" />
                        </div>
                    </div>

                    <div className="relative">
                        <button onClick={() => setShowNotifications(!showNotifications)} className="bg-zinc-900 p-2 rounded-full text-zinc-400 relative border border-zinc-800">
                            <Bell size={20} />
                            {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full border border-black"></span>}
                        </button>
                        {/* Dropdown Notificações */}
                        {showNotifications && (
                            <div className="absolute right-0 top-12 w-72 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                <div className="p-4 border-b border-zinc-800 bg-zinc-950 font-black text-xs uppercase flex justify-between"><span>Notificações</span><button onClick={() => setShowNotifications(false)}><X size={14}/></button></div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notifications.length > 0 ? notifications.map(n => (
                                        <div key={n.id} className={`p-4 border-b border-zinc-800/50 ${n.isGlobal ? 'bg-yellow-500/5' : ''}`}>
                                            <p className="text-xs font-bold text-white mb-1">{n.title}</p>
                                            <p className="text-[10px] text-zinc-500 leading-relaxed">{n.body}</p>
                                        </div>
                                    )) : <div className="p-10 text-center text-xs text-zinc-600">Nenhuma notificação</div>}
                                </div>
                            </div>
                        )}
                    </div>
                    <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="w-10 h-10 bg-zinc-900 rounded-full border border-zinc-800 flex items-center justify-center"><User size={20} className="text-zinc-400" /></button>
                </div>
            </header>

            <div className="h-20"></div>

            {/* --- VIEW: LOBBY --- */}
            {view === 'LOBBY' && (
                <main className="px-4 pb-8 animate-in fade-in">
                    {/* Banner Principal */}
                    <div className="w-full rounded-[24px] overflow-hidden mb-8 border border-zinc-800 shadow-2xl bg-zinc-900 relative group">
                        {layoutConfig.banner ? <img src={layoutConfig.banner} className="w-full h-auto object-cover transform transition-transform group-hover:scale-105 duration-700" alt="Banner" /> : <div className="h-40 flex items-center justify-center text-zinc-700 font-bold italic uppercase">Carregando Banner...</div>}
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <Star size={18} className="text-[#FFD700] fill-[#FFD700]" />
                        <h3 className="text-lg font-black italic uppercase text-white">Destaques</h3>
                    </div>

                    {/* GRID RESPONSIVO: 1 coluna no mobile, 3 no PC */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {gamesList.map(g => (
                            <div key={g.id} className="bg-zinc-900 rounded-[32px] overflow-hidden border border-zinc-800 shadow-lg flex flex-col relative group">
                                <div className="h-44 bg-zinc-950 overflow-hidden relative">
                                    {g.cover && <img src={g.cover} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={g.name} />}
                                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"></div>
                                </div>
                                <div className="p-5 flex items-center justify-between relative z-10 -mt-2">
                                    <div>
                                        <h3 className="text-white font-black text-lg italic uppercase leading-none">{g.name}</h3>
                                        <p className="text-[#FFD700] text-[10px] font-bold uppercase mt-1">Prêmios de até R$ 1.000</p>
                                    </div>
                                    <button onClick={() => handleEnterGame(g)} className="flex items-center justify-center px-6 py-3 rounded-xl shadow-[0_4px_0_#B8860B] active:translate-y-1 active:shadow-none transition-all" style={{ backgroundColor: layoutConfig.color }}>
                                        <span className="text-black font-black text-xs uppercase italic">Jogar</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            {/* --- VIEW: GAME --- */}
            {view === 'GAME' && activeGame && (
                <main className="px-4 flex flex-col items-center animate-in fade-in max-w-lg mx-auto">
                    <div className="w-full mb-6 flex justify-between items-end">
                        <div><h1 className="text-2xl font-black italic uppercase leading-none">{activeGame.name}</h1><p className="text-zinc-500 text-xs font-bold mt-1 uppercase tracking-tighter">Encontre 3 símbolos iguais</p></div>
                    </div>

                    {/* Área da Raspadinha */}
                    <div className="w-full aspect-square bg-zinc-900 rounded-[40px] p-2 border-2 border-[#FFD700]/50 shadow-[0_0_50px_rgba(255,215,0,0.15)] relative overflow-hidden">
                        {loading ? (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-zinc-500"><div className="animate-spin rounded-full h-10 w-10 border-t-4 border-[#FFD700]"></div><span className="text-[10px] font-black uppercase tracking-widest text-[#FFD700]">Preparando...</span></div>
                        ) : (
                            <div className="relative w-full h-full rounded-[32px] overflow-hidden bg-black">
                                <div className="grid grid-cols-3 grid-rows-3 gap-2 p-2 h-full">
                                    {prizesGrid.map((p, i) => (
                                        <div key={i} className={`rounded-2xl flex items-center justify-center transition-all duration-700 ${winningIndices.includes(i) ? 'bg-[#FFD700] scale-105 shadow-xl z-10' : 'bg-white'}`}>
                                            {p.image ? <img src={p.image} className="w-4/5 h-4/5 object-contain" alt={p.name} /> : <span className="font-black text-black text-xs">{p.name}</span>}
                                        </div>
                                    ))}
                                </div>
                                {/* Componente ScratchCard original */}
                                <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage={layoutConfig.scratchCover} />
                            </div>
                        )}
                    </div>

                    {!isGameFinished && !loading && <button onClick={handleGameFinish} className="w-full mt-6 bg-zinc-800 py-5 rounded-2xl font-black text-xs uppercase border border-zinc-700 shadow-xl hover:bg-zinc-700 transition-colors">Revelar Tudo</button>}
                </main>
            )}

            {/* --- VIEW: WINNERS --- */}
            {view === 'WINNERS' && (
                <main className="px-4 pb-8 animate-in fade-in">
                    <div className="text-center mb-8 mt-4"><h2 className="text-2xl font-black italic uppercase">Galeria <span style={{ color: layoutConfig.color }}>Vip</span></h2></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {winnersList.map((w, i) => (
                            <div key={i} className="rounded-3xl overflow-hidden border border-zinc-800 relative bg-zinc-900 shadow-2xl group">
                                <img src={w.image || w.url || w.photo} className="w-full aspect-square object-cover transition-transform duration-700 group-hover:scale-105" alt="Vencedor" /> 
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-6">
                                    <p className="text-[#FFD700] font-black text-xl">{formatCurrency(w.amount)}</p>
                                    <p className="text-white font-bold">{w.name}</p>
                                    <p className="text-zinc-400 text-xs">{w.city}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            {/* NAV BAR FIXA (O PULO DO GATO) */}
            <nav className="fixed bottom-0 w-full max-w-md md:max-w-6xl left-1/2 -translate-x-1/2 bg-black/95 backdrop-blur-xl border-t border-zinc-900 h-20 grid grid-cols-5 items-center z-40 px-2">
                <button onClick={handleBackToLobby} className={`flex flex-col items-center gap-1 ${view === 'LOBBY' ? 'text-[#FFD700]' : 'text-zinc-600'}`}><HomeIcon size={22} /><span className="text-[9px] font-black uppercase">Início</span></button>
                <button onClick={() => user ? setShowMysteryBox(true) : setIsAuthOpen(true)} className="flex flex-col items-center gap-1 text-zinc-600"><Gift size={22} /><span className="text-[9px] font-black uppercase">Bônus</span></button>
                
                {/* Botão Central Saltado */}
                <div className="relative flex justify-center">
                    <button onClick={() => user ? setIsDepositOpen(true) : setIsAuthOpen(true)} className="absolute -top-12 p-4 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] border-[6px] border-[#050505] transform transition-transform hover:scale-110 active:scale-95" style={{ backgroundColor: layoutConfig.color }}>
                        <PlusCircle size={32} className="text-black fill-black" />
                    </button>
                </div>

                <button onClick={() => setView('WINNERS')} className={`flex flex-col items-center gap-1 ${view === 'WINNERS' ? 'text-[#FFD700]' : 'text-zinc-600'}`}><Trophy size={22} /><span className="text-[9px] font-black uppercase">Vips</span></button>
                <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="flex flex-col items-center gap-1 text-zinc-600"><User size={22} /><span className="text-[9px] font-black uppercase">Perfil</span></button>
            </nav>
        </div>
      </div>

      {/* --- MODAIS GERAIS (Recuperados) --- */}
      
      {/* Modal de Vitória */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[70] p-6 animate-in zoom-in duration-300">
          <div className="w-full max-w-xs bg-zinc-900 rounded-[40px] p-8 border-2 border-[#FFD700] text-center shadow-[0_0_100px_rgba(255,215,0,0.3)]">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 ${resultType === 'WIN' ? 'text-black shadow-lg bg-[#FFD700] border-white' : 'text-zinc-600 border-zinc-800 bg-zinc-950'}`}>
                {resultType === 'WIN' ? <Trophy size={40} /> : <XCircle size={40} />}
            </div>
            <h2 className="text-3xl font-black text-white mb-2 uppercase italic leading-none">{resultType === 'WIN' ? 'Parabéns!' : 'Quase...'}</h2>
            {resultType === 'WIN' ? <p className="text-5xl font-black tracking-tighter text-[#FFD700] drop-shadow-lg my-4">{winAmount}</p> : <p className="text-zinc-400 text-sm my-4">Tente novamente!</p>}
            <button onClick={() => playRound()} className="w-full mt-2 py-4 rounded-2xl font-black text-black uppercase shadow-lg hover:brightness-110 transition-all" style={{ backgroundColor: layoutConfig.color }}>Nova Rodada</button>
            <button onClick={handleBackToLobby} className="mt-4 text-zinc-600 font-bold text-xs uppercase tracking-widest hover:text-white">Sair</button>
          </div>
        </div>
      )}

      {/* Modal Bônus Diário */}
      {showMysteryBox && (
          <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowMysteryBox(false)}>
              <div className="w-full max-w-xs bg-zinc-900 rounded-[40px] p-8 border border-zinc-800 relative text-center shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-purple-500 animate-bounce"><Gift size={32} className="text-purple-400" /></div>
                <h3 className="text-xl font-black text-white mb-4 uppercase italic">Bônus Diário</h3>
                {bonusAvailable ? (
                    <button onClick={claimDailyBonus} disabled={claimingBonus} className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs hover:bg-purple-500 transition-colors">{claimingBonus ? 'Coletando...' : 'Resgatar Agora'}</button>
                ) : (
                    <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800"><p className="text-[10px] font-black text-zinc-600 uppercase mb-1">Próximo resgate em</p><div className="text-xl font-black text-white">{timeLeft}</div></div>
                )}
              </div>
          </div>
      )}

      {/* --- MODAIS DE NEGÓCIO (AQUI ESTAVA O ERRO) --- */}
      {/* Adicionei as props que o TypeScript estava cobrando */}
      
      <AuthModal 
        isOpen={isAuthOpen} 
        onClose={() => setIsAuthOpen(false)} 
        onLoginSuccess={(u) => { setUser(u); setIsAuthOpen(false); }} 
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