'use client';

import { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Save, Layout, UploadCloud, Image as ImageIcon, Loader2, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminLayoutConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Estados para armazenar as imagens e cor
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [bgColor, setBgColor] = useState('#ffc700');

  // 1. Carrega as configurações atuais do Banco de Dados
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'config', 'layout');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLogoUrl(data.logo || '');
          setBannerUrl(data.banner || '');
          setBgColor(data.color || '#ffc700');
        }
      } catch (error) {
        console.error("Erro ao buscar configurações", error);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  // --- FUNÇÃO DE UPLOAD (Converte Imagem para Texto/Base64) ---
  const handleFileUpload = (e: any, type: 'logo' | 'banner') => {
    const file = e.target.files[0];
    if (!file) return;

    // Proteção: Limite de 800KB para não travar o banco gratuito
    if (file.size > 800000) { 
        alert("A imagem é muito grande! Use uma imagem menor que 800KB.");
        return;
    }

    const reader = new FileReader();
    
    reader.onloadend = () => {
        const base64String = reader.result as string;
        if (type === 'logo') setLogoUrl(base64String);
        else setBannerUrl(base64String);
    };

    reader.readAsDataURL(file);
  };

  const removeImage = (type: 'logo' | 'banner') => {
    if (type === 'logo') setLogoUrl('');
    else setBannerUrl('');
  };

  // 2. Salva no Banco de Dados
  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', 'layout'), {
        logo: logoUrl,
        banner: bannerUrl,
        color: bgColor
      });
      alert('Configurações salvas com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar. Tente usar imagens mais leves.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white">Carregando...</div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        
        <div className="flex items-center gap-4 mb-8">
            <Link href="/admin" className="bg-zinc-900 p-2 rounded-lg hover:bg-zinc-800 transition-colors">
                <ArrowLeft size={24} />
            </Link>
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Layout className="text-[#ffc700]" /> Identidade Visual
            </h1>
        </div>

        <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-8">
          
          {/* --- UPLOAD DA LOGO --- */}
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-3">Logo do Topo</label>
            <div className="flex items-start gap-4">
                {/* Preview */}
                <div className="w-24 h-24 bg-zinc-950 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center overflow-hidden relative">
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                        <ImageIcon className="text-zinc-600" />
                    )}
                </div>

                {/* Botões */}
                <div className="flex-1 space-y-2">
                    <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-lg border border-zinc-700 flex items-center gap-2 w-fit transition-all">
                        <UploadCloud size={18} />
                        <span>Escolher Logo no PC</span>
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(e, 'logo')}
                        />
                    </label>
                    
                    {logoUrl && (
                        <button onClick={() => removeImage('logo')} className="text-red-500 text-xs flex items-center gap-1 hover:underline">
                            <Trash2 size={12} /> Remover Logo
                        </button>
                    )}
                    <p className="text-xs text-zinc-500">Recomendado: PNG Transparente (fundo transparente).</p>
                </div>
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* --- UPLOAD DO BANNER --- */}
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-3">Banner Principal (Capa)</label>
            
            {/* Preview Grande */}
            <div className="w-full h-40 bg-zinc-950 border-2 border-dashed border-zinc-700 rounded-xl mb-3 flex items-center justify-center overflow-hidden relative group">
                {bannerUrl ? (
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                    <div className="text-zinc-600 flex flex-col items-center">
                        <ImageIcon size={32} />
                        <span className="text-xs mt-1">Nenhum banner selecionado</span>
                    </div>
                )}
            </div>

            <div className="flex gap-2">
                <label className="cursor-pointer bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-lg border border-zinc-700 flex items-center justify-center gap-2 w-full transition-all border-dashed">
                    <UploadCloud size={20} />
                    <span>Carregar Banner do PC</span>
                    <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => handleFileUpload(e, 'banner')}
                    />
                </label>
                {bannerUrl && (
                    <button onClick={() => removeImage('banner')} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-3 rounded-lg border border-red-500/30">
                        <Trash2 size={20} />
                    </button>
                )}
            </div>
          </div>

          <hr className="border-zinc-800" />

          {/* --- COR DO TEMA --- */}
          <div>
            <label className="block text-sm font-bold text-zinc-400 mb-2">Cor Principal (Destaques)</label>
            <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="h-10 w-14 bg-transparent cursor-pointer rounded overflow-hidden"
                />
                <input 
                  type="text" 
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white uppercase font-mono"
                />
            </div>
          </div>

          {/* --- BOTÃO SALVAR --- */}
          <button 
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#ffc700] hover:bg-yellow-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 mt-4 transition-all shadow-lg shadow-yellow-900/20"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
            {saving ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
          </button>

        </div>
      </div>
    </div>
  );
}