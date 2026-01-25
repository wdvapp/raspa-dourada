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
  User, Trophy, ChevronLeft, Home as HomeIcon, PlusCircle, Bell, Gift, X, Star
} from 'lucide-react';

// Interfaces para acalmar o TypeScript
interface Prize { name: string; value: number; chance: number; image?: string; }
interface Game { id: string; name: string; price: number; cover: string; prizes: Prize[]; }
interface Winner { id: string; image?: string; url?: string; photo?: string; name?: string; city?: string; amount?: number; }
interface NotificationMsg { id: string; title: string; body: string; read: boolean; createdAt: any; isGlobal?: boolean; }

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
  const [showMysteryBox, setShowMysteryBox] = useState(false);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [claimingBonus, setClaimingBonus] = useState(false);

  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Configuração Visual: Dourado + Banner Tigre
  const [layoutConfig, setLayoutConfig] = useState<any>({
    logo: '', banner: '/banner-tigre.jpg', scratchCover: '/gold.png', color: '#FFD700' 
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
    let unsubSnap: Unsubscribe | null = null;
    let unsubPers: Unsubscribe | null = null;

    const initData = async () => {
        try {
            const gSnap = await getDocs(collection(db, 'games'));
            setGamesList(gSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Game[]);
            const wSnap = await getDocs(collection(db, 'winners'));
            setWinnersList(wSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Winner[]);
            onSnapshot(doc(db, 'config', 'daily_gift'), (snap) => { if(snap.exists()) setDailyGiftConfig(snap.data() as any); });
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

        // Notificações
        unsubPers = onSnapshot(query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('createdAt', 'desc')), (s) => {
            const pMsgs = s.docs.map(d => ({ id: d.id, ...d.data(), isGlobal: false })) as NotificationMsg[];
            setNotifications(pMsgs);
        });
      } else {
        setBalance(0);
      }
    });

    return () => { unsubscribeAuth(); if (unsubSnap) unsubSnap(); };
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
      if (!user || !bonusAvailable) return;
      setClaimingBonus(true);
      try {
          await updateDoc(doc(db, 'users', user.uid), { balance: increment(dailyGiftConfig.amount), lastDailyBonus: serverTimestamp() });
          triggerWin(); setShowMysteryBox(false);
      } catch (e) { console.error(e); } finally { setClaimingBonus(false); }
  };

  const handleEnterGame = (game: Game) => {
    if (!user) return setIsAuthOpen(true);
    if (balance < game.price) { setActiveGame(game); setIsDepositOpen(true); return; }
    setActiveGame(game);
    setView('GAME');
    playRound(game); 
  };

  const playRound = async (gameOverride?: Game) => {
    const game = gameOverride || activeGame;
    if (!game) return;
    setLoading(true);
    setIsGameFinished(false);
    setShowPopup(false);
    
    if (user) await updateDoc(doc(db, 'users', user.uid), { balance: increment(-game.price) });

    let grid = Array(9).fill(null).map(() => game.prizes[Math.floor(Math.random() * game.prizes.length)]);
    setPrizesGrid(grid);
    setLoading(false);
    setGameId(p => p + 1);
  };

  const handleGameFinish = () => {
    if (isGameFinished) return;
    setIsGameFinished(true);
    const win = Math.random() > 0.8; 
    if (win) {
      setResultType('WIN');
      setWinAmount(formatCurrency(10));
      triggerWin();
      if (user) updateDoc(doc(db, 'users', user.uid), { balance: increment(10) });
    } else {
      setResultType('LOSS');
    }
    setTimeout(() => setShowPopup(true), 800);
  };

  const triggerWin = () => {
    if (winAudioRef.current) winAudioRef.current.play().catch(() => {});
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#FFD700', '#FFFFFF', '#FFA500'] });
  };

  const handleLogout = () => { signOut(getAuth(app)); setIsProfileOpen(false); setUser(null); setBalance(0); };

  return (
    <>
      <NotificationManager />
      <div className="min-h-screen bg-[#050505] flex justify-center selection:bg-yellow-500/30 font-sans text-white">
        
        {/* CONTAINER PRINCIPAL */}
        <div className="w-full max-w-md md:max-w-6xl bg-black min-h-screen relative shadow-2xl border-x border-white/5 pb-24 mx-auto">
            
            <header className="fixed top-0 w-full max-w-md md:max-w-6xl left-1/2 -translate-x-1/2 z-40 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {view !== 'LOBBY' && <button onClick={() => setView('LOBBY')} className="p-1"><ChevronLeft size={24} /></button>}
                    <span className="text-lg font-black italic uppercase tracking-tighter">RASPA<span className="text-[#FFD700]">DOURADA</span></span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="bg-zinc-900 px-3 py-1 rounded-full border border-[#FFD700]/30 flex flex-col items-center cursor-pointer" onClick={() => setIsDepositOpen(true)}>
                        <span className="text-[8px] uppercase font-black text-zinc-500">Saldo</span>
                        <span className="text-sm font-black text-[#FFD700] leading-none">{formatCurrency(balance)}</span>
                    </div>
                    <button onClick={() => setIsProfileOpen(true)} className="w-10 h-10 bg-zinc-900 rounded-full border border-white/5 flex items-center justify-center"><User size={20} /></button>
                </div>
            </header>

            <div className="h-20"></div>

            {view === 'LOBBY' && (
                <main className="px-4">
                    <div className="w-full rounded-3xl overflow-hidden mb-8 border border-[#FFD700]/20 shadow-[0_0_30px_rgba(255,215,0,0.1)]">
                        <img src="/banner-tigre.jpg" className="w-full h-auto" alt="Banner" />
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                        <Star className="text-[#FFD700]" size={20} fill="#FFD700" />
                        <h2 className="text-xl font-black uppercase italic">Destaques</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {gamesList.map(g => (
                            <div key={g.id} className="bg-zinc-900/50 rounded-[32px] overflow-hidden border border-white/5 flex flex-col p-4 shadow-xl">
                                <img src={g.cover} className="w-full h-48 object-cover rounded-2xl mb-4" />
                                <div className="flex items-center justify-between mt-auto">
                                    <h3 className="font-black text-lg uppercase italic">{g.name}</h3>
                                    <button onClick={() => handleEnterGame(g)} className="bg-[#FFD700] text-black font-black px-6 py-2 rounded-xl text-xs uppercase shadow-[0_4px_0_rgb(184,134,11)]">
                                        Jogar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            {view === 'GAME' && activeGame && (
                <main className="px-4 flex flex-col items-center max-w-md mx-auto">
                    <h2 className="text-2xl font-black italic uppercase mb-8">{activeGame.name}</h2>
                    <div className="w-full aspect-square bg-zinc-900 rounded-[40px] p-2 border-2 border-[#FFD700]/30 relative shadow-[0_0_50px_rgba(255,215,0,0.15)] overflow-hidden">
                        <div className="relative w-full h-full rounded-[32px] overflow-hidden bg-black">
                            <div className="grid grid-cols-3 grid-rows-3 gap-2 p-2 h-full">
                                {prizesGrid.map((p, i) => (
                                    <div key={i} className="bg-white rounded-2xl flex items-center justify-center">
                                        {p.image ? <img src={p.image} className="w-4/5" /> : <span className="text-black font-black text-[10px]">{p.name}</span>}
                                    </div>
                                ))}
                            </div>
                            <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage="/gold.png" />
                        </div>
                    </div>
                    {!isGameFinished && <button onClick={handleGameFinish} className="w-full mt-6 bg-zinc-800 py-5 rounded-2xl font-black text-xs uppercase border border-zinc-700">Revelar Tudo</button>}
                </main>
            )}

            {view === 'WINNERS' && (
                <main className="px-4 pb-8">
                    <h2 className="text-2xl font-black italic uppercase text-center mb-8">Galeria de <span className="text-[#FFD700]">Ganhadores</span></h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {winnersList.map((w, i) => (
                            <div key={i} className="rounded-3xl overflow-hidden border border-white/5 relative aspect-video shadow-2xl">
                                <img src={w.image || w.url} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black p-6 flex flex-col justify-end">
                                    <p className="text-[#FFD700] font-black text-xl">{formatCurrency(w.amount)}</p>
                                    <p className="font-bold text-sm">{w.name}</p>
                                    <p className="text-zinc-500 text-xs">{w.city}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </main>
            )}

            {/* NAV BAR */}
            <nav className="fixed bottom-0 w-full max-w-md md:max-w-6xl left-1/2 -translate-x-1/2 bg-black/95 backdrop-blur-xl border-t border-white/10 h-20 grid grid-cols-5 items-center z-40">
                <button onClick={() => setView('LOBBY')} className={`flex flex-col items-center gap-1 ${view === 'LOBBY' ? 'text-[#FFD700]' : 'text-zinc-600'}`}><HomeIcon size={22} /><span className="text-[9px] font-bold uppercase">Início</span></button>
                <button onClick={() => setShowMysteryBox(true)} className="flex flex-col items-center gap-1 text-zinc-600"><Gift size={22} /><span className="text-[9px] font-bold uppercase">Bônus</span></button>
                <div className="relative flex justify-center"><button onClick={() => setIsDepositOpen(true)} className="absolute -top-12 bg-[#FFD700] p-4 rounded-full shadow-[0_0_20px_rgba(255,215,0,0.4)] text-black border-4 border-[#050505]"><PlusCircle size={28} /></button></div>
                <button onClick={() => setView('WINNERS')} className={`flex flex-col items-center gap-1 ${view === 'WINNERS' ? 'text-[#FFD700]' : 'text-zinc-600'}`}><Trophy size={22} /><span className="text-[9px] font-bold uppercase">Vips</span></button>
                <button onClick={() => setIsProfileOpen(true)} className="flex flex-col items-center gap-1 text-zinc-600"><User size={22} /><span className="text-[9px] font-bold uppercase">Perfil</span></button>
            </nav>
        </div>
      </div>

      {showMysteryBox && (
          <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setShowMysteryBox(false)}>
              <div className="w-full max-w-xs bg-zinc-900 rounded-[40px] p-8 border-2 border-purple-500/50 text-center" onClick={e => e.stopPropagation()}>
                <div className="w-16 h-16 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-purple-500 animate-pulse"><Gift size={32} className="text-purple-400" /></div>
                <h3 className="text-xl font-black text-white mb-2 uppercase italic">BÔNUS DIÁRIO</h3>
                {bonusAvailable ? (
                    <button onClick={claimDailyBonus} disabled={claimingBonus} className="w-full bg-purple-600 text-white font-black py-4 rounded-2xl uppercase">{claimingBonus ? 'COLETANDO...' : 'RESGATAR AGORA'}</button>
                ) : (
                    <div className="bg-black/50 p-4 rounded-2xl border border-white/5"><p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">Próximo bônus em</p><div className="text-xl font-black text-white">{timeLeft}</div></div>
                )}
              </div>
          </div>
      )}

      {showPopup && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-6 text-center animate-in zoom-in">
          <div className="bg-zinc-900 border-2 border-[#FFD700] p-10 rounded-[50px] shadow-[0_0_100px_rgba(255,215,0,0.2)]">
            <Trophy size={80} className="text-[#FFD700] mx-auto mb-4" />
            <h2 className="text-4xl font-black italic uppercase text-white leading-none">{resultType === 'WIN' ? 'VOCÊ GANHOU!' : 'TENTE NOVAMENTE'}</h2>
            {resultType === 'WIN' && <p className="text-[#FFD700] text-5xl font-black mt-4">{winAmount}</p>}
            <button onClick={() => playRound()} className="mt-8 bg-white text-black font-black px-10 py-3 rounded-2xl uppercase">Continuar</button>
          </div>
        </div>
      )}

      {/* AQUI ESTAVA O ERRO: Recoloquei as props obrigatórias que eu tinha tirado */}
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