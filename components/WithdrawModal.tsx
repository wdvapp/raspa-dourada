'use client';

import { useState } from 'react';
import { X, ArrowDownCircle, Loader2, CheckCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, increment, serverTimestamp } from 'firebase/firestore';

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userBalance: number;
}

export default function WithdrawModal({ isOpen, onClose, userId, userBalance }: WithdrawModalProps) {
  const [amount, setAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixType, setPixType] = useState('CPF');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const value = parseFloat(amount.replace(',', '.'));

    // Validações
    if (isNaN(value) || value <= 0) return setError('Digite um valor válido.');
    if (value > userBalance) return setError('Saldo insuficiente.');
    if (value < 10) return setError('O saque mínimo é de R$ 10,00.'); // Regra opcional
    if (!pixKey) return setError('Digite sua chave PIX.');

    setLoading(true);

    try {
      // 1. Cria o pedido de saque na coleção 'withdrawals'
      await addDoc(collection(db, 'withdrawals'), {
        userId,
        amount: value,
        pixKey,
        pixType,
        status: 'PENDING', // Pendente de aprovação
        createdAt: serverTimestamp()
      });

      // 2. Desconta o saldo do usuário IMEDIATAMENTE para ele não pedir 2x
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        balance: increment(-value)
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setAmount('');
        setPixKey('');
        onClose();
      }, 3000);

    } catch (err) {
      console.error(err);
      setError('Erro ao processar saque. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl p-6 relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
          <X size={24} />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-yellow-500/10 rounded-full flex items-center justify-center mb-3 text-yellow-500">
            <ArrowDownCircle size={32} />
          </div>
          <h2 className="text-2xl font-black text-white uppercase italic">Solicitar Saque</h2>
          <p className="text-zinc-400 text-sm">Receba via PIX na sua conta</p>
        </div>

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6 text-center animate-in zoom-in">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-3" />
            <h3 className="text-white font-bold text-lg">Solicitação Enviada!</h3>
            <p className="text-zinc-400 text-sm mt-1">Seu saque está em processamento e cairá na sua conta em breve.</p>
          </div>
        ) : (
          <form onSubmit={handleWithdraw} className="flex flex-col gap-4">
            
            <div className="bg-black/40 p-4 rounded-xl border border-zinc-800">
              <span className="text-xs text-zinc-500 font-bold uppercase">Saldo Disponível</span>
              <div className="text-xl font-bold text-white">R$ {userBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 font-bold ml-1">Valor do Saque (R$)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="0,00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:border-yellow-500 outline-none font-bold text-lg placeholder:text-zinc-700"
              />
            </div>

            <div className="flex gap-2">
               <select 
                 value={pixType} 
                 onChange={(e) => setPixType(e.target.value)}
                 className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white outline-none text-sm font-bold"
               >
                 <option value="CPF">CPF</option>
                 <option value="EMAIL">E-mail</option>
                 <option value="PHONE">Celular</option>
                 <option value="RANDOM">Aleatória</option>
               </select>
               <input 
                type="text" 
                placeholder="Chave PIX" 
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:border-yellow-500 outline-none font-bold"
              />
            </div>

            {error && <p className="text-red-500 text-sm font-bold text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{error}</p>}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-4 rounded-xl mt-2 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'SOLICITAR SAQUE'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}