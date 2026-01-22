'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase'; // Ajuste os .. se necessário dependendo da sua pasta
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Trash2, UploadCloud, Plus, Loader2, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Função de compressão (Mesma do editor de jogos)
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
        reader.onerror = (err) => reject(err);
    });
};

export default function BannerManager() {
  const router = useRouter();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Carregar banners existentes
  useEffect(() => {
    loadBanners();
  }, []);

  const loadBanners = async () => {
    const querySnapshot = await getDocs(collection(db, 'winners'));
    const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setBanners(list);
    setLoading(false);
  };

  // Adicionar novo banner
  const handleUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
        const compressedBase64 = await compressImage(file);
        await addDoc(collection(db, 'winners'), {
            image: compressedBase64,
            createdAt: Date.now()
        });
        await loadBanners(); // Recarrega a lista
    } catch (error) {
        alert("Erro ao subir imagem.");
        console.error(error);
    } finally {
        setUploading(false);
    }
  };

  // Deletar banner
  const handleDelete = async (id: string) => {
    if(!confirm("Tem certeza que deseja apagar essa foto?")) return;
    try {
        await deleteDoc(doc(db, 'winners', id));
        setBanners(banners.filter(b => b.id !== id));
    } catch (error) {
        alert("Erro ao deletar.");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12">
        <div className="max-w-4xl mx-auto">
            
            <div className="flex items-center gap-4 mb-8">
                <button onClick={() => router.back()} className="bg-zinc-900 p-2 rounded-lg hover:bg-zinc-800"><ArrowLeft size={24}/></button>
                <div>
                    <h1 className="text-3xl font-bold text-white">Mural de Ganhadores</h1>
                    <p className="text-zinc-500 text-sm">Adicione fotos de clientes ganhando prêmios para aparecer na Home.</p>
                </div>
            </div>

            {/* AREA DE UPLOAD */}
            <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 mb-8">
                <label className={`w-full h-32 border-2 border-dashed border-zinc-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#ffc700] hover:bg-zinc-800/50 transition-all ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {uploading ? (
                        <div className="flex flex-col items-center text-[#ffc700]">
                            <Loader2 className="animate-spin mb-2" size={32} />
                            <span className="text-sm font-bold">Processando e enviando...</span>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center text-zinc-500">
                            <UploadCloud size={32} className="mb-2" />
                            <span className="text-sm font-bold">Toque para adicionar nova foto</span>
                            <span className="text-xs">Recomendado: 800x400 (Formato Banner)</span>
                        </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleUpload} />
                </label>
            </div>

            {/* LISTA DE BANNERS ATIVOS */}
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><ImageIcon size={20}/> Fotos Ativas ({banners.length})</h3>
            
            {loading ? (
                <div className="text-center py-10 text-zinc-500">Carregando galeria...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {banners.map((banner) => (
                        <div key={banner.id} className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-black aspect-[2/1]">
                            <img src={banner.image} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button onClick={() => handleDelete(banner.id)} className="bg-red-600 hover:bg-red-500 text-white p-3 rounded-full shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                                    <Trash2 size={24} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {banners.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-zinc-900/50 rounded-xl text-zinc-600 border border-dashed border-zinc-800">
                            Nenhuma foto adicionada ainda.
                        </div>
                    )}
                </div>
            )}
        </div>
    </div>
  );
}