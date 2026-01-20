'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { Save, ArrowLeft, UploadCloud, Plus, Trash2, Image as ImageIcon, AlertTriangle, Loader2 } from 'lucide-react';

function GameEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(!!gameId);

  // DADOS DA RASPADINHA (PAI)
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cover, setCover] = useState(''); // Base64

  // DADOS DOS PRÊMIOS (FILHOS)
  const [prizes, setPrizes] = useState<any[]>([]);

  // Carrega dados se for Edição
  useEffect(() => {
    if (gameId) {
      const loadGame = async () => {
        const docRef = doc(db, 'games', gameId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            setName(data.name);
            setPrice(data.price);
            setCover(data.cover);
            setPrizes(data.prizes || []);
        }
        setInitialLoad(false);
      };
      loadGame();
    }
  }, [gameId]);

  // --- UPLOAD DE IMAGEM (BASE64) ---
  const handleImageUpload = (e: any, setFunc: any) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500000) { // 500KB Max
        alert("Imagem muito grande! Use max 500KB.");
        return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setFunc(reader.result as string);
    reader.readAsDataURL(file);
  };

  // --- GERENCIAMENTO DE PRÊMIOS ---
  const addPrize = () => {
    setPrizes([...prizes, { name: '', value: '', chance: 0, image: '' }]);
  };

  const updatePrize = (index: number, field: string, value: any) => {
    const newPrizes = [...prizes];
    newPrizes[index][field] = value;
    setPrizes(newPrizes);
  };

  const updatePrizeImage = (index: number, e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
        const newPrizes = [...prizes];
        newPrizes[index].image = reader.result as string;
        setPrizes(newPrizes);
    };
    reader.readAsDataURL(file);
  };

  const removePrize = (index: number) => {
    const newPrizes = prizes.filter((_, i) => i !== index);
    setPrizes(newPrizes);
  };

  // --- CÁLCULOS ---
  const totalChance = prizes.reduce((acc, curr) => acc + (Number(curr.chance) || 0), 0);
  const ghostChance = 100 - totalChance; // A chance de perder (Modo Fantasma)

  // --- SALVAR ---
  const handleSave = async () => {
    if (!name || !price) return alert("Preencha o nome e o preço.");
    if (totalChance > 100) return alert("A soma das chances não pode passar de 100%!");

    setLoading(true);
    const gameData = {
        name,
        price,
        cover,
        prizes: prizes.map(p => ({
            ...p,
            value: Number(p.value),
            chance: Number(p.chance)
        }))
    };

    try {
        if (gameId) {
            await updateDoc(doc(db, 'games', gameId), gameData);
        } else {
            await addDoc(collection(db, 'games'), gameData);
        }
        router.push('/admin/games');
    } catch (error) {
        console.error(error);
        alert("Erro ao salvar.");
    } finally {
        setLoading(false);
    }
  };

  if (initialLoad) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Carregando editor...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.back()} className="bg-zinc-900 p-2 rounded-lg hover:bg-zinc-800"><ArrowLeft size={24}/></button>
                <h1 className="text-3xl font-bold text-white">{gameId ? 'Editar Raspadinha' : 'Criar Nova Raspadinha'}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COLUNA DA ESQUERDA: CONFIGURAÇÃO VISUAL (PAI) */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                        <h3 className="font-bold text-[#ffc700] mb-4">1. Aparência na Home</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase">Nome do Jogo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Raspa iPhone" className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white mt-1" />
                            </div>
                            
                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase">Preço para Jogar (R$)</label>
                                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="1.00" className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-white mt-1" />
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase mb-2 block">Capa do Card (Home)</label>
                                <label className="w-full h-32 bg-zinc-950 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden relative group">
                                    {cover ? <img src={cover} className="w-full h-full object-cover" /> : <div className="text-center text-zinc-600"><UploadCloud className="mx-auto mb-1"/><span className="text-[10px]">Clique para enviar</span></div>}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCover)} />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUNA DA DIREITA: PRÊMIOS (FILHOS) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-[#ffc700]">2. Prêmios & Probabilidades</h3>
                            <button onClick={addPrize} className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-2 px-3 rounded flex items-center gap-1"><Plus size={14} /> NOVO PRÊMIO</button>
                        </div>

                        {/* BARRA DE DISTRIBUIÇÃO */}
                        <div className="mb-6 bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                            <div className="flex justify-between text-xs font-bold mb-2">
                                <span className="text-green-500">CHANCE DE GANHAR: {totalChance}%</span>
                                <span className="text-zinc-500">MODO FANTASMA (PERDER): {ghostChance}%</span>
                            </div>
                            <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${totalChance}%` }}></div>
                                <div className="h-full bg-zinc-700 repeating-linear-gradient" style={{ width: `${ghostChance}%` }}></div>
                            </div>
                            {totalChance > 100 && <p className="text-red-500 text-xs mt-2 font-bold flex items-center gap-1"><AlertTriangle size={12}/> A soma passou de 100%!</p>}
                        </div>

                        {/* LISTA DE PRÊMIOS */}
                        <div className="space-y-4">
                            {prizes.map((prize, index) => (
                                <div key={index} className="bg-zinc-950 border border-zinc-800 p-4 rounded-lg flex gap-4 items-start animate-in fade-in slide-in-from-right-4">
                                    
                                    {/* Upload Imagem do Prêmio */}
                                    <label className="w-16 h-16 bg-zinc-900 border border-zinc-700 rounded flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden relative">
                                        {prize.image ? <img src={prize.image} className="w-full h-full object-contain" /> : <ImageIcon size={20} className="text-zinc-600"/>}
                                        <input type="file" className="hidden" onChange={(e) => updatePrizeImage(index, e)} />
                                    </label>

                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase">Nome do Prêmio</label>
                                            <input type="text" value={prize.name} onChange={e => updatePrize(index, 'name', e.target.value)} placeholder="Ex: iPhone 15" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase">Valor (R$)</label>
                                            <input type="number" value={prize.value} onChange={e => updatePrize(index, 'value', e.target.value)} placeholder="0.00" className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm text-white" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase">Chance (%)</label>
                                            <div className="flex items-center gap-2">
                                                <input type="range" min="0" max="100" value={prize.chance} onChange={e => updatePrize(index, 'chance', e.target.value)} className="flex-1 accent-green-500 h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
                                                <span className="text-xs font-bold w-8 text-right">{prize.chance}%</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={() => removePrize(index)} className="text-zinc-600 hover:text-red-500 transition-colors p-2"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            
                            {prizes.length === 0 && (
                                <div className="text-center p-8 border-2 border-dashed border-zinc-800 rounded-lg text-zinc-600 text-sm">
                                    Nenhum prêmio adicionado.<br/>O usuário sempre perderá (100% Fantasma).
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* SALVAR */}
            <div className="mt-8 flex justify-end">
                <button onClick={handleSave} disabled={loading || totalChance > 100} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-12 rounded-xl text-lg shadow-xl shadow-green-900/20 flex items-center gap-2 transition-transform active:scale-95">
                    {loading ? <Loader2 className="animate-spin" /> : <Save />}
                    {gameId ? 'SALVAR ALTERAÇÕES' : 'CRIAR RASPADINHA'}
                </button>
            </div>

        </div>
    </div>
  );
}

// Wrapper para Suspense (Necessário no Next.js com useSearchParams)
export default function ManageGame() {
    return (
        <Suspense fallback={<div className="text-white p-10">Carregando...</div>}>
            <GameEditor />
        </Suspense>
    );
}