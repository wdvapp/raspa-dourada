'use client';

import { useState, useRef, useEffect } from 'react';
import ScratchCard from '../components/ScratchCard';
import DepositModal from '../components/DepositModal';
import { AuthModal } from '../components/AuthModal'; 
import ProfileSidebar from '../components/ProfileSidebar';
import NotificationManager from '../components/NotificationManager';
import confetti from 'canvas-confetti';
import { db, app } from '../lib/firebase';
// --- MUDANÇA 1: Adicionei 'addDoc' na lista de imports abaixo ---
import { doc, getDoc, collection, getDocs, onSnapshot, updateDoc, increment, serverTimestamp, query, orderBy, addDoc } from 'firebase/firestore'; 
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

interface NotificationMsg {
    id: string;
    title: string;
    body: string;
    read: boolean;
    createdAt: any;
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
  
  // --- CONFIGURAÇÃO DO PRESENTE DIÁRIO (daily_gift) ---
  const [dailyGiftConfig, setDailyGiftConfig] = useState({
      active: false,    // Liga/Desliga a caixa
      amount: 0         // Valor do bônus em R$
  });

  // --- NOTIFICAÇÕES ---
  const [notifications, setNotifications] = useState<NotificationMsg[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  // --- POPUPS ---
  const [previewGame, setPreviewGame] = useState<Game | null>(null);
  const [showMysteryBox, setShowMysteryBox] = useState(false);
  
  // --- ESTADOS DO BÔNUS DIÁRIO ---
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [claimingBonus, setClaimingBonus] = useState(false);

  // --- PWA ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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

  // --- HELPER: FORMATAR DINHEIRO ---
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // --- EFEITO INICIAL ---
  useEffect(() => {
    if (typeof window !== 'undefined') winAudioRef.current = new Audio('/win.mp3');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    const auth = getAuth(app);
    let unsubscribeSnapshot: any = null;
    let unsubscribeNotifs: any = null;

    const initData = async () => {
        try {
            // 1. Config Layout
            const docRef = doc(db, 'config', 'layout');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setLayoutConfig(docSnap.data());

            // 2. CONFIGURAÇÃO DO PRESENTE DIÁRIO
            const giftRef = doc(db, 'config', 'daily_gift');
            onSnapshot(giftRef, (snap) => {
                if(snap.exists()) {
                    setDailyGiftConfig(snap.data() as any);
                }
            });

            // 3. Jogos
            const querySnapshot = await getDocs(collection(db, 'games'));
            const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Game[];
            setGamesList(list);

            // 4. Ganhadores
            const winnersSnapshot = await getDocs(collection(db, 'winners'));
            const wList = winnersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Winner[];
            setWinnersList(wList);
        } catch (error) {
            console.error("Erro init:", error);
        }
    };

    initData();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        setIsAuthOpen(false); 
        const userDocRef = doc(db, 'users', currentUser.uid);
        
        // Ouvir Saldo e Data do Bônus
        unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBalance(data.balance || 0);
                checkBonusAvailability(data.lastDailyBonus);
            }
        });

