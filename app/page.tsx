'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Loader2, QrCode } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositData, setDepositData] = useState<{
    txid: string;
    qrcode_text: string;
    qrcode_image?: string;
  } | null>(null);

  // 🔁 RESET TOTAL AO FECHAR (IMPORTANTE)
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setAmount('');
      setDepositData(null);
      setLoading(false);
    }
  }, [isOpen]);

  // 🔔 ESCUTA AUTOMÁTICA DO PAGAMENTO (PIXUP → FIREBASE)
  useEffect(() => {
    if (!isOpen || step !== 2 || !depositData?.txid) return;

    const q = query(
      collection(db, 'deposits'),
      where('txid', '==', depositData.txid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          if (
            data.status === 'paid' ||
            data.status === 'PAID' ||
            data.status === 'completed'
          ) {
            onClose();
          }
        }
      });
    });

    return () => unsubscribe();
  }, [isOpen, step, depositData, onClose]);

  // 🚀 GERAR PIX
  const handleGeneratePix = async () => {
    if (loading) return;

    const value = Number(amount);
    if (!value || value < 1) {
      alert('Valor mínimo R$ 1,00');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/pixup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: value,
          email: userEmail,
          userId,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Erro Pixup:', text);
        throw new Error('Erro na API Pix');
      }

      const data = await response.json();

      // 🔐 CONTRATO ESPERADO DA SUA API
      if (!data.txid || !data.qrcode_text) {
        console.error('Resposta inválida:', data);
        throw new Error('Resposta inválida da API');
      }

      setDepositData({
        txid: data.txid,
        qrcode_text: data.qrcode_text,
        qrcode_image: data.qrcode_image,
      });

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
      <div className="bg-[#09090b] w-full max-w-md rounded-3xl border border-zinc-800 shadow-2xl relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 bg-zinc-900/60 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition"
        >
          <X size={20} />
        </button>

        {/* STEP 1 — VALOR */}
        {step === 1 && (
          <div className="p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#ffc700]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#ffc700]">
                <QrCode size={32} />
              </div>
              <h2 className="text-2xl font-black">Depositar via Pix</h2>
              <p className="text-zinc-500 text-sm mt-2">
                O saldo cai na hora, 24h por dia.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-zinc-500 uppercase ml-1">
                  Valor
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white text-xl font-bold focus:border-[#ffc700] focus:outline-none"
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[20, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setAmount(String(val))}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-2 rounded-lg"
                  >
                    R$ {val}
                  </button>
                ))}
              </div>

              <button
                onClick={handleGeneratePix}
                disabled={loading}
                className="w-full bg-[#ffc700] hover:bg-[#e6b300] disabled:opacity-60 text-black font-black py-4 rounded-xl text-lg shadow-lg flex items-center justify-center gap-2 mt-4"
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  'GERAR QR CODE'
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2 — QR CODE */}
        {step === 2 && depositData && (
          <div className="p-8 text-center">
            <h3 className="text-xl font-bold mb-1">Pagamento Pix</h3>
            <p className="text-zinc-500 text-xs mb-6">
              Escaneie ou copie o código abaixo
            </p>

            <div className="bg-white p-4 rounded-2xl mx-auto w-64 h-64 mb-6 flex items-center justify-center">
              {depositData.qrcode_image ? (
                <img
                  src={depositData.qrcode_image}
                  alt="QR Code Pix"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-black text-xs">
                  QR Code indisponível
                </span>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 pl-4 flex items-center gap-2 mb-6">
              <input
                readOnly
                value={depositData.qrcode_text}
                className="bg-transparent border-none text-zinc-500 text-xs w-full focus:outline-none truncate"
              />
              <button
                onClick={copyToClipboard}
                className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-lg"
              >
                <Copy size={16} />
              </button>
            </div>

            <div className="flex flex-col items-center gap-2 py-4 bg-zinc-900/30 rounded-xl border border-zinc-800 border-dashed animate-pulse">
              <div className="flex items-center gap-2 text-[#ffc700] font-bold text-sm">
                <Loader2 className="animate-spin" size={18} />
                Aguardando confirmação…
              </div>
              <p className="text-[10px] text-zinc-600">
                O pagamento será detectado automaticamente.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
