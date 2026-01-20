'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase'; 
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import Link from 'next/link';
import { Plus, Edit, Trash2, ArrowLeft, Ticket } from 'lucide-react';

export default function GamesList() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'games'));
      const gamesList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setGames(gamesList);
    } catch (error) {
      console.error("Erro ao buscar jogos", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta raspadinha?')) return;
    try {
      await deleteDoc(doc(db, 'games', id));
      fetchGames(); // Recarrega
    } catch (error) {
      alert("Erro ao excluir");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-4">
                <Link href="/admin" className="bg-zinc-900 p-2 rounded-lg hover:bg-zinc-800 transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Ticket className="text-[#ffc700]" /> Seus Jogos
                </h1>
            </div>
            <Link href="/admin/games/manage" className="bg-[#ffc700] hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-yellow-900/20">
                <Plus size={20} /> CRIAR NOVA RASPADINHA
            </Link>
        </div>

        {/* Lista */}
        {loading ? (
            <div className="text-zinc-500">Carregando jogos...</div>
        ) : games.length === 0 ? (
            <div className="bg-zinc-900 p-12 rounded-xl border border-zinc-800 text-center flex flex-col items-center">
                <Ticket size={48} className="text-zinc-700 mb-4" />
                <h3 className="text-xl font-bold text-zinc-400 mb-2">Nenhum jogo criado</h3>
                <p className="text-zinc-600 mb-6">Crie sua primeira raspadinha para começar.</p>
                <Link href="/admin/games/manage" className="text-[#ffc700] hover:underline">Criar agora</Link>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {games.map((game) => (
                    <div key={game.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group hover:border-[#ffc700] transition-colors">
                        
                        {/* Capa do Jogo */}
                        <div className="h-40 bg-zinc-950 relative overflow-hidden flex items-center justify-center">
                            {game.cover ? (
                                <img src={game.cover} alt={game.name} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                            ) : (
                                <Ticket size={40} className="text-zinc-700" />
                            )}
                            <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-bold text-[#ffc700] border border-[#ffc700]/30">
                                Custa: R$ {game.price}
                            </div>
                        </div>

                        {/* Infos */}
                        <div className="p-5">
                            <h3 className="font-bold text-lg text-white mb-1">{game.name}</h3>
                            <p className="text-zinc-500 text-sm mb-4">{game.prizes?.length || 0} prêmios configurados</p>
                            
                            <div className="flex gap-2">
                                <Link href={`/admin/games/manage?id=${game.id}`} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 border border-zinc-700 transition-colors">
                                    <Edit size={16} /> Editar
                                </Link>
                                <button onClick={() => handleDelete(game.id)} className="px-3 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/30 rounded-lg transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}

      </div>
    </div>
  );
}