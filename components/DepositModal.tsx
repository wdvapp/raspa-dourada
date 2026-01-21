'use client';

import { useState } from 'react';
import { X, Copy, Check, Loader2, DollarSign, RefreshCw } from 'lucide-react';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  userEmail?: string;
}

export default function DepositModal({ isOpen, onClose, userId, userEmail }: DepositModalProps) {
  const [amount, setAmount] = useState<number | string>('');
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [copyCode, setCopyCode] = useState<string | null>(null);
  const [txid, setTxid] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleDeposit = async () => {
    if (!amount || Number(amount) < 1) { setError('Mínimo de R$ 1,00'); return; }
    setLoading(true); setError('');
    try {
        const response = await fetch('/api/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: Number(amount), userId: userId || 'anonimo', email: userEmail || 'sem_email' }) 
        });
        const data = await response.json();
        if (response.ok) {
            setQrCode(data.qrcode_image);
            setCopyCode(data.qrcode_text);
            setTxid(data.txid);
        } else {
            setError('Erro ao gerar Pix. Tente novamente.');
        }
    } catch (e) { setError('Erro de conexão.'); } finally { setLoading(false); }
  };

  const handleCheckPayment = async () => {
      if (!txid) return;
      setLoading(true);
      setError('');
      try {
          const response = await fetch('/api/check-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ txid })
          });
          
          const data = await response.json();
          
          // --- MUDANÇA AQUI: Alerta o erro técnico na tela ---
          if (!response.ok) {
              alert(`ERRO TÉCNICO PIXUP:\n${JSON.stringify(data, null, 2)}`);
              setError('Erro na consulta. Me mande o print do alerta!');
              return;
          }

          if (data.status === 'PAID') {
              setSuccessMsg('Pagamento confirmado! Atualizando...');
              setTimeout(() => {
                  window.location.reload();
              }, 2000);
          } else {
              setError(`Status atual: ${data.message || 'Pendente'}. Aguarde mais um pouco.`);
          }
      } catch (e: any) {
          alert("ERRO NO SITE: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const copyToClipboard = () => {
    if (copyCode) { navigator.clipboard.writeText(copyCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const handleClose = () => { setQrCode(null); setCopyCode(null); setAmount(''); setError(''); setSuccessMsg(''); onClose(); }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-zinc-800 relative shadow-2xl">
        <button onClick={handleClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-2"><X size={20} /></button>

        <div className="text-center mb-6">
            <h2 className="text-xl font-black text-white italic uppercase flex items-center justify-center gap-2">DEPOSITAR <span className="text-yellow-500">PIX</span></h2>
            {userEmail && <p className="text-xs text-zinc-500 mt-1">{userEmail}</p>}
        </div>

        {!qrCode ? (
            <>
                <p className="text-zinc-400 text-sm mb-4 text-center">Escolha um valor:</p>
                <div className="grid grid-cols-3 gap-3 mb-6">
                    {[10, 20, 30, 50, 100, 200].map((val) => (
                        <button key={val} onClick={() => setAmount(val)} className={`py-3 rounded-xl font-bold text-sm transition-all ${amount === val ? 'bg-yellow-500 text-black shadow-lg scale-105' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}>R$ {val}</button>
                    ))}
                </div>
                <div className="relative mb-6">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Outro valor..." className="w-full bg-black border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-yellow-500 transition-colors" />
                </div>
                {error && <p className="text-red-500 text-xs font-bold text-center mb-4">{error}</p>}
                <button onClick={handleDeposit} disabled={loading} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black py-4 rounded-xl text-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-transform active:scale-95 disabled:opacity-50">
                    {loading ? <Loader2 className="animate-spin" /> : 'GERAR PIX'}
                </button>
            </>
        ) : (
            <div className="flex flex-col items-center animate-in zoom-in duration-300">
                <div className="bg-white p-2 rounded-xl mb-4 shadow-lg"><img src={qrCode} alt="QR Code Pix" className="w-48 h-48" /></div>
                <div className="w-full bg-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2 mb-4">
                    <span className="text-xs text-zinc-400 truncate flex-1 font-mono">{copyCode}</span>
                    <button onClick={copyToClipboard} className="p-2 bg-zinc-700 rounded-lg hover:bg-zinc-600 transition-colors">{copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-white" />}</button>
                </div>
                
                {successMsg ? (
                    <div className="bg-green-500/20 text-green-500 p-3 rounded-xl mb-4 w-full text-center font-bold animate-pulse">{successMsg}</div>
                ) : (
                    <>
                        <p className="text-zinc-400 text-xs mb-2 text-center">Pagou? Clique abaixo para liberar:</p>
                        <button onClick={handleCheckPayment} disabled={loading} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl mb-3 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                            {loading ? <Loader2 className="animate-spin" /> : <><RefreshCw size={18} /> JÁ PAGUEI / ATUALIZAR</>}
                        </button>
                        {error && <p className="text-red-400 text-xs font-bold mb-2 text-center">{error}</p>}
                    </>
                )}

                <button onClick={handleClose} className="text-zinc-500 text-sm hover:text-white underline">Fechar e Aguardar</button>
            </div>
        )}
      </div>
    </div>
  );
}