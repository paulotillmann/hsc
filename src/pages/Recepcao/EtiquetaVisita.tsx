import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, Heart } from 'lucide-react';

export default function EtiquetaVisita() {
  const { id } = useParams();
  const [visita, setVisita] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('visitas')
          .select('*, visitante:visitante_id(nome)')
          .eq('id', id)
          .single();

        if (error) throw error;
        setVisita(data);

      } catch (err: any) {
        console.error(err);
        setError('Erro ao carregar os dados da etiqueta.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !visita) {
    return (
      <div className="flex items-center justify-center min-h-screen text-destructive">
        {error || 'Visita não encontrada.'}
      </div>
    );
  }

  const visitanteNome = visita.visitante?.nome || 'NOME INDISPONÍVEL';
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=170x170&data=${visita.qrcode || 'N/A'}`;
  const dataEntrada = visita.data_hora_entrada 
    ? new Date(visita.data_hora_entrada).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) 
    : '';

  return (
    <div className="bg-slate-100 min-h-screen w-full p-8 print:p-0 print:bg-transparent print:block print:min-h-0">
      <style>
        {`
          @media print {
            @page {
              margin: 0mm; /* Força ocultação de cabeçalho e rodapé padrão do navegador */
              size: 62mm 100mm; 
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: 100% !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .no-print {
              display: none !important;
            }
            .etiqueta-container {
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              padding: 4mm !important;
              width: 62mm !important;
              height: 100mm !important;
              page-break-after: avoid;
            }
          }
        `}
      </style>

      {/* Botões de Ação (Não Impressos) */}
      <div className="no-print flex gap-3 mb-8">
        <button 
          onClick={() => window.close()} 
          className="px-4 py-2 bg-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-300 transition-colors"
        >
          Fechar
        </button>
        <button 
          onClick={() => window.print()} 
          className="px-4 py-2 bg-emerald-600 text-white rounded-md text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Imprimir
        </button>
      </div>

      {/* Container da Etiqueta */}
      <div className="etiqueta-container w-[62mm] min-h-[100mm] bg-white border border-gray-300 shadow-md p-4 flex flex-col font-sans text-slate-800">
        
        {/* Cabeçalho */}
        <div className="uppercase font-bold tracking-wider text-[11px] mb-1 text-slate-700">
          {visita.identificado_como || 'VISITANTE'}
        </div>
        
        {/* Nome do Visitante */}
        <div className="uppercase font-black text-[22px] leading-tight mb-4 break-words">
          {visitanteNome}
        </div>

        {/* Dados do Paciente */}
        <div className="mb-4">
          <div className="text-[13px] text-slate-600">Paciente:</div>
          <div className="font-bold text-[18px] leading-tight">
            {visita.paciente}
          </div>
        </div>

        {/* Localização e Data */}
        <div className="mb-auto">
          <div className="text-[13px] text-slate-600">Entrada:</div>
          <div className="font-bold text-[18px] mb-2">
            {dataEntrada}
          </div>
          <div className="font-bold text-[18px] uppercase">
            {visita.clinica || 'N/A'}
          </div>
          <div className="text-[18px]">
            Leito: <span className="font-bold uppercase">{visita.leito || 'N/A'}</span>
          </div>
        </div>

        {/* Rodapé: Ícone e QRCode */}
        <div className="flex items-end justify-between mt-4">
          <div className="flex-shrink-0">
            <img src="/logo_hsc_mini.png" alt="HSC" className="w-[84px] h-[84px] object-contain grayscale" />
          </div>
          <div className="flex-shrink-0">
            <img src={qrCodeUrl} alt="QR Code" className="w-[84px] h-[84px]" />
          </div>
        </div>

      </div>
    </div>
  );
}
