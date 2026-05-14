import React, { useState } from 'react';
import { senhaService, Senha } from '../../services/senhaService';
import { Printer, User, Star, LogOut, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

const Totem: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [logoutPassword, setLogoutPassword] = useState('');
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const { user, signIn, signOut } = useAuth();

  const handleLogout = async () => {
    if (!logoutPassword) return;
    setIsLoggingOut(true);
    setLogoutError('');
    
    // Verifica a senha tentando autenticar o usuário atual novamente
    if (user && user.email) {
      const { error } = await signIn(user.email, logoutPassword);
      if (error) {
        setLogoutError('Senha incorreta.');
        setIsLoggingOut(false);
        return;
      }
    }
    
    await signOut();
    setIsLoggingOut(false);
  };

  const emitir = async (tipo: 'normal' | 'preferencial') => {
    if (isPrinting) return;
    try {
      setLoading(true);
      setIsPrinting(true);
      const senha = await senhaService.emitirSenha(tipo);
      imprimirSenha(senha);
      
      // Mantém a tela de carregamento pelo tempo aproximado da impressão
      setTimeout(() => {
        setIsPrinting(false);
      }, 3500);

    } catch (error) {
      console.error('Erro ao emitir senha:', error);
      alert('Erro ao emitir senha. Tente novamente.');
      setIsPrinting(false);
    } finally {
      setLoading(false);
    }
  };

  const imprimirSenha = (senha: Senha) => {
    // Verifica se está rodando dentro do App Android Nativo (TotemApp WebView)
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PRINT_TICKET',
        senha: senha
      }));
      return; // Sai da função para não abrir o iframe
    }

    // Fallback: Modo navegador normal (Cria iframe invisível para impressão)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <html>
          <head>
            <style>
              @page { margin: 0; size: 80mm 120mm; }
              body {
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 10px;
                margin: 0;
                width: 100%;
              }
              h1 { font-size: 24px; margin-bottom: 5px; }
              h2 { font-size: 64px; margin: 15px 0; font-weight: 900; }
              p { font-size: 16px; margin: 5px 0; }
              .data { font-size: 14px; margin-top: 15px; color: #333; }
            </style>
          </head>
          <body>
            <h1>${senha.tipo === 'preferencial' ? 'Atendimento Preferencial' : 'Atendimento Normal'}</h1>
            <h2>${senha.codigo}</h2>
            <p>Aguarde ser chamado(a)</p>
            <div class="data">${new Date(senha.created_at).toLocaleString('pt-BR')}</div>
          </body>
        </html>
      `);
      doc.close();

      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();

      // Remove the iframe after a delay to ensure printing triggered
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 5000);
    }
  };



  return (
    <div className="dark flex flex-col min-h-screen bg-[#020617]">
      <div className="bg-[#020617] border-b border-white/5 shadow-sm z-10">
        <div className="relative text-center py-12 max-w-7xl mx-auto w-full px-8">
          <button 
            onClick={() => setIsLogoutModalOpen(true)}
            className="absolute top-1/2 -translate-y-1/2 right-8 p-4 text-slate-500 hover:text-red-400 transition-all opacity-30 hover:opacity-100 rounded-full hover:bg-white/5 focus:outline-none"
            title="Sair do Totem"
          >
            <LogOut size={48} />
          </button>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">Retire sua Senha</h1>
          <p className="text-2xl md:text-3xl text-slate-400 mt-4">Toque na opção desejada para atendimento</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-8 p-8 max-w-7xl mx-auto w-full">
        <button 
          onClick={() => emitir('normal')}
          disabled={loading}
          className="flex-1 flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-[#8b1c1c] to-[#7c1c1c] hover:from-[#7c1c1c] hover:to-[#6b1818] active:scale-95 text-white rounded-[3rem] shadow-2xl transition-all duration-200 border-4 border-[#7c1c1c]/30"
        >
          <User size={160} strokeWidth={1.5} className="opacity-90" />
          <span className="text-6xl font-black tracking-wide">NORMAL</span>
        </button>

        <button 
          onClick={() => emitir('preferencial')}
          disabled={loading}
          className="flex-1 flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 active:scale-95 text-white rounded-[3rem] shadow-2xl transition-all duration-200 border-4 border-amber-300/30"
        >
          <Star size={160} strokeWidth={1.5} className="opacity-90" />
          <div className="flex flex-col items-center px-4 text-center">
            <span className="text-6xl font-black tracking-wide leading-tight">PREFERENCIAL</span>
            <span className="text-3xl font-medium mt-6 opacity-90">Idosos, Gestantes e PCD</span>
          </div>
        </button>
      </div>

      {/* Modal de Logoff */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-white/10 rounded-3xl p-10 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                <KeyRound size={40} className="text-red-500" />
              </div>
            </div>
            
            <h2 className="text-3xl font-bold text-white text-center mb-3">Sair do Totem</h2>
            <p className="text-slate-400 text-center mb-8 text-lg">Digite a senha deste usuário para confirmar o logoff e fechar o modo totem.</p>
            
            <div className="space-y-6">
              <div>
                <input
                  type="password"
                  value={logoutPassword}
                  onChange={(e) => setLogoutPassword(e.target.value)}
                  placeholder="Senha de acesso"
                  className="w-full bg-[#1e293b] border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all text-xl text-center tracking-widest font-mono"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleLogout()}
                />
                {logoutError && (
                  <p className="text-red-400 text-base mt-3 font-medium text-center bg-red-500/10 py-2 rounded-lg">{logoutError}</p>
                )}
              </div>
              
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => {
                    setIsLogoutModalOpen(false);
                    setLogoutPassword('');
                    setLogoutError('');
                  }}
                  className="flex-1 px-4 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-colors text-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut || !logoutPassword}
                  className="flex-1 px-4 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-lg"
                >
                  {isLoggingOut ? 'Saindo...' : 'Confirmar Saída'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal / Overlay de Impressão */}
      {isPrinting && (
        <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center mb-8 border border-white/20">
            <Printer size={64} className="text-white animate-bounce" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-white text-center tracking-tight mb-6">
            Imprimindo sua Senha...
          </h2>
          <p className="text-2xl text-slate-400 text-center animate-pulse">
            Por favor, aguarde e retire o papel logo abaixo.
          </p>
        </div>
      )}
    </div>
  );
};

export default Totem;
