'use client';

import { useState } from 'react';
import { X, Copy, CheckCircle2, Loader2, QrCode, RefreshCw } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
}

export default function DepositModal({ isOpen, onClose, userEmail, userId }: DepositModalProps) {
  const [step, setStep] = useState(1); // 1: Valor, 2: QR Code
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  
  // Dados do Depósito (ID, QR Code, Copia e Cola)
  const [depositData, setDepositData] = useState<any>(null);

  const handleGeneratePix = async () => {
    if (!amount || Number(amount) < 1) return alert("Valor mínimo R$ 1,00");
    setLoading(true);

    try {
      // Chama a API para criar o Pix
      const response = await fetch('/api/pixup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          email: userEmail,
          userId: userId
        })
      });

      const data = await response.json();

      if (data.qrcode && data.id) {
        setDepositData(data);
        setStep(2); // Avança para tela do QR Code
      } else {
        alert('Erro ao gerar Pix. Tente novamente.');
      }

    } catch (error) {
      console.error(error);
      alert('Erro de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPayment = async () => {
    if (!depositData?.id) return;
    setChecking(true);

    try {
      // Verifica no Firebase se o status mudou
      const docRef = doc(db, 'deposits', depositData.id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'completed' || data.status === 'paid') {
            alert("Pagamento confirmado com sucesso!");
            onClose(); // Fecha o modal
            window.location.reload(); // Atualiza para mostrar o saldo
        } else {
            alert("Pagamento ainda não confirmado. Aguarde alguns segundos e tente novamente.");
        }
      }
    } catch (error) {
      console.error("Erro ao verificar:", error);
    } finally {
      setChecking(false);
    }
  };

  const copyToClipboard = () => {
    if (depositData?.copypaste) {
      navigator.clipboard.writeText(depositData.copypaste);
      alert('Código Copia e Cola copiado!');
    }
  };

  const handleClose = () => {
    setStep(1);
    setAmount('');
    setDepositData(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#09090b] w-full max-w-md rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl relative">
        
        {/* Botão Fechar */}
        <button 
          onClick={handleClose} 
          className="absolute top-4 right-4 p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        {/* --- PASSO 1: DIGITAR VALOR --- */}
        {step === 1 && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#ffc700]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#ffc700]">
                 <QrCode size={32} />
              </div>
              <h2 className="text-2xl font-black text-white">Adicionar Saldo</h2>
              <p className="text-zinc-500 text-sm mt-2">Pagamento instantâneo via Pix</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor do Depósito</label>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white text-xl font-bold focus:border-[#ffc700] focus:outline-none transition-all placeholder:text-zinc-700"
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
              </div>

              {/* Botões rápidos */}
              <div className="grid grid-cols-3 gap-2">
                {[20, 50, 100].map(val => (
                  <button 
                    key={val} 
                    onClick={() => setAmount(val.toString())}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold py-2 rounded-lg transition-all text-sm"
                  >
                    R$ {val}
                  </button>
                ))}
              </div>

              <button 
                onClick={handleGeneratePix} 
                disabled={loading || !amount}
                className="w-full bg-[#ffc700] hover:bg-[#e6b300] disabled:opacity-50 text-black font-black py-4 rounded-xl text-lg shadow-lg shadow-yellow-500/10 transition-transform active:scale-95 flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <Loader2 className="animate-spin" /> : 'GERAR QR CODE'}
              </button>
            </div>
          </div>
        )}

        {/* --- PASSO 2: MOSTRAR QR CODE --- */}
        {step === 2 && depositData && (
          <div className="p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-1">Pagamento Gerado</h3>
            <p className="text-zinc-500 text-xs mb-6">Escaneie o QR Code ou copie o código</p>

            {/* Imagem do QR Code */}
            <div className="bg-white p-4 rounded-2xl mx-auto w-64 h-64 mb-6 shadow-xl flex items-center justify-center">
               {depositData.qrcode ? (
                   <img src={`data:image/png;base64,${depositData.qrcode}`} alt="QR Code Pix" className="w-full h-full object-contain" />
               ) : (
                   <div className="text-black text-sm">QR Code indisponível</div>
               )}
            </div>

            {/* Input Copia e Cola */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 pl-4 flex items-center gap-2 mb-6">
                <input 
                    readOnly 
                    value={depositData.copypaste || ''} 
                    className="bg-transparent border-none text-zinc-500 text-xs w-full focus:outline-none truncate"
                />
                <button 
                    onClick={copyToClipboard}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-lg transition-colors"
                    title="Copiar"
                >
                    <Copy size={16} />
                </button>
            </div>

            {/* BOTÃO DE VERIFICAR (O Antigo que funciona) */}
            <button 
                onClick={handleCheckPayment}
                disabled={checking}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl text-sm shadow-lg shadow-green-900/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
            >
                {checking ? <Loader2 className="animate-spin" size={18}/> : <CheckCircle2 size={18} />}
                JÁ PAGUEI / ATUALIZAR
            </button>
            
            <p className="text-[10px] text-zinc-600 mt-3">
                Após pagar, clique no botão acima para liberar seu saldo.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}