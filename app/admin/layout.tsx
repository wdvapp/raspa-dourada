'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Trophy, Gift, Menu, X, LogOut, PiggyBank } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Gerenciar Saques', href: '/admin/saques', icon: PiggyBank },
    { name: 'Raspadinhas', href: '/admin/game', icon: Trophy },
    // { name: 'Usuários', href: '/admin/users', icon: Users }, // Descomente se criar a pg de usuários
    { name: 'Configurar Bônus', href: '/admin/bonus', icon: Gift },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row font-sans">
      
      {/* --- HEADER MOBILE (SÓ APARECE NO CELULAR) --- */}
      <div className="md:hidden bg-zinc-900 p-4 flex items-center justify-between border-b border-zinc-800 sticky top-0 z-50">
        <span className="font-black text-[#ffc700] text-xl tracking-tighter italic">RASPA DOURADA</span>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white p-2 focus:outline-none">
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* --- SIDEBAR (MENU LATERAL) --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-zinc-900 border-r border-zinc-800 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:h-screen
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex flex-col h-full">
          {/* Logo Desktop */}
          <div className="hidden md:block mb-10">
            <span className="font-black text-2xl tracking-tighter italic text-white">RASPA<span className="text-[#ffc700]">DOURADA</span></span>
            <span className="block text-xs text-zinc-500 font-bold uppercase mt-1 tracking-widest">Painel Admin</span>
          </div>

          {/* Links de Navegação */}
          <nav className="flex-1 space-y-2">
            {menuItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  onClick={() => setIsSidebarOpen(false)} // Fecha menu ao clicar no mobile
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${isActive ? 'bg-[#ffc700] text-black shadow-lg shadow-yellow-900/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
                >
                  <item.icon size={20} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Botão Sair (Decorativo por enquanto) */}
          <Link href="/" className="flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-900/10 rounded-xl font-bold transition-all mt-auto">
            <LogOut size={20} /> Sair
          </Link>
        </div>
      </aside>

      {/* --- CONTEÚDO DA PÁGINA (Dashboard, Bonus, etc) --- */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-zinc-950 h-[calc(100vh-64px)] md:h-screen scrollbar-thin scrollbar-thumb-zinc-800">
        {children}
      </main>

      {/* Fundo escuro ao abrir menu no mobile */}
      {isSidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}
    </div>
  );
}