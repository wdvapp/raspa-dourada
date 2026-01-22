'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { Save, ArrowLeft, UploadCloud, Plus, Trash2, Image as ImageIcon, AlertTriangle, Loader2 } from 'lucide-react';

// --- FUNÇÃO AUXILIAR DE COMPRESSÃO ---
// Isso resolve o problema do "Maximum size exceeded" do Firestore
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800; // Reduz para largura max de 800px
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;

                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Converte para JPEG com 70% de qualidade (ficará bem leve)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

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

  // --- UPLOAD DE IMAGEM COM COMPRESSÃO ---
  const handleImageUpload = async (e: any, setFunc: any) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // Usa a compressão antes de salvar
        const compressedBase64 = await compressImage(file);
        setFunc(compressedBase64);
    } catch (error) {
        alert("Erro ao processar imagem. Tente outra.");
    }
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

  const updatePrizeImage = async (index: number, e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const compressedBase64 = await compressImage(file);
        const newPrizes = [...prizes];
        newPrizes[index].image = compressedBase64;
        setPrizes(newPrizes);
    } catch (error) {
        alert("Erro ao processar imagem do prêmio.");
    }
  };

  const removePrize = (index: number) => {
    const newPrizes = prizes.filter((_, i) => i !== index);
    setPrizes(newPrizes);
  };

  // --- CÁLCULOS ---
  // Fix: Number() garante que não some strings
  const totalChance = prizes.reduce((acc, curr) => acc + (Number(curr.chance) || 0), 0);
  // Fix: toFixed(2) para evitar números quebrados como 30.000000004
  const displayTotal = Number(totalChance.toFixed(2));
  const ghostChance = Number((100 - displayTotal).toFixed(2));

  // --- SALVAR ---
  const handleSave = async () => {
    if (!name || !price) return alert("Preencha o nome e o preço.");
    if (displayTotal > 100) return alert("A soma das chances não pode passar de 100%!");

    setLoading(true);
    const gameData = {
        name,
        price,
        cover, // Agora é uma string pequena comprimida
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
    } catch (error: any) {
        console.error(error);
        if (error.code === 'resource-exhausted' || error.message.includes('size')) {
             alert("O documento ainda está muito grande. Tente usar menos prêmios ou imagens mais simples.");
        } else {
             alert("Erro ao salvar.");
        }
    } finally {
        setLoading(false);
    }
  };

  if (initialLoad) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Carregando editor...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-12">
        <div className="max-w-4xl mx-auto">
            
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.back()} className="bg-zinc-900 p-2 rounded-lg hover:bg-zinc-800"><ArrowLeft size={24}/></button>
                <h1 className="text-2xl md:text-3xl font-bold text-white">{gameId ? 'Editar Raspadinha' : 'Criar Nova Raspadinha'}</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* COLUNA DA ESQUERDA: CONFIGURAÇÃO VISUAL (PAI) */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                        <h3 className="font-bold text-[#ffc700] mb-4 text-sm uppercase tracking-wider">1. Configuração Geral</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase">Nome do Jogo</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Raspa iPhone" className="w-full bg-zinc-950 border border-zinc-700 rounded p-3 text-white mt-1 text-sm focus:border-[#ffc700] focus:outline-none transition-colors" />
                            </div>
                            
                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase">Preço para Jogar (R$)</label>
                                <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="1.00" className="w-full bg-zinc-950 border border-zinc-700 rounded p-3 text-white mt-1 text-sm focus:border-[#ffc700] focus:outline-none transition-colors" />
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 font-bold uppercase mb-2 block">Capa do Card (Home)</label>
                                <label className="w-full h-40 bg-zinc-950 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden relative group hover:border-[#ffc700] transition-colors">
                                    {cover ? <img src={cover} className="w-full h-full object-cover" /> : <div className="text-center text-zinc-600"><UploadCloud className="mx-auto mb-1"/><span className="text-[10px]">Toque para enviar</span></div>}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, setCover)} />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLUNA DA DIREITA: PRÊMIOS (FILHOS) */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-[#ffc700] text-sm uppercase tracking-wider">2. Prêmios & Chances</h3>
                            <button onClick={addPrize} className="bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold py-2 px-4 rounded-lg flex items-center gap-2 border border-zinc-700 transition-colors"><Plus size={16} /> ADICIONAR</button>
                        </div>

                        {/* BARRA DE DISTRIBUIÇÃO */}
                        <div className="mb-6 bg-zinc-950 p-4 rounded-xl border border-zinc-800 shadow-inner">
                            <div className="flex flex-col md:flex-row md:justify-between text-xs font-bold mb-3 gap-2">
                                <span className="text-green-500 flex items-center gap-1">GANHAR: {displayTotal}%</span>
                                <span className="text-zinc-500 flex items-center gap-1">PERDER (FANTASMA): {ghostChance}%</span>
                            </div>
                            <div className="w-full h-4 bg-zinc-800 rounded-full overflow-hidden flex shadow-sm">
                                <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${displayTotal}%` }}></div>
                                <div className="h-full bg-zinc-700 repeating-linear-gradient" style={{ width: `${ghostChance}%` }}></div>
                            </div>
                            {displayTotal > 100 && <p className="text-red-500 text-xs mt-2 font-bold flex items-center gap-1 bg-red-500/10 p-2 rounded"><AlertTriangle size={14}/> Reduza as chances! Total passou de 100%.</p>}
                        </div>

                        {/* LISTA DE PRÊMIOS */}
                        <div className="space-y-4">
                            {prizes.map((prize, index) => (
                                <div key={index} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex flex-col sm:flex-row gap-4 items-start animate-in fade-in slide-in-from-bottom-2">
                                    
                                    {/* Upload Imagem do Prêmio */}
                                    <div className="flex flex-row sm:flex-col gap-4 items-center sm:items-start w-full sm:w-auto">
                                        <label className="w-16 h-16 bg-zinc-900 border border-zinc-700 rounded-lg flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden relative hover:border-[#ffc700] transition-colors">
                                            {prize.image ? <img src={prize.image} className="w-full h-full object-contain" /> : <ImageIcon size={20} className="text-zinc-600"/>}
                                            <input type="file" className="hidden" onChange={(e) => updatePrizeImage(index, e)} />
                                        </label>
                                        <button onClick={() => removePrize(index)} className="text-zinc-500 hover:text-red-500 transition-colors p-2 sm:hidden ml-auto"><Trash2 size={20} /></button>
                                    </div>

                                    <div className="flex-1 w-full grid grid-cols-12 gap-3">
                                        
                                        {/* Nome */}
                                        <div className="col-span-8 sm:col-span-5">
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Nome</label>
                                            <input type="text" value={prize.name} onChange={e => updatePrize(index, 'name', e.target.value)} placeholder="Ex: iPhone" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-[#ffc700] focus:outline-none" />
                                        </div>
                                        
                                        {/* Valor */}
                                        <div className="col-span-4 sm:col-span-3">
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Valor (R$)</label>
                                            <input type="number" value={prize.value} onChange={e => updatePrize(index, 'value', e.target.value)} placeholder="0.00" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-[#ffc700] focus:outline-none" />
                                        </div>

                                        {/* Chance - NOVA VERSÃO HÍBRIDA (Slider + Input) */}
                                        <div className="col-span-12 sm:col-span-4">
                                            <label className="text-[10px] text-zinc-500 font-bold uppercase block mb-1">Chance (%)</label>
                                            <div className="flex items-center gap-3">
                                                {/* Barrinha para ajuste grosso */}
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="100" 
                                                    step="0.01"
                                                    value={prize.chance} 
                                                    onChange={e => updatePrize(index, 'chance', e.target.value)} 
                                                    className="flex-1 accent-green-500 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer" 
                                                />
                                                {/* Input Numérico para ajuste fino */}
                                                <div className="relative w-20">
                                                    <input 
                                                        type="number" 
                                                        min="0" 
                                                        max="100" 
                                                        step="0.01" // Permite 0.01
                                                        value={prize.chance} 
                                                        onChange={e => updatePrize(index, 'chance', e.target.value)}
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white text-right font-mono focus:border-[#ffc700] focus:outline-none"
                                                    />
                                                    <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 pointer-events-none">%</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Botão de Lixo (Desktop) */}
                                    <button onClick={() => removePrize(index)} className="text-zinc-600 hover:text-red-500 transition-colors p-2 hidden sm:block mt-6"><Trash2 size={18} /></button>
                                </div>
                            ))}
                            
                            {prizes.length === 0 && (
                                <div className="text-center p-10 border-2 border-dashed border-zinc-800 rounded-xl text-zinc-600 text-sm flex flex-col items-center gap-2">
                                    <AlertTriangle size={24} className="opacity-50"/>
                                    <p>Nenhum prêmio adicionado.<br/>O usuário sempre perderá (100% de lucro).</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* SALVAR */}
            <div className="mt-8 flex justify-end pb-10">
                <button onClick={handleSave} disabled={loading || displayTotal > 100} className="w-full sm:w-auto bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 px-12 rounded-xl text-lg shadow-xl shadow-green-900/20 flex items-center justify-center gap-3 transition-transform active:scale-95">
                    {loading ? <Loader2 className="animate-spin" /> : <Save />}
                    {gameId ? 'SALVAR ALTERAÇÕES' : 'CRIAR RASPADINHA'}
                </button>
            </div>

        </div>
    </div>
  );
}

// Wrapper para Suspense
export default function ManageGame() {
    return (
        <Suspense fallback={<div className="text-white p-10">Carregando...</div>}>
            <GameEditor />
        </Suspense>
    );
}