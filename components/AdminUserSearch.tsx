'use client';
import { useState } from 'react';

export default function AdminUserSearch() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 1. Busca o usuário
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query) return;
    setLoading(true);
    const res = await fetch(`/api/admin/search-users?q=${query}`);
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  // 2. Altera o saldo (Chama aquele arquivo update-balance que você JÁ CRIOU)
  const updateBalance = async (userId: string, currentBalance: number, type: 'add' | 'remove') => {
    const amountStr = prompt(type === 'add' ? "Quanto adicionar?" : "Quanto remover?");
    if (!amountStr) return;
    const amount = parseFloat(amountStr.replace(',', '.'));
    
    try {
      const res = await fetch('/api/admin/update-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount, type })
      });
      const data = await res.json();
      
      if (data.success) {
        alert("Saldo atualizado com sucesso!");
        // Atualiza o numero na tela na hora
        setUsers(users.map(u => u.id === userId ? { ...u, balance: data.newBalance } : u));
      } else {
        alert("Erro: " + data.error);
      }
    } catch (error) {
      alert("Erro de conexão");
    }
  };

  return (
    <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 mb-6">
      <h3 className="text-white font-bold mb-4">Buscar Usuário e Alterar Saldo</h3>
      
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input 
          type="text" 
          placeholder="Digite o nome ou email..." 
          className="flex-1 bg-zinc-800 border border-zinc-700 text-white p-2 rounded"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="bg-yellow-500 text-black font-bold px-4 rounded">
          {loading ? '...' : 'Buscar'}
        </button>
      </form>

      <div className="space-y-2">
        {users.map(user => (
          <div key={user.id} className="flex justify-between items-center bg-zinc-950 p-3 rounded border border-zinc-800">
            <div>
              <p className="text-white font-bold">{user.name}</p>
              <p className="text-zinc-500 text-xs">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-yellow-400 font-bold">R$ {user.balance?.toFixed(2) || '0.00'}</span>
              <button onClick={() => updateBalance(user.id, user.balance, 'add')} className="bg-green-600 text-white px-2 py-1 rounded text-xs">+</button>
              <button onClick={() => updateBalance(user.id, user.balance, 'remove')} className="bg-red-600 text-white px-2 py-1 rounded text-xs">-</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}