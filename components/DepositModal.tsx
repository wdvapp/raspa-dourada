'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Loader2, QrCode, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId: string;
}

export default function DepositModal({ isOpen, onClose, userEmail, userId }: DepositModalProps) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositData, setDepositData] = useState<any>(null);
  const [success, setSuccess] = useState(false);

  // Limpa estados ao fechar
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setAmount('');
      setDepositData(null);
      setLoading(false);
      setSuccess(false);
    }
  }, [isOpen]);

  // --- DETECTOR INTELIGENTE DE PAGAMENTO (CORRIGIDO) ---
  useEffect(() => {
    if (isOpen && step === 2 && (depositData?.txid || depositData?.id)) {
        
        // Se tiver ID do documento direto, usa ele. Se não, usa o ID da transação (txid)
        let q;
        if (depositData.id && depositData.id.length > 15) {
             // Provavelmente é um ID do Firestore
             q = query(collection(db, 'deposits'), where('__name__', '==', depositData.id));
        } else {
             // Busca pelo TXID da API (Mais seguro)
             const identifier = depositData.txid || depositData.id;
             q = query(collection(db, 'deposits'), where('txid', '==', identifier));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'modified' || change.type === 'added') {
                    const data = change.doc.data();
                    const status = data.status?.toLowerCase();
                    
                    // Lista de status de sucesso
                    if (['paid', 'completed', 'approved', 'succeeded', 'pago'].includes(status)) {
                        setSuccess(true);
                        setTimeout(() => {
                            onClose();
                            window.location.reload(); // Atualiza o saldo na tela
                        }, 2500);
                    }
                }
            });
        });
        return () => unsubscribe();
    }
  }, [isOpen, step, depositData, onClose]);

  const handleGeneratePix = async () => {
    if (!amount || Number(amount) < 1) return alert("Valor mínimo R$ 1,00");
    setLoading(true);

    try {
      const response = await fetch('/api/deposit', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(amount), email: userEmail, userId: userId })
      });

      if (!response.ok) throw new Error("Falha na comunicação.");

      const data = await response.json();

      // Normaliza os dados para funcionar com qualquer API
      const qrCodeBase64 = data.qrcode || data.qrcode_image; 
      const copyPasteCode = data.copypaste || data.qrcode_text || data.pixCopiaECola; 
      const txid = data.txid || data.id;

      if (qrCodeBase64 && txid) {
        setDepositData({
            ...data,
            txid: txid,
            qrcode: qrCodeBase64,
            copypaste: copyPasteCode
        });
        setStep(2);
      } else {
        alert('Erro: QR Code não gerado.');
      }
    } catch (error) {
      console.error(error);
      alert('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (depositData?.copypaste) {
      navigator.clipboard.writeText(depositData.copypaste);
      alert('Copiado!');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#09090b] w-full max-w-md rounded-3xl border border-zinc-800 overflow-hidden shadow-2xl relative">
        {!success && (
            <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-zinc-900/50 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors z-10"><X size={20} /></button>
        )}

        {/* TELA DE SUCESSO */}
        {success ? (
            <div className="p-12 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={48} className="text-green-500 animate-bounce" />
                </div>
                <h2 className="text-2xl font-black text-white mb-2">PAGAMENTO APROVADO!</h2>
                <p className="text-zinc-400 text-sm">Seu saldo já foi liberado.</p>
            </div>
        ) : (
            <>
                {step === 1 && (
                  <div className="p-8">
                    <div className="text-center mb-6">
                      <div className="w-16 h-16 bg-[#ffc700]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#ffc700]"><QrCode size={32} /></div>
                      <h2 className="text-2xl font-black text-white">Depositar via Pix</h2>
                      <p className="text-zinc-500 text-sm mt-2">O saldo cai na hora, 24h por dia.</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase ml-1">Valor do Depósito</label>
                        <div className="relative mt-1">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-4 pl-10 pr-4 text-white text-xl font-bold focus:border-[#ffc700] focus:outline-none transition-all" placeholder="0,00" autoFocus />
                        </div>
                      </div>
                      
                      {/* NOVOS BOTÕES DE VALORES */}
                      <div className="grid grid-cols-3 gap-2">
                        {[10, 20, 50, 100, 150, 200].map(val => (
                          <button key={val} onClick={() => setAmount(val.toString())} className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 font-bold py-3 rounded-xl transition-all text-sm hover:text-white hover:border-[#ffc700]/30">
                            R$ {val}
                          </button>
                        ))}
                      </div>

                      <button onClick={handleGeneratePix} disabled={loading || !amount} className="w-full bg-[#ffc700] hover:bg-[#e6b300] disabled:opacity-50 text-black font-black py-4 rounded-xl text-lg shadow-lg flex items-center justify-center gap-2 mt-2 transition-transform active:scale-95">
                        {loading ? <Loader2 className="animate-spin" /> : 'GERAR QR CODE'}
                      </button>
                    </div>
                  </div>
                )}

                {step === 2 && depositData && (
                  <div className="p-8 text-center">
                    <h3 className="text-xl font-bold text-white mb-1">Pagamento Pix</h3>
                    <p className="text-zinc-500 text-xs mb-6">Escaneie ou copie o código abaixo</p>
                    
                    <div className="bg-white p-4 rounded-2xl mx-auto w-64 h-64 mb-6 shadow-xl flex items-center justify-center">
                       {depositData.qrcode ? (
                           depositData.qrcode.startsWith('http') ? <img src={depositData.qrcode} className="w-full h-full object-contain" /> : <img src={`data:image/png;base64,${depositData.qrcode}`} className="w-full h-full object-contain" />
                       ) : <div className="text-black text-sm">QR Indisponível</div>}
                    </div>
                    
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 pl-4 flex items-center gap-2 mb-6">
                        <input readOnly value={depositData.copypaste || ''} className="bg-transparent border-none text-zinc-500 text-xs w-full focus:outline-none truncate" />
                        <button onClick={copyToClipboard} className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-lg transition-colors"><Copy size={16} /></button>
                    </div>
                    
                    <div className="flex flex-col items-center justify-center gap-2 py-4 bg-zinc-900/30 rounded-xl border border-zinc-800 border-dashed animate-pulse">
                        <div className="flex items-center gap-2 text-[#ffc700] font-bold text-sm"><Loader2 className="animate-spin" size={18} /> Aguardando pagamento...</div>
                        <p className="text-[10px] text-zinc-600">Assim que você pagar, essa tela fecha sozinha.</p>
                    </div>
                  </div>
                )}
            </>
        )}
      </div>
    </div>
  );
}