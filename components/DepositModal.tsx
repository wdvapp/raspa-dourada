'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Loader2, QrCode } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
}

export default function DepositModal({
  isOpen,
  onClose,
  userEmail,
  userId,
}: DepositModalProps) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositData, setDepositData] = useState<any>(null);

  // Reset ao fechar
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setAmount('');
      setDepositData(null);
      setLoading(false);
    }
  }, [isOpen]);

  // 🔥 ESCUTA SEGURA DO PAGAMENTO (SEM QUERY)
  useEffect(() => {
    if (!depositData?.docId) return;

    const ref = doc(db, 'deposits', depositData.docId);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      if (
        data.status === 'paid' ||
        data.status === 'completed' ||
        data.status === 'PAID'
      ) {
        onClose();
      }
    });

    return () => unsubscribe();
  }, [depositData, onClose]);

  const handleGeneratePix = async () => {
    if (!amount || Number(amount) < 1) {
      alert('Valor mínimo R$ 1,00');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/pixup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          email: userEmail,
          userId,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro na API');
      }

      const data = await response.json();

      /**
       * ⚠️ IMPORTANTE
       * A API deve retornar:
       * - qrcode_text
       * - txid
       * - docId (ID do Firestore)
       */
      if (!data.qrcode_text || !data.docId) {
        throw new Error('Resposta inválida');
      }

      setDepositData(data);
      setStep(2);
    } catch (err) {
      console.error(err);
      alert('Erro de conexão. Verifique o console.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!depositData?.qrcode_text) return;
    navigator.clipboard.writeText(depositData.qrcode_text);
    alert('Código Pix copiado!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#09090b] w-full max-w-md rounded-3xl border border-zinc-800 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white"
        >
          <X size={20} />
        </button>

        {step === 1 && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#ffc700]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#ffc700]">
                <QrCode size={32} />
              </div>
              <h2 className="text-2xl font-black text-white">
                Depositar via Pix
              </h2>
              <p className="text-zinc-500 text-sm mt-2">
                O saldo cai na hora, 24h por dia.
              </p>
            </div>

            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 px-4 text-white text-xl font-bold"
              placeholder="Valor"
            />

            <button
              onClick={handleGeneratePix}
              disabled={loading}
              className="w-full mt-6 bg-[#ffc700] text-black font-black py-4 rounded-xl"
            >
              {loading ? <Loader2 className="animate-spin mx-auto" /> : 'GERAR PIX'}
            </button>
          </div>
        )}

        {step === 2 && depositData && (
          <div className="p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-4">
              Aguardando pagamento
            </h3>

            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
                depositData.qrcode_text
              )}`}
              className="mx-auto mb-4"
            />

            <div className="flex gap-2">
              <input
                readOnly
                value={depositData.qrcode_text}
                className="flex-1 bg-zinc-900 text-xs text-zinc-400 p-2 rounded"
              />
              <button onClick={copyToClipboard}>
                <Copy size={16} />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-center gap-2 text-[#ffc700]">
              <Loader2 className="animate-spin" />
              Aguardando confirmação automática…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
