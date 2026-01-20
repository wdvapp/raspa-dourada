'use client';

import { X, Wallet, LogOut, User as UserIcon } from 'lucide-react';

interface ProfileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  balance: number;
  onLogout: () => void;
}

export default function ProfileSidebar({ isOpen, onClose, user, balance, onLogout }: ProfileSidebarProps) {
  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/60 z-[60] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <div className={`fixed top-0 right-0 h-full w-[85%] max-w-[300px] bg-zinc-900 text-white shadow-2xl z-[70] transform transition-transform duration-300 border-l border-zinc-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="font-bold text-lg">Meu Perfil</h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Info do Usuário */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
               <UserIcon size={24} className="text-zinc-400" />
            </div>
            <div className="overflow-hidden">
              <p className="font-bold text-lg truncate">{user?.displayName || 'Jogador'}</p>
              <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Carteira */}
          <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                <Wallet size={40} />
            </div>
            <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Saldo em Carteira</span>
            <div className="text-3xl font-black text-white mt-1">
              R$ {balance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
            </div>
          </div>

          {/* Menu */}
          <div className="space-y-2">
            <button className="w-full text-left p-3 rounded-xl hover:bg-zinc-800 text-zinc-300 hover:text-white transition flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500"><Wallet size={16}/></span>
                Histórico de Saques
            </button>
            {/* Adicione mais itens aqui se quiser */}
          </div>
        </div>

        {/* Footer / Logout */}
        <div className="absolute bottom-0 w-full p-6 border-t border-zinc-800">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-red-500 hover:text-red-400 font-bold p-3 hover:bg-red-500/10 rounded-xl transition">
            <LogOut size={18} />
            Sair da Conta
          </button>
        </div>
      </div>
    </>
  );
}