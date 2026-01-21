'use client';

import { useState, useRef, useEffect } from 'react';
import ScratchCard from '../components/ScratchCard';
import DepositModal from '../components/DepositModal';
import { AuthModal } from '../components/AuthModal'; 
import ProfileSidebar from '../components/ProfileSidebar';
import CarnivalWheel, { WHEEL_PRIZES } from '../components/CarnivalWheel';
import confetti from 'canvas-confetti';
import { db, app } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, onSnapshot, updateDoc, increment } from 'firebase/firestore'; 
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  User, Trophy, ChevronLeft, Home as HomeIcon, Grid, PlusCircle, Bell, Zap, Star, XCircle, RotateCw, Gift, ChevronRight, Play, Dices, Sparkles, Music
} from 'lucide-react';

interface Prize { name: string; value: number; chance: number; image?: string; }
interface Game { id: string; name: string; price: number; cover: string; description?: string; prizes: Prize[]; }

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState(0); 
  const [view, setView] = useState<'LOBBY' | 'GAME' | 'ROULETTE'>('LOBBY');
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [prizesGrid, setPrizesGrid] = useState<Prize[]>([]); 
  const [loading, setLoading] = useState(false);
  const [gameId, setGameId] = useState(0);
  
  // Roleta
  const [wheelAngle, setWheelAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasFreeSpin, setHasFreeSpin] = useState(true);

  // Modais
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
  
  // Áudios
  const winAudioRef = useRef<HTMLAudioElement | null>(null);
  const spinAudioRef = useRef<HTMLAudioElement | null>(null); 
  const stopAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        winAudioRef.current = new Audio('/win.mp3');
        spinAudioRef.current = new Audio('/roulette_spin.mp3');
        stopAudioRef.current = new Audio('/roulette_stop.mp3');
    }

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
        } catch (error) { console.error("Erro carregamento inicial", error); }
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
        setBalance(0); setIsAuthOpen(true);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });
    return () => { unsubscribeAuth(); if (unsubscribeSnapshot) unsubscribeSnapshot(); };
  }, []);

  const handleOpenDeposit = () => { !user ? setIsAuthOpen(true) : setIsDepositOpen(true); };
  
  const handleEnterGame = (game: Game) => { 
      if (!user) { setIsAuthOpen(true); return; } 
      setActiveGame(game); 
      setView('GAME'); 
      setTimeout(() => { setPrizesGrid([]); setLoading(true); }, 100); 
  };
  
  const handleLogout = () => { const auth = getAuth(app); signOut(auth); setIsProfileOpen(false); };
  const handleBackToLobby = () => { setShowPopup(false); setIsGameFinished(false); setActiveGame(null); setView('LOBBY'); };

  // --- LÓGICA DA ROLETA ---
  const handleSpinClick = () => {
    if (isSpinning || !user) { if (!user) setIsAuthOpen(true); return; }
    
    if (!hasFreeSpin) {
        if (balance < 1) { setIsDepositOpen(true); return; }
        setBalance(prev => prev - 1); 
    } else {
        setHasFreeSpin(false);
    }

    setIsSpinning(true);
    
    // Tocar som de giro
    if (spinAudioRef.current) {
        spinAudioRef.current.currentTime = 0;
        spinAudioRef.current.loop = true;
        spinAudioRef.current.play().catch(() => {});
    }

    const prizeIndex = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const segmentAngle = 360 / WHEEL_PRIZES.length;
    const finalAngle = wheelAngle + 1800 + (prizeIndex * segmentAngle) + (segmentAngle / 2);
    setWheelAngle(finalAngle);

    setTimeout(() => { 
        setIsSpinning(false);
        if (spinAudioRef.current) {
            spinAudioRef.current.pause();
            spinAudioRef.current.currentTime = 0;
        }
        if (stopAudioRef.current) {
            stopAudioRef.current.play().catch(() => {});
        }
        
        // Efeito de vitória se for dinheiro
        if (WHEEL_PRIZES[prizeIndex].type === 'money') {
             triggerWin();
             // Aqui você adicionaria o saldo no Firebase:
             // updateDoc(doc(db, 'users', user.uid), { balance: increment(WHEEL_PRIZES[prizeIndex].value) });
        }
    }, 5000);
  };

  const playRound = async () => {
    if (!activeGame) return;
    if (balance < activeGame.price) { setIsDepositOpen(true); return; }
    if (user) {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { balance: increment(-activeGame.price) });
    }
    setLoading(true); setIsGameFinished(false); setShowPopup(false); setWinningIndices([]); setWinAmount(''); setResultType(null);
    if (winAudioRef.current) { winAudioRef.current.pause(); winAudioRef.current.currentTime = 0; }
    await new Promise(resolve => setTimeout(resolve, 500));

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
                     if (count < 2) finalGrid.push(randomReal); else finalGrid.push(loserPlaceholder);
                 } else { finalGrid.push(loserPlaceholder); }
            }
        }
    }
    finalGrid = finalGrid.sort(() => Math.random() - 0.5);
    setPrizesGrid(finalGrid); setLoading(false); setGameId(prev => prev + 1);
  };

  const checkWinner = () => {
    const counts: Record<string, number[]> = {};
    prizesGrid.forEach((item, index) => { if (!counts[item.name]) counts[item.name] = []; counts[item.name].push(index); });
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
      setResultType('WIN'); setWinningIndices(result.indices); setWinAmount(result.amount); triggerWin();
      if (user) {
          const prizeValue = prizesGrid[result.indices[0]].value;
          const userRef = doc(db, 'users', user.uid);
          updateDoc(userRef, { balance: increment(prizeValue) });
      }
    } else { setResultType('LOSS'); }
    setTimeout(() => { setShowPopup(true); }, 500);
  };

  const triggerWin = () => {
    if (winAudioRef.current) { winAudioRef.current.currentTime = 0; winAudioRef.current.play().catch(() => {}); }
    const duration = 3000; const end = Date.now() + duration;
    const interval: any = setInterval(() => {
      if (Date.now() > end) return clearInterval(interval);
      confetti({ startVelocity: 30, spread: 360, ticks: 60, particleCount: 50, origin: { x: Math.random(), y: Math.random() - 0.2 }, colors: [layoutConfig.color, '#ffffff'] });
    }, 250);
  };

  return (
    <>
      {/* MOBILE LAYOUT */}
      <div className="md:hidden min-h-screen bg-zinc-950 text-white font-sans pb-24" style={{ selectionBackgroundColor: layoutConfig.color } as any}>
        <header className="fixed top-0 w-full z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'LOBBY' ? (
              <button onClick={handleBackToLobby} className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={28} /></button>
            ) : (
              <div className="h-10 flex items-center justify-center">
                {layoutConfig.logo ? <img src={layoutConfig.logo} alt="Logo" className="h-8 w-auto object-contain" /> : <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ backgroundColor: layoutConfig.color }}><Zap className="text-black fill-current" size={20} /></div>}
              </div>
            )}
            <div className="flex flex-col cursor-pointer" onClick={handleOpenDeposit}>
              <span className="text-xs text-zinc-400 font-medium">{user ? 'Saldo' : 'Entrar'}</span>
              <span className="text-sm font-bold text-white flex items-center gap-1">
                {user ? `R$ ${balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}` : 'Login'} 
                <PlusCircle size={14} style={{ color: layoutConfig.color }} />
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="w-9 h-9 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center"><User size={18} className="text-zinc-400" /></button>
          </div>
        </header>

        <div className="h-20"></div>

        {/* --- CONTEÚDO --- */}
        {view === 'GAME' && activeGame ? (
          <main className="flex flex-col items-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-full max-w-sm flex justify-between items-end mb-4">
              <div><h1 className="text-2xl font-black italic text-white tracking-tight uppercase">{activeGame.name}</h1><p className="text-zinc-500 text-xs font-medium">Encontre 3 símbolos iguais</p></div>
            </div>
            <div className="relative w-full max-w-sm bg-zinc-900 rounded-3xl p-1 shadow-2xl border border-zinc-800 overflow-hidden">
              <div className="relative bg-zinc-950 rounded-[20px] p-4 border border-zinc-800/50">
                {loading || prizesGrid.length === 0 ? (
                  <div className="w-full aspect-square flex flex-col items-center justify-center gap-4 text-zinc-500">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2" style={{ borderColor: layoutConfig.color }}></div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="relative w-full aspect-square rounded-xl overflow-hidden shadow-lg border-2 border-zinc-800 group">
                      <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-2 p-2 bg-zinc-900">
                        {prizesGrid.map((prize, index) => (
                          <div key={index} className={`rounded-lg flex flex-col items-center justify-center border transition-all duration-500 overflow-hidden relative ${winningIndices.includes(index) ? 'border-white z-10 scale-105 shadow-lg' : 'bg-white border-zinc-300'}`} style={winningIndices.includes(index) ? { backgroundColor: layoutConfig.color } : {}}>
                            {prize.image ? <img src={prize.image} alt={prize.name} className="w-[80%] h-[80%] object-contain drop-shadow-sm" /> : <span className="text-black font-black text-sm text-center">{prize.name}</span>}
                          </div>
                        ))}
                      </div>
                      <ScratchCard key={gameId} isRevealed={isGameFinished} onReveal={handleGameFinish} coverImage={layoutConfig.scratchCover} />
                    </div>
                    {!isGameFinished ? (
                      <button onClick={handleGameFinish} className="w-full bg-zinc-800 hover:bg-zinc-700 font-bold py-3.5 rounded-xl border border-zinc-700 flex items-center justify-center gap-2" style={{ color: layoutConfig.color }}>REVELAR TUDO</button>
                    ) : (
                      <button onClick={playRound} className="w-full hover:opacity-90 text-black font-black py-3.5 rounded-xl flex items-center justify-center gap-2 animate-pulse" style={{ backgroundColor: layoutConfig.color }}>JOGAR NOVA (R$ {activeGame.price})</button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </main>
        ) : view === 'ROULETTE' ? (
           /* VIEW: ROLETA DE CARNAVAL */
           <main className="flex flex-col items-center px-4 py-6 animate-in fade-in zoom-in duration-500 overflow-hidden relative min-h-[80vh] justify-center">
             {/* Fundo Temático */}
             <div className="absolute inset-0 bg-[url('https://img.freepik.com/free-vector/realistic-brazilian-carnival-background_23-2149277239.jpg')] bg-cover bg-center opacity-30 z-0 pointer-events-none"></div>
             
             <div className="relative z-10 text-center mb-6">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FF4500] to-[#9400D3] uppercase tracking-tighter italic drop-shadow-md flex items-center justify-center gap-2">
                    <Sparkles className="text-[#FFD700]" size={32} /> Roleta da Folia
                </h1>
                <p className="text-[#FFD700] text-sm font-bold uppercase tracking-widest mt-2">Prêmios Diários!</p>
             </div>

             <CarnivalWheel 
                isSpinning={isSpinning}
                rotationAngle={wheelAngle}
                onSpinClick={handleSpinClick}
                hasFreeSpin={hasFreeSpin}
             />
           </main>
        ) : (
          /* VIEW: LOBBY */
          <main className="px-4 pb-8">
            <div className="w-full rounded-2xl relative overflow-hidden shadow-lg border border-zinc-800 mb-8 bg-zinc-900 h-48 flex items-center justify-center">
              {layoutConfig.banner ? <img src={layoutConfig.banner} className="w-full h-full object-cover" /> : <span className="text-zinc-600 font-bold">Banner Principal</span>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {gamesList.map((game) => (
                  <div key={game.id} className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 shadow-lg flex flex-col">
                      <div className="h-32 bg-zinc-950 relative flex items-center justify-center">
                           {game.cover ? <img src={game.cover} className="w-full h-full object-cover" /> : <span className="text-xs text-zinc-600">Sem Imagem</span>}
                      </div>
                      <div className="p-3 flex flex-col gap-2">
                          <h3 className="text-white font-bold leading-tight">{game.name}</h3>
                          <button onClick={() => handleEnterGame(game)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-2 rounded-lg text-sm" style={{ backgroundColor: layoutConfig.color }}>JOGAR</button>
                      </div>
                  </div>
              ))}
            </div>
          </main>
        )}

        {/* MENU MOBILE */}
        <div className="fixed bottom-0 w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 pb-6 pt-2 px-6 flex justify-between items-center z-50 h-20">
          <button onClick={handleBackToLobby} className={`flex flex-col items-center gap-1 ${view === 'LOBBY' ? 'text-yellow-500' : 'text-zinc-500'}`}><HomeIcon size={24} /><span className="text-[10px]">Início</span></button>
          <button onClick={() => setView('ROULETTE')} className={`flex flex-col items-center gap-1 ${view === 'ROULETTE' ? 'text-yellow-500 animate-pulse' : 'text-zinc-500'}`}><Dices size={24} /><span className="text-[10px]">Roleta</span></button>
          <div className="relative -top-6"><button onClick={handleOpenDeposit} className="text-black p-4 rounded-full border-4 border-zinc-950" style={{ backgroundColor: layoutConfig.color }}><PlusCircle size={32} /></button></div>
          <button className="flex flex-col items-center gap-1 text-zinc-500"><Trophy size={24} /><span className="text-[10px]">Rank</span></button>
          <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="flex flex-col items-center gap-1 text-zinc-500"><User size={24} /><span className="text-[10px]">Perfil</span></button>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-center h-screen bg-zinc-950 text-white">Versão Desktop em manutenção. Use no celular.</div>

      {/* MODAIS */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={(u) => { setUser(u); setIsDepositOpen(true); }} />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} userId={user?.uid} userEmail={user?.email} />
      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} balance={balance} onLogout={handleLogout} />
      
      {showPopup && (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-2xl p-6 text-center border border-zinc-800">
            <h2 className="text-2xl font-bold text-white mb-2">{resultType === 'WIN' ? 'VOCÊ GANHOU!' : 'Não foi dessa vez'}</h2>
            {resultType === 'WIN' && <p className="text-4xl font-black text-yellow-500 mb-4">{winAmount}</p>}
            <button onClick={playRound} className="w-full bg-yellow-500 text-black font-bold py-3 rounded-xl mb-2">JOGAR NOVAMENTE</button>
            <button onClick={handleBackToLobby} className="text-zinc-500 text-sm">Sair</button>
          </div>
        </div>
      )}
    </>
  );
}