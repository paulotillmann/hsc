import React, { useState } from 'react';
import { senhaService, Senha } from '../../services/senhaService';
import { Printer, User, Star } from 'lucide-react';

const Totem: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const emitir = async (tipo: 'normal' | 'preferencial') => {
    try {
      setLoading(true);
      const senha = await senhaService.emitirSenha(tipo);
      imprimirSenha(senha);
    } catch (error) {
      console.error('Erro ao emitir senha:', error);
      alert('Erro ao emitir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const imprimirSenha = (senha: Senha) => {
    // Cria um iframe invisível para impressão térmica (58mm/80mm)
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
      <div className="text-center py-12 bg-[#020617] border-b border-white/5 shadow-sm z-10">
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">Retire sua Senha</h1>
        <p className="text-2xl md:text-3xl text-slate-400 mt-4">Toque na opção desejada para atendimento</p>
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
    </div>
  );
};

export default Totem;
