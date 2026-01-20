'use client';

import { useState } from 'react';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';
import { doc, setDoc, getDoc, getFirestore } from 'firebase/firestore';
import { app } from '../lib/firebase';
import { X, Mail, Lock, User, Loader2, LogIn } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const auth = getAuth(app);
  const db = getFirestore(app);

  // --- LOGIN COM GOOGLE (NOVO) ---
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Verifica se o usuário já existe no banco de dados
      const userDocRef = doc(db, 'users', user.uid);
      const userDocSnap = await getDoc(userDocRef);

      // Se NÃO existir, cria o cadastro dele agora
      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          name: user.displayName || 'Usuário Google', // Pega o nome do Google
          email: user.email,
          balance: 0,
          createdAt: new Date(),
          method: 'google'
        });
      }

      onLoginSuccess(user);
      onClose();

    } catch (err: any) {
      console.error(err);
      setError('Erro ao entrar com Google. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  // -------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let userCredential;

      if (isLogin) {
        // LOGIN EMAIL/SENHA
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        // CADASTRO EMAIL/SENHA
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: name,
          email: email,
          balance: 0,
          createdAt: new Date(),
          method: 'email'
        });
      }

      onLoginSuccess(userCredential.user);
      onClose();

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') setError('E-mail ou senha incorretos.');
      else if (err.code === 'auth/email-already-in-use') setError('E-mail já cadastrado.');
      else if (err.code === 'auth/weak-password') setError('Senha muito fraca.');
      else setError('Erro ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white p-2">
            <X size={20} />
        </button>

        <div className="text-center mb-6">
            <div className="w-14 h-14 bg-yellow-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                <LogIn size={28} className="text-black" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase italic">{isLogin ? 'Entrar' : 'Criar Conta'}</h2>
        </div>

        {/* BOTÃO DO GOOGLE EM DESTAQUE */}
        <button 
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-3 rounded-xl mb-4 flex items-center justify-center gap-3 transition-transform active:scale-95"
        >
          {loading ? <Loader2 className="animate-spin" /> : (
            <>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
              Entrar com Google
            </>
          )}
        </button>

        <div className="relative flex py-2 items-center mb-4">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-600 text-xs font-bold uppercase">Ou use E-mail</span>
            <div className="flex-grow border-t border-zinc-800"></div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {!isLogin && (
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Nome</label>
                    <div className="relative">
                        <User className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required={!isLogin} className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors" placeholder="Seu nome" />
                    </div>
                </div>
            )}

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">E-mail</label>
                <div className="relative">
                    <Mail className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors" placeholder="seu@email.com" />
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Senha</label>
                <div className="relative">
                    <Lock className="absolute left-3 top-3.5 text-zinc-500" size={16} />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-yellow-500 transition-colors" placeholder="••••••••" />
                </div>
            </div>

            {error && <p className="text-red-500 text-xs font-bold text-center bg-red-500/10 py-2 rounded-lg">{error}</p>}

            <button type="submit" disabled={loading} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl mt-2 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Entrar com E-mail' : 'Cadastrar E-mail')}
            </button>
        </form>

        <div className="mt-4 text-center">
            <button onClick={() => setIsLogin(!isLogin)} className="text-zinc-400 text-xs hover:text-white transition-colors">
                {isLogin ? 'Não tem conta? ' : 'Já tem conta? '}
                <span className="text-yellow-500 font-bold underline">{isLogin ? 'Cadastre-se' : 'Entrar'}</span>
            </button>
        </div>
      </div>
    </div>
  );
}