'use client';

import { useState, useRef, useEffect } from 'react';
import ScratchCard from '../components/ScratchCard';
import DepositModal from '../components/DepositModal';
import { AuthModal } from '../components/AuthModal'; 
import ProfileSidebar from '../components/ProfileSidebar';
import CarnivalWheel, { WHEEL_PRIZES } from '../components/CarnivalWheel'; // <--- IMPORTANDO A NOVA ROLETA
import confetti from 'canvas-confetti';
import { db, app } from '../lib/firebase';
import { doc, getDoc, collection, getDocs, onSnapshot, updateDoc, increment } from 'firebase/firestore'; 
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  User, Trophy, ChevronLeft, Home as HomeIcon, Grid, PlusCircle, Bell, Zap, Star, XCircle, RotateCw, Gift, ChevronRight, Play, LogOut, Loader2, Dices, Sparkles
} from 'lucide-react';

// ... (Interfaces Prize e Game continuam iguais) ...
interface Prize { name: string; value: number; chance: number; image?: string; }
interface Game { id: string; name: string; price: number; cover: string; description?: string; prizes: Prize[]; }

export default function Home() {
  // --- ESTADOS GERAIS ---
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState(0); 
  // ADICIONADO 'ROULETTE' NAS VIEWS
  const [view, setView] = useState<'LOBBY' | 'GAME' | 'ROULETTE'>('LOBBY');
  const [gamesList, setGamesList] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<any>(null);
  const [prizesGrid, setPrizesGrid] = useState<Prize[]>([]); 
  const [loading, setLoading] = useState(false);
  const [gameId, setGameId] = useState(0);
  
  // --- ESTADOS DA ROLETA (NOVOS) ---
  const [wheelAngle, setWheelAngle] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasFreeSpin, setHasFreeSpin] = useState(true); // <--- Simulação: Começa com giro grátis

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

  // --- EFEITO INICIAL (Mantido igual) ---
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
                // AQUI NO FUTURO: Checar no banco se tem giro grátis hoje
            }
        });
      } else {
        setBalance(0); setIsAuthOpen(true);
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });
    return () => { unsubscribeAuth(); if (unsubscribeSnapshot) unsubscribeSnapshot(); };
  }, []);

  // --- FUNÇÕES GERAIS ---
  const handleOpenDeposit = () => { !user ? setIsAuthOpen(true) : setIsDepositOpen(true); };
  const handleEnterGame = (game: Game) => { if (!user) { setIsAuthOpen(true); return; } setActiveGame(game); setView('GAME'); setTimeout(() => { setPrizesGrid([]); setLoading(true); }, 100); };
  const handleLogout = () => { const auth = getAuth(app); signOut(auth); setIsProfileOpen(false); };
  const handleBackToLobby = () => { setShowPopup(false); setIsGameFinished(false); setActiveGame(null); setView('LOBBY'); };

  // --- LÓGICA DA ROLETA (VISUAL POR ENQUANTO) ---
  const handleSpinClick = () => {
    if (isSpinning || !user) {
        if (!user) setIsAuthOpen(true);
        return;
    }

    // Lógica de cobrança (Simulação)
    if (!hasFreeSpin) {
        if (balance < 1) { setIsDepositOpen(true); return; }
        // Aqui descontaria R$ 1 do banco
        setBalance(prev => prev - 1); // Simulação visual do desconto
    } else {
        setHasFreeSpin(false); // Gastou o giro grátis
    }

    setIsSpinning(true);
    
    // Sorteia um prêmio aleatório para demonstração
    const prizeIndex = Math.floor(Math.random() * WHEEL_PRIZES.length);
    const segmentAngle = 360 / WHEEL_PRIZES.length;
    // Calcula o ângulo final: muitas voltas (1440deg) + ângulo do prêmio + pequeno ajuste para centralizar
    const finalAngle = wheelAngle + 1440 + (prizeIndex * segmentAngle) + (segmentAngle / 2);

    setWheelAngle(finalAngle);

    // Tempo da animação (5 segundos, igual ao CSS da roleta)
    setTimeout(() => {
        setIsSpinning(false);
        // Aqui mostraria o popup do prêmio
        // const prize = WHEEL_PRIZES[prizeIndex];
        // alert(`Você ganhou: ${prize.label}`);
    }, 5000);
  };

  // --- LÓGICA DO JOGO RASPADINHA (Mantida igual) ---
  const playRound = async () => { /* ... Seu código da raspadinha aqui ... */ };
  const checkWinner = () => { /* ... Seu código aqui ... */ return null; };
  const handleGameFinish = () => { /* ... Seu código aqui ... */ };
  const triggerWin = () => { /* ... Seu código aqui ... */ };
  useEffect(() => { if (view === 'GAME' && activeGame) { playRound(); } }, [view, activeGame]);


  // --- RENDERIZAÇÃO ---
  return (
    <>
      {/* ======================== LAYOUT MOBILE ======================== */}
      <div className="md:hidden min-h-screen bg-zinc-950 text-white font-sans pb-24" style={{ selectionBackgroundColor: layoutConfig.color } as any}>
        <header className="fixed top-0 w-full z-40 bg-zinc-950/80 backdrop-blur-md border-b border-white/5 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Botão Voltar aparece se não estiver no Lobby */}
            {view !== 'LOBBY' ? (
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
            <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className="w-9 h-9 bg-zinc-800 rounded-full border border-zinc-700 flex items-center justify-center"><User size={18} className="text-zinc-400" /></button>
          </div>
        </header>

        <div className="h-20"></div>

        {/* --- CONTEÚDO PRINCIPAL --- */}
        {view === 'GAME' && activeGame ? (
           /* --- VIEW: RASPADINHA --- */
           <main className="flex flex-col items-center px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {/* ... (Seu código da Raspadinha existente) ... */}
             <div className="text-zinc-500 py-10">Conteúdo da Raspadinha Aqui (Simplificado para o exemplo)</div>
           </main>
        ) : view === 'ROULETTE' ? (
           /* --- VIEW: ROLETA DE CARNAVAL (NOVO) --- */
           <main className="flex flex-col items-center px-4 py-6 animate-in fade-in zoom-in duration-500 overflow-hidden relative">
             {/* Fundo Temático de Carnaval */}
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://img.freepik.com/free-vector/flat-carnival-party-pattern-background_23-2149275702.jpg?w=740&t=st=1706637000~exp=1706637600~hmac=...')] bg-cover bg-center opacity-10 z-0 pointer-events-none mix-blend-overlay"></div>
             <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-transparent to-zinc-950 z-0 pointer-events-none"></div>

             <div className="relative z-10 text-center mb-2">
                <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#bf953f] via-[#fcf6ba] to-[#bf953f] uppercase tracking-tighter italic drop-shadow-sm flex items-center justify-center gap-2">
                    <Sparkles className="text-[#bf953f]" /> Roleta da Folia
                </h1>
                <p className="text-[#bf953f] text-sm font-bold uppercase tracking-widest">Gire e ganhe prêmios diários!</p>
             </div>

             {/* Componente da Roleta */}
             <CarnivalWheel 
                isSpinning={isSpinning}
                rotationAngle={wheelAngle}
                onSpinClick={handleSpinClick}
                hasFreeSpin={hasFreeSpin}
             />

             <div className="bg-zinc-900/80 backdrop-blur-md p-4 rounded-2xl border border-[#bf953f]/30 text-center max-w-xs relative z-10 mt-4 shadow-lg">
                 <p className="text-zinc-300 text-sm leading-relaxed">
                     {hasFreeSpin ? 
                        <span className="font-bold text-[#fcf6ba]">Você tem 1 Giro Grátis hoje!</span> : 
                        <span>Gire por apenas <span className="font-bold text-[#bf953f]">R$ 1,00</span> e tente a sorte.</span>
                     }
                 </p>
             </div>
           </main>
        ) : (
          /* --- VIEW: LOBBY (Mantido igual) --- */
          <main className="px-4 pb-8">
            {/* ... (Seu código do Lobby existente) ... */}
             <div className="text-zinc-500 py-10">Conteúdo do Lobby Aqui (Simplificado para o exemplo)</div>
          </main>
        )}

        {/* MENU INFERIOR MOBILE */}
        <div className="fixed bottom-0 w-full bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 pb-6 pt-2 px-6 flex justify-between items-center z-50 h-20 shadow-2xl">
          <button onClick={handleBackToLobby} className={`flex flex-col items-center gap-1 ${view === 'LOBBY' ? '' : 'text-zinc-500'}`} style={view === 'LOBBY' ? { color: layoutConfig.color } : {}}><HomeIcon size={24} strokeWidth={view === 'LOBBY' ? 3 : 2} /><span className="text-[10px] font-medium">Início</span></button>
          
          {/* BOTÃO DA ROLETA (ATIVO) */}
          <button onClick={() => setView('ROULETTE')} className={`flex flex-col items-center gap-1 ${view === 'ROULETTE' ? 'text-[#bf953f]' : 'text-zinc-500'}`}>
              <Dices size={24} strokeWidth={view === 'ROULETTE' ? 3 : 2} className={view === 'ROULETTE' ? 'animate-pulse fill-[#bf953f]/20' : ''} />
              <span className="text-[10px] font-medium">Roleta</span>
          </button>
          
          <div className="relative -top-6"><button onClick={handleOpenDeposit} className="text-black p-4 rounded-full transition-transform active:scale-95 border-4 border-zinc-950" style={{ backgroundColor: layoutConfig.color, boxShadow: `0 0 20px ${layoutConfig.color}66` }}><PlusCircle size={32} strokeWidth={2.5} /></button></div>
          <button className="flex flex-col items-center gap-1 text-zinc-500"><Trophy size={24} /><span className="text-[10px] font-medium">Ganhadores</span></button>
          <button onClick={() => user ? setIsProfileOpen(true) : setIsAuthOpen(true)} className={`flex flex-col items-center gap-1 ${isProfileOpen ? 'text-white' : 'text-zinc-500'}`}><User size={24} /><span className="text-[10px] font-medium">Perfil</span></button>
        </div>
      </div>

      {/* ======================== LAYOUT DESKTOP (Oculto para focar no mobile primeiro) ======================== */}
      <div className="hidden md:flex items-center justify-center h-screen text-white">
          Versão Desktop em construção... Foco no Mobile.
      </div>

      {/* MODAIS */}
      {/* ... (Seus modais de popup, auth, deposit, profile aqui) ... */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} onLoginSuccess={setUser} />
      <DepositModal isOpen={isDepositOpen} onClose={() => setIsDepositOpen(false)} userId={user?.uid} userEmail={user?.email} />
      <ProfileSidebar isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={user} balance={balance} onLogout={handleLogout} />
    </>
  );
}