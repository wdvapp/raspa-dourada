'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, increment } from 'firebase/firestore';
import { Megaphone, Copy, Trash2, Plus, BarChart3, Save } from 'lucide-react';

export default function MarketingPage() {
  const [links, setLinks] = useState<any[]>([]);
  const [newInfluencer, setNewInfluencer] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [loading, setLoading] = useState(true);

  // Carrega links existentes
  useEffect(() => {
    const fetchLinks = async () => {
      const snap = await getDocs(collection(db, 'marketing_links'));
      setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    };
    fetchLinks();
  }, []);

  // Cria novo link de influenciador
  const handleCreate = async () => {
    if (!newInfluencer || !newSlug) return alert('Preencha os campos!');
    
    const cleanSlug = newSlug.toLowerCase().replace(/ /g, '-');
    
    const docRef = await addDoc(collection(db, 'marketing_links'), {
        name: newInfluencer,
        slug: cleanSlug,
        clicks: 0,
        signups: 0,
        createdAt: Date.now()
    });

    setLinks([...links, { id: docRef.id, name: newInfluencer, slug: cleanSlug, clicks: 0, signups: 0 }]);
    setNewInfluencer('');
    setNewSlug('');
  };

  const handleDelete = async (id: string) => {
    if(confirm('Deletar este link?')) {
        await deleteDoc(doc(db, 'marketing_links', id));
        setLinks(links.filter(l => l.id !== id));
    }
  }

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/?ref=${slug}`;
    navigator.clipboard.writeText(url);
    alert('Link copiado: ' + url);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
        <h1 className="text-3xl font-black mb-2 flex items-center gap-2">
            <Megaphone className="text-[#ffc700]"/> Modo Influenciador
        </h1>
        <p className="text-zinc-500 mb-8">Crie links de rastreio para seus parceiros e divulgações.</p>

        {/* CRIAR NOVO */}
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 mb-8 flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
                <label className="text-xs font-bold text-zinc-400 uppercase">Nome do Influenciador</label>
                <input 
                    value={newInfluencer} 
                    onChange={e => setNewInfluencer(e.target.value)}
                    placeholder="Ex: Felipe Neto" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white mt-1"
                />
            </div>
            <div className="flex-1 w-full">
                <label className="text-xs font-bold text-zinc-400 uppercase">Código do Link (Slug)</label>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-zinc-500 text-sm">site.com/?ref=</span>
                    <input 
                        value={newSlug} 
                        onChange={e => setNewSlug(e.target.value)}
                        placeholder="felipe" 
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-[#ffc700] font-bold"
                    />
                </div>
            </div>
            <button onClick={handleCreate} className="bg-[#ffc700] hover:bg-[#e6b300] text-black font-bold py-3 px-6 rounded-xl flex items-center gap-2">
                <Plus size={20}/> CRIAR
            </button>
        </div>

        {/* LISTA */}
        <div className="grid gap-4">
            {links.map(link => (
                <div key={link.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-lg">{link.name}</h3>
                        <p className="text-xs text-zinc-500 font-mono">ref={link.slug}</p>
                    </div>
                    
                    <div className="flex items-center gap-6">
                        <div className="text-center">
                            <span className="block text-2xl font-black text-white">{link.clicks || 0}</span>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Cliques</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-2xl font-black text-green-500">{link.signups || 0}</span>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Cadastros</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => copyLink(link.slug)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white" title="Copiar Link">
                            <Copy size={18}/>
                        </button>
                        <button onClick={() => handleDelete(link.id)} className="p-2 bg-zinc-800 hover:bg-red-900/50 text-red-500 rounded-lg">
                            <Trash2 size={18}/>
                        </button>
                    </div>
                </div>
            ))}
            {links.length === 0 && !loading && <p className="text-center text-zinc-500 py-10">Nenhum influenciador cadastrado.</p>}
        </div>
    </div>
  );
}