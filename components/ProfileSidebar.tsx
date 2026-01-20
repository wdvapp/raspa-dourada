'use client';

import { useState } from 'react';
import { X, Wallet, LogOut, User as UserIcon, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import WithdrawModal from './WithdrawModal'; // <--- Importando o modal novo

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  balance: number;
  onLogout: () => void;
}

export default function ProfileSidebar({ isOpen, onClose, user, balance, onLogout }: ProfileSidebarProps) {
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      <div className={`fixed top-0 right-0 h-full w-[85%] max-w-[320px] bg-zinc-900 text-white shadow-2xl z-[70] transform transition-transform duration-300 border-l border-zinc-800 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header Sidebar */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="font-bold text-lg">Meu Perfil</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {/* Info Usuário */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700 shrink-0">
               <UserIcon size={24} className="text-zinc-400" />
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-lg truncate">{user?.displayName || 'Jogador'}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Carteira */}
          <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
                <Wallet size={60} />
            </div>
            <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Saldo Disponível</span>
            <div className="text-3xl font-black text-white mt-2 mb-6">
              R$ {balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </div>

            {/* Ações da Carteira */}
            <div className="grid grid-cols-2 gap-3">
                {/* Botão Depositar (apenas fecha sidebar para user clicar no + da home se quiser, ou abre modal direto se preferir lógica extra) */}
                <button onClick={onClose} className="bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors">
                    <ArrowUpRight size={16} className="text-green-500"/> Depositar
                </button>

                {/* BOTÃO SACAR */}
                <button 
                  onClick={() => setIsWithdrawOpen(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                    <ArrowDownLeft size={16} className="text-yellow-500"/> Sacar
                </button>
            </div>
          </div>

          {/* Menu */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-zinc-500 uppercase px-3 mb-2">Conta</p>
            <button className="w-full text-left p-3 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-3 font-medium">
                Histórico de Jogos
            </button>
            <button className="w-full text-left p-3 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-3 font-medium">
                Histórico de Transações
            </button>
          </div>
        </div>

        {/* Footer Logout */}
        <div className="p-6 border-t border-zinc-800">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 font-bold p-3 hover:bg-red-500/10 rounded-xl transition">
            <LogOut size={18} />
            Sair da Conta
          </button>
        </div>
      </div>

      {/* O Modal de Saque fica aqui, escondido até ser chamado */}
      <WithdrawModal 
        isOpen={isWithdrawOpen} 
        onClose={() => setIsWithdrawOpen(false)}
        userId={user?.uid}
        userBalance={balance}
      />
    </>
  );
}