        // Ouvir Notificações
        const notifQuery = query(collection(db, 'users', currentUser.uid, 'notifications'), orderBy('createdAt', 'desc'));
        unsubscribeNotifs = onSnapshot(notifQuery, (snapshot) => {
            const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as NotificationMsg[];
            setNotifications(msgs);
        });

      } else {
        setBalance(0);
        setIsAuthOpen(true);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if (unsubscribeNotifs) unsubscribeNotifs();
      }
    });

    return () => {
        unsubscribeAuth();
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        if (unsubscribeNotifs) unsubscribeNotifs();
    };
  }, []);

  // --- LÓGICA DO BÔNUS DIÁRIO ---
  const checkBonusAvailability = (lastBonusTimestamp: any) => {
      if (!lastBonusTimestamp) {
          setBonusAvailable(true); // Nunca pegou
          return;
      }
      
      const lastDate = lastBonusTimestamp.toDate();
      const now = new Date();
      const diffMs = now.getTime() - lastDate.getTime();
      const hours24 = 24 * 60 * 60 * 1000;

      if (diffMs >= hours24) {
          setBonusAvailable(true); // Já passou 24h
      } else {
          setBonusAvailable(false);
          const remaining = hours24 - diffMs;
          const h = Math.floor(remaining / (1000 * 60 * 60));
          const m = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${h}h ${m}m`);
      }
  };

  // --- MUDANÇA 2: Função Atualizada para Criar Notificação no Sininho ---
  const claimDailyBonus = async () => {
      if (!user || !bonusAvailable || !dailyGiftConfig.active) return;
      setClaimingBonus(true);

      try {
          const userRef = doc(db, 'users', user.uid);
          
          // 1. Dá o dinheiro
          await updateDoc(userRef, {
              balance: increment(dailyGiftConfig.amount), 
              lastDailyBonus: serverTimestamp()
          });

          // 2. CRIA A NOTIFICAÇÃO NO BANCO (Isso faz o sininho acender)
          await addDoc(collection(db, 'users', user.uid, 'notifications'), {
              title: '🎁 Bônus Resgatado!',
              body: `Você recebeu ${formatCurrency(dailyGiftConfig.amount)} de presente diário. Aproveite!`,
              read: false,
              createdAt: serverTimestamp()
          });
          
          triggerWin(); 
          // O alerta visual continua, mas agora tem o registro no sino também
          setShowMysteryBox(false);
      } catch (error) {
          console.error(error);
          alert("Erro ao resgatar. Tente novamente.");
      } finally {
          setClaimingBonus(false);
      }
  };

  // --- NAVEGAÇÃO ---
  const handleOpenDeposit = () => user ? setIsDepositOpen(true) : setIsAuthOpen(true);
  const handleEnterGame = (game: Game) => {
    if (!user) return setIsAuthOpen(true);
    setActiveGame(game);
    setView('GAME');
    setTimeout(() => { setPrizesGrid([]); setLoading(true); }, 100);
  };
  const handleLogout = () => { signOut(getAuth(app)); setIsProfileOpen(false); };
  const handleGoToWinners = () => { setActiveGame(null); setView('WINNERS'); };

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

    // Sorteio
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
                if (finalGrid.filter(p => p.name === candidate.name).length < 2) selectedFiller = candidate;
            }
            finalGrid.push(selectedFiller);
        }
    } else {
        for (let i = 0; i < 9; i++) {
            if (Math.random() > 0.3) { finalGrid.push(loserPlaceholder); } 
            else {
                 const randomReal = activeGame.prizes[Math.floor(Math.random() * activeGame.prizes.length)];
                 if (randomReal) {
                     if (finalGrid.filter(p => p.name === randomReal.name).length < 2) finalGrid.push(randomReal);
                     else finalGrid.push(loserPlaceholder);
                 } else { finalGrid.push(loserPlaceholder); }
            }
        }
    }
    setPrizesGrid(finalGrid.sort(() => Math.random() - 0.5));
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
        return { indices: indices, amount: prizeObj && prizeObj.value > 0 ? formatCurrency(prizeObj.value) : name };
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
          updateDoc(doc(db, 'users', user.uid), { balance: increment(prizeValue) });
      }
    } else { setResultType('LOSS'); }
    setTimeout(() => { setShowPopup(true); }, 500);
  };

  const triggerWin = () => {
    if (winAudioRef.current) { winAudioRef.current.currentTime = 0; winAudioRef.current.play().catch(() => {}); }
    confetti({ startVelocity: 30, spread: 360, ticks: 60, particleCount: 50, origin: { x: Math.random(), y: Math.random() - 0.2 }, colors: [layoutConfig.color, '#ffffff'] });
  };

  // --- NAVEGAÇÃO ---
  const handleBackToLobby = () => { setShowPopup(false); setIsGameFinished(false); setActiveGame(null); setView('LOBBY'); };
  const handleOpenGame = (game: Game) => {
      if (!user) return setIsAuthOpen(true);
      setActiveGame(game);
      setView('GAME');
      setTimeout(() => { setPrizesGrid([]); setLoading(true); }, 100);
  };

  return (
    <>
      <NotificationManager />

      {/* MOBILE HEADER */}
      <div className="md:hidden min-h-screen bg-zinc-950 text-white font-sans pb-24" style={{ selectionBackgroundColor: layoutConfig.color } as any}>
        <header className="fixed top-0 w-full z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'LOBBY' ? (
              <button onClick={handleBackToLobby} className="p-2 -ml-2 text-zinc-400 hover:text-white"><ChevronLeft size={28} /></button>
            ) : (
              <div className="h-10 flex items-center justify-center">
                {layoutConfig.logo ? <img src={layoutConfig.logo} className="h-8 w-auto object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: layoutConfig.color }}><Zap className="text-black" size={20} /></div>}
              </div>
            )}
            <div className="flex flex-col cursor-pointer" onClick={handleOpenDeposit}>
              <span className="text-xs text-zinc-400 font-medium">{user ? 'Saldo' : 'Login'}</span>
              <span className="text-sm font-bold text-white flex items-center gap-1">{user ? formatCurrency(balance) : 'Entrar'} <PlusCircle size={14} style={{ color: layoutConfig.color }} /></span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* NOTIFICAÇÕES (Conectado ao DB) */}
            <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="bg-zinc-800 p-2 rounded-full text-zinc-400 hover:text-white relative">
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-zinc-800"></span>}
                </button>
                {showNotifications && (
                    <div className="absolute right-0 top-12 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in">
                        <div className="p-3 border-b border-zinc-800 bg-zinc-950 font-bold text-sm flex justify-between items-center">
                            <span>Notificações</span>
                            <button onClick={() => setShowNotifications(false)}><X size={14}/></button>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.length > 0 ? (
                                notifications.map(n => (
                                    <div key={n.id} className="p-3 border-b border-zinc-800/50 hover:bg-zinc-800/50">
                                        <p className="text-xs font-bold text-white mb-1">{n.title}</p>
                                        <p className="text-[10px] text-zinc-400 leading-relaxed">{n.body}</p>
                                    </div>
                                ))
                            ) : <div className="p-6 text-center text-xs text-zinc-500">Você não tem notificações.</div>}
                        </div>
                    </div>
                )}
            </div>
            
            <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="w-9 h-9 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center">
                <User size={18} className="text-zinc-400" />
            </button>
          </div>
        </header>

        <div className="h-20"></div>

        {/* --- TELA WINNERS --- */}
        {view === 'WINNERS' && (
             <main className="px-4 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="text-center mb-8 mt-4">
                     <h2 className="text-2xl font-black text-white uppercase italic">Galeria de <span style={{ color: layoutConfig.color }}>Ganhadores</span></h2>
                     <p className="text-zinc-500 text-xs mt-1">Veja quem já faturou alto hoje!</p>
                 </div>
                 <div className="flex flex-col gap-6">
                     {winnersList.length > 0 ? (
                        winnersList.map((winner, index) => {
                             const imgUrl = winner.image || winner.url || winner.photo;
                             if (!imgUrl) return null;
                             return (
                                 <div key={index} className="rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl relative bg-zinc-900">
                                     <img src={imgUrl} className="w-full h-auto object-cover" /> 
                                     {(winner.name || winner.amount) && (
                                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-6">
                                            <p className="text-yellow-500 font-black text-xl">{winner.amount ? formatCurrency(winner.amount) : ''}</p>
                                            <p className="text-white font-bold">{winner.name}</p>
                                            <p className="text-zinc-400 text-xs">{winner.city}</p>
                                        </div>
                                     )}
                                 </div>
                             );
                        })
                     ) : (
                        <div className="text-center py-20 text-zinc-500 border border-zinc-800 rounded-2xl border-dashed"><Trophy size={48} className="mx-auto mb-4 opacity-30" /><p className="text-sm">Carregando galeria...</p></div>
                     )}
                 </div>
                 <button onClick={handleBackToLobby} className="w-full mt-8 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-4 rounded-xl">Voltar</button>
             </main>
        )}

        {view === 'GAME' && activeGame && (
          <main className="flex flex-col items-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-full max-w-sm flex justify-between items-end mb-4">
              <div><h1 className="text-2xl font-black italic text-white tracking-tight uppercase">{activeGame.name}</h1><p className="text-zinc-500 text-xs font-medium">Encontre 3 símbolos iguais</p></div>
              <div className="bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800 flex items-center gap-2"><span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: layoutConfig.color }}></span><span className="text-xs text-zinc-300 font-bold">Ao Vivo</span></div>
            </div>
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-3xl p-1 shadow-2xl border border-zinc-800 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-32 opacity-40" style={{ background: `linear-gradient(to bottom, ${layoutConfig.color}33, transparent)` }}></div>
              <div className="relative bg-zinc-950 rounded-[20px] p-4 border border-zinc-800/50">
                {loading || prizesGrid.length === 0 ? (
                  <div className="w-full aspect-square flex flex-col items-center justify-center gap-4 text-zinc-500"><div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: layoutConfig.color }}></div><span className="text-xs font-medium uppercase tracking-widest">Carregando...</span></div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg border-2 border-zinc-800 group">
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2 p-2 bg-zinc-900">
                        {prizesGrid.map((prize, index) => (
                          <div key={index} className={`rounded-lg flex flex-col items-center justify-center border transition-all duration-500 overflow-hidden relative ${winningIndices.includes(index) ? 'border-white z-10 scale-105 shadow-lg' : 'bg-white border-zinc-300'}`} style={winningIndices.includes(index) ? { backgroundColor: layoutConfig.color, boxShadow: `0 0 20px ${layoutConfig.color}99` } : {}}>
                            {prize.image ? <img src={prize.image} className="w-[80%] h-[80%] object-contain drop-shadow-sm" /> : <span className={`font-black text-center leading-tight select-none p-1 ${winningIndices.includes(index) ? 'text-black text-xs' : 'text-zinc-900 text-[10px]'}`}>{prize.name}</span>}
                          </div>
                        ))}
                      </div>
                      <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage={layoutConfig.scratchCover} />
                    </div>
                    {!isGameFinished ? <button onClick={handleGameFinish} className="w-full bg-zinc-800 hover:bg-zinc-700 font-bold py-3.5 rounded-xl border border-zinc-700 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg" style={{ color: layoutConfig.color }}><Zap size={18} className="fill-current" /> <span className="text-sm tracking-wide">REVELAR TUDO</span></button> : <button onClick={playRound} className="w-full hover:opacity-90 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 animate-pulse" style={{ backgroundColor: layoutConfig.color }}><Zap size={18} className="fill-current" /> <span className="text-sm tracking-wide">COMPRAR NOVA ({formatCurrency(activeGame.price)})</span></button>}
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
            <div className="w-full rounded-2xl relative overflow-hidden shadow-lg border border-zinc-800 mb-8 group bg-zinc-900">
              {layoutConfig.banner ? <img src={layoutConfig.banner} className="w-full h-auto object-contain block" /> : <div className="h-52 bg-zinc-800 flex items-center justify-center font-bold text-zinc-600">Sem Banner</div>}
            </div>
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Grid size={18} style={{ color: layoutConfig.color }} /> Destaques</h3>
            <div className="flex flex-col gap-5">
              {gamesList.length > 0 ? (
                  gamesList.map((game) => {
                      const maxPrize = Math.max(...(game.prizes?.map(p => Number(p.value) || 0) || [0]));
                      return (
                      <div key={game.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-lg">
                          <div className="w-full h-44 bg-zinc-950 relative flex items-center justify-center overflow-hidden">
                               {game.cover ? <img src={game.cover} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">Sem Imagem</div>}
                          </div>
                          <div className="p-4 flex flex-col gap-1 items-start text-left">
                              <h3 className="text-white font-bold text-lg leading-tight">{game.name}</h3>
                              <span className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: layoutConfig.color }}>PRÊMIOS DE ATÉ {formatCurrency(maxPrize)}</span>
                              <div className="w-full flex items-center justify-between mt-auto">
                                  <button onClick={() => handleOpenGame(game)} className="flex items-center gap-2 px-4 py-2 rounded-lg transition-transform active:scale-95 hover:brightness-110" style={{ backgroundColor: layoutConfig.color }}>
                                      <div className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center"><Zap size={10} className="text-black fill-current" /></div>
                                      <span className="text-black font-black text-sm uppercase">JOGAR</span>
                                      <div className="bg-black/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-black">{formatCurrency(game.price)}</div>
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewGame(game); }} className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors"><Gift size={12} /> VER PRÊMIOS <ChevronRight size={10} /></button>
                              </div>
                          </div>
                      </div>
                      );
                  })
              ) : <div className="text-center py-10 text-zinc-500 text-sm">Carregando...</div>}
            </div>
          </main>
        )}

        {/* MENU INFERIOR ALINHADO */}
        <div className="fixed bottom-0 w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 pb-2 pt-2 px-0 z-50 h-[80px] grid grid-cols-5 items-center">
          <button onClick={handleBackToLobby} className={`flex flex-col items-center justify-center gap-1 h-full ${view === 'LOBBY' ? '' : 'text-zinc-500'}`} style={view === 'LOBBY' ? { color: layoutConfig.color } : {}}>
              <HomeIcon size={24} strokeWidth={view === 'LOBBY' ? 3 : 2} /> <span className="text-[10px] font-medium">Início</span>
          </button>
          <button onClick={() => user ? setShowMysteryBox(true) : setIsAuthOpen(true)} className={`flex flex-col items-center justify-center gap-1 h-full ${showMysteryBox ? 'text-white' : 'text-zinc-500'}`}>
              <Gift size={24} /> <span className="text-[10px] font-medium">Surpresa</span>
          </button>
          <div className="relative h-full flex items-center justify-center">
              <button onClick={handleOpenDeposit} className="absolute -top-8 text-black p-4 rounded-full transition-transform active:scale-95 border-4 border-zinc-950 shadow-xl" style={{ backgroundColor: layoutConfig.color, boxShadow: `0 0 20px ${layoutConfig.color}66` }}>
                  <PlusCircle size={32} strokeWidth={2.5} />
              </button>
          </div>
          <button onClick={handleGoToWinners} className={`flex flex-col items-center justify-center gap-1 h-full ${view === 'WINNERS' ? 'text-white' : 'text-zinc-500'}`}>
              <Trophy size={24} /> <span className="text-[10px] font-medium">Ganhadores</span>
          </button>
          <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className={`flex flex-col items-center justify-center gap-1 h-full ${isProfileOpen ? 'text-white' : 'text-zinc-500'}`}>
              <User size={24} /> <span className="text-[10px] font-medium">Perfil</span>
          </button>
        </div>
      </div>

      {/* --- POPUP VER PRÊMIOS --- */}
      {previewGame && (
         <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewGame(null)}>
             <div className="w-full max-w-sm rounded-3xl p-1 relative shadow-2xl bg-gradient-to-br from-[#ffc700] to-yellow-700" onClick={e => e.stopPropagation()}>
                 <div className="bg-zinc-950 w-full h-full rounded-[20px] p-6 relative">
                    <button onClick={() => setPreviewGame(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
                    <div className="text-center mb-6">
                        <h3 className="text-xl font-black text-white mb-1 uppercase italic">{previewGame.name}</h3>
                        <p className="text-zinc-400 text-xs">Tabela de premiação</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
                        {previewGame.prizes && previewGame.prizes.map((p: any, i: number) => (
                            <div key={i} className="bg-zinc-900 p-3 rounded-xl border border-zinc-800 flex flex-col items-center justify-center hover:bg-zinc-800">
                                {p.image ? <img src={p.image} className="h-8 w-8 object-contain mb-1" /> : null}
                                <span className="text-[10px] text-zinc-400 font-bold mb-1 text-center">{p.name}</span>
                                <span className="text-xs font-black text-yellow-500">{formatCurrency(p.value)}</span>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => { setPreviewGame(null); handleOpenGame(previewGame); }} className="w-full mt-6 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wide shadow-lg" style={{ backgroundColor: layoutConfig.color }}>JOGAR AGORA ({formatCurrency(previewGame.price)})</button>
                 </div>
             </div>
         </div>
      )}

      {/* --- POPUP CAIXA SURPRESA (SIMPLIFICADA) --- */}
      {showMysteryBox && (
         <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setShowMysteryBox(false)}>
             <div className="w-full max-w-sm rounded-3xl p-1 relative shadow-2xl bg-gradient-to-br from-purple-500 to-indigo-600" onClick={e => e.stopPropagation()}>
                 <div className="bg-zinc-950 w-full h-full rounded-[20px] p-8 relative text-center">
                    <button onClick={() => setShowMysteryBox(false)} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X size={20}/></button>
                    <div className="w-24 h-24 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-purple-500 animate-bounce"><Gift size={48} className="text-purple-400" /></div>
                    <h3 className="text-2xl font-black text-white mb-2 uppercase italic">Bônus Diário</h3>
                    {dailyGiftConfig.active ? (
                        bonusAvailable ? (
                            <>
                                <p className="text-zinc-400 text-sm mb-6">Ganhe <span className="text-purple-400 font-bold">{formatCurrency(dailyGiftConfig.amount)} de Saldo</span> para jogar onde quiser!</p>
                                <button onClick={claimDailyBonus} disabled={claimingBonus} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2">{claimingBonus ? 'Resgatando...' : 'RESGATAR AGORA'}</button>
                            </>
                        ) : (
                            <><p className="text-zinc-400 text-sm mb-2">Volte amanhã para mais.</p><div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 mb-6"><p className="text-xs text-zinc-500 uppercase font-bold mb-1">Próximo bônus em</p><div className="text-2xl font-black text-white flex items-center justify-center gap-2"><Clock size={20} className="text-purple-500" /> {timeLeft}</div></div></>
                        )
                    ) : (
                        <p className="text-zinc-500 text-sm py-4">Nenhuma campanha de bônus ativa no momento.</p>
                    )}
                 </div>
             </div>
         </div>
      )}

      {/* DESKTOP (MANTIDO) */}
      <div className="hidden md:flex flex-col min-h-screen bg-[#09090b] text-white font-sans selection:bg-yellow-500/30">
         <div className="h-screen flex items-center justify-center text-zinc-500">Versão Desktop (Estrutura mantida)</div>
      </div>

      {showPopup && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[70] p-6 animate-in fade-in">
          <div className="w-full max-w-sm bg-zinc-900 rounded-3xl p-6 border border-zinc-800 text-center relative shadow-2xl">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 ${resultType === 'WIN' ? 'text-black shadow-lg' : 'bg-zinc-800 border-zinc-700 text-zinc-500'}`} style={resultType === 'WIN' ? { backgroundColor: layoutConfig.color, borderColor: '#fff' } : {}}>
              {resultType === 'WIN' ? <Trophy size={40} className="fill-current" /> : <XCircle size={40} />}
            </div>
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic">{resultType === 'WIN' ? 'Parabéns!' : 'Não foi dessa vez'}</h2>
            {resultType === 'WIN' ? <div className="p-4 rounded-2xl border mb-6" style={{ backgroundColor: `${layoutConfig.color}1a`, borderColor: `${layoutConfig.color}33` }}><p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: layoutConfig.color }}>Você ganhou</p><p className="text-4xl font-black tracking-tighter" style={{ color: layoutConfig.color }}>{winAmount}</p></div> : <p className="text-zinc-400 text-sm mb-8 leading-relaxed">Tente novamente.</p>}
            <button onClick={playRound} className="w-full text-black font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform mb-3" style={{ backgroundColor: layoutConfig.color }}><RotateCw size={20} strokeWidth={3} /> JOGAR NOVAMENTE</button>
            <button onClick={handleBackToLobby} className="text-zinc-500 font-bold text-sm hover:text-white py-2">Voltar ao Início</button>
          </div>
        </div>
      )}

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={(u) => { setUser(u); setIsDepositOpen(true); }} />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} userId={user?.uid} userEmail={user?.email} />
      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} balance={balance} onLogout={handleLogout} />
    </>
  );
}