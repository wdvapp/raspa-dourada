'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Gift, Save, CheckCircle2, AlertTriangle, Percent } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function BonusConfig() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Configuração padrão
  const [config, setConfig] = useState({
    active: true,      // Se o bônus está ligado
    percentage: 200,   // Porcentagem (200%)
    minDeposit: 20     // Depósito mínimo para ganhar bônus (opcional)
  });

  // Carrega a configuração atual do banco
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'bonus'), (docSnap) => {
      if (docSnap.exists()) {
        setConfig(docSnap.data() as any);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Salva a nova configuração
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'bonus'), config);
      alert("Configuração de Bônus atualizada com sucesso! 🚀");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Carregando...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12 font-sans">
      <div className="max-w-2xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="flex items-center gap-4 mb-8">
            <button onClick={() => router.back()} className="bg-zinc-900 p-2 rounded-lg hover:bg-zinc-800"><ArrowLeft size={24}/></button>
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">Configurar Bônus <Gift className="text-[#ffc700]" /></h1>
                <p className="text-zinc-500 text-sm">Defina o bônus de primeiro depósito para novos usuários.</p>
            </div>
        </div>

        {/* Card de Controle */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-xl">
            
            {/* Toggle Ativar/Desativar */}
            <div className="flex items-center justify-between mb-8 pb-8 border-b border-zinc-800">
                <div>
                    <h3 className="font-bold text-lg text-white">Status do Bônus</h3>
                    <p className="text-sm text-zinc-500">Se desativado, o usuário recebe apenas o valor real depositado.</p>
                </div>
                <button 
                    onClick={() => setConfig({...config, active: !config.active})}
                    className={`w-16 h-8 rounded-full p-1 transition-colors ${config.active ? 'bg-green-500' : 'bg-zinc-700'}`}
                >
                    <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${config.active ? 'translate-x-8' : 'translate-x-0'}`}></div>
                </button>
            </div>

            {/* Inputs */}
            <div className={`space-y-6 transition-opacity ${config.active ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                
                {/* Porcentagem */}
                <div>
                    <label className="block text-sm font-bold text-zinc-400 mb-2 uppercase">Porcentagem do Bônus (%)</label>
                    <div className="relative">
                        <input 
                            type="number" 
                            value={config.percentage}
                            onChange={(e) => setConfig({...config, percentage: Number(e.target.value)})}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 pl-12 text-white font-bold text-xl focus:border-[#ffc700] focus:outline-none"
                        />
                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
                    </div>
                    <p className="text-xs text-[#ffc700] mt-2">
                        Exemplo: Se o cliente depositar <b>R$ 50,00</b> com <b>{config.percentage}%</b> de bônus, ele recebe <b>R$ {(50 + (50 * config.percentage / 100)).toFixed(2)}</b> na conta.
                    </p>
                </div>

                {/* Depósito Mínimo (Opcional) */}
                <div>
                    <label className="block text-sm font-bold text-zinc-400 mb-2 uppercase">Depósito Mínimo para ganhar (R$)</label>
                    <input 
                        type="number" 
                        value={config.minDeposit}
                        onChange={(e) => setConfig({...config, minDeposit: Number(e.target.value)})}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white font-bold text-xl focus:border-[#ffc700] focus:outline-none"
                    />
                </div>

            </div>

            {/* Botão Salvar */}
            <button 
                onClick={handleSave} 
                disabled={saving}
                className="w-full mt-8 bg-[#ffc700] hover:bg-[#e6b300] text-black font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-yellow-900/20"
            >
                {saving ? "Salvando..." : <><Save size={20} /> SALVAR ALTERAÇÕES</>}
            </button>

        </div>

      </div>
    </div>
  );
}