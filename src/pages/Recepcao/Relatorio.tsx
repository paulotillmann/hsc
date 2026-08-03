import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Calendar,
  Filter,
  FileText,
  Download,
  Loader2,
  RefreshCw,
  Info,
  ChevronLeft,
  ChevronRight,
  User,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  ArrowUpDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface VisitanteInfo {
  nome: string;
  documento: string | null;
  telefone: string | null;
  cidade: string | null;
}

interface VisitaRelatorio {
  id: string;
  paciente: string;
  clinica: string | null;
  leito: string | null;
  apartamento: string | null;
  identificado_como: string;
  parentesco: string | null;
  motivo_acesso_terceiro: string | null;
  setor_acesso_terceiro: string | null;
  data_hora_entrada: string | null;
  data_hora_saida: string | null;
  atendente: string | null;
  id_cracha: number | null;
  visitante: VisitanteInfo | null;
}

export default function Relatorio() {
  // Filtros
  const [pacienteSearch, setPacienteSearch] = useState('');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    // Início do mês atual
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date();
    // Fim do dia de hoje
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [tipoAcesso, setTipoAcesso] = useState('TODOS');
  const [situacao, setSituacao] = useState('TODOS');
  const [ordenarPorData, setOrdenarPorData] = useState<'ASC' | 'DESC'>('ASC');

  // Estados de Dados
  const [visitas, setVisitas] = useState<VisitaRelatorio[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [firstSearchDone, setFirstSearchDone] = useState(false);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // KPIs
  const [kpis, setKpis] = useState({
    totalVisitas: 0,
    pacientesDistintos: 0,
    visitantesUnicos: 0,
    visitasEmAberto: 0
  });

  // Carregar dados iniciais ao montar a tela
  useEffect(() => {
    handleBuscar();
  }, []);

  const handleBuscar = async () => {
    setLoading(true);
    setProgressText('Preparando filtros...');
    setCurrentPage(1);
    setFirstSearchDone(true);

    try {
      // Formatação de fuso horário local das datas do filtro
      const [y1, m1, d1] = dataInicio.split('-').map(Number);
      const startIso = new Date(y1, m1 - 1, d1, 0, 0, 0, 0).toISOString();

      const [y2, m2, d2] = dataFim.split('-').map(Number);
      const endIso = new Date(y2, m2 - 1, d2, 23, 59, 59, 999).toISOString();

      setProgressText('Buscando dados no Supabase...');

      // Construção da Query
      let query = supabase
        .from('visitas')
        .select(`
          id,
          paciente,
          clinica,
          leito,
          apartamento,
          identificado_como,
          parentesco,
          motivo_acesso_terceiro,
          setor_acesso_terceiro,
          data_hora_entrada,
          data_hora_saida,
          atendente,
          id_cracha,
          visitante:visitantes(nome, documento, telefone, cidade)
        `)
        .gte('data_hora_entrada', startIso)
        .lte('data_hora_entrada', endIso)
        .order('data_hora_entrada', { ascending: ordenarPorData === 'ASC' });

      if (pacienteSearch.trim() !== '') {
        query = query.ilike('paciente', `%${pacienteSearch.trim()}%`);
      }

      if (tipoAcesso !== 'TODOS') {
        query = query.ilike('identificado_como', tipoAcesso);
      }

      if (situacao !== 'TODOS') {
        if (situacao === 'ABERTO') {
          query = query.is('data_hora_saida', null);
        } else if (situacao === 'ENCERRADO') {
          query = query.not('data_hora_saida', 'is', null);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      const results = (data || []) as any[];

      // Mapeamento dos resultados
      const mappedVisitas: VisitaRelatorio[] = results.map(item => ({
        id: item.id,
        paciente: item.paciente,
        clinica: item.clinica,
        leito: item.leito,
        apartamento: item.apartamento,
        identificado_como: item.identificado_como,
        parentesco: item.parentesco,
        motivo_acesso_terceiro: item.motivo_acesso_terceiro,
        setor_acesso_terceiro: item.setor_acesso_terceiro,
        data_hora_entrada: item.data_hora_entrada,
        data_hora_saida: item.data_hora_saida,
        atendente: item.atendente,
        id_cracha: item.id_cracha,
        visitante: item.visitante ? {
          nome: item.visitante.nome || 'NÃO INFORMADO',
          documento: item.visitante.documento,
          telefone: item.visitante.telefone,
          cidade: item.visitante.cidade
        } : null
      }));

      setVisitas(mappedVisitas);

      // Cálculo dos KPIs
      const totalVisitas = mappedVisitas.length;
      
      const pacientesSet = new Set(mappedVisitas.map(v => v.paciente.toUpperCase().trim()));
      const pacientesDistintos = pacientesSet.size;

      const visitantesSet = new Set(
        mappedVisitas
          .map(v => v.visitante?.nome?.toUpperCase().trim() || '')
          .filter(n => n !== '')
      );
      const visitantesUnicos = visitantesSet.size;

      const visitasEmAberto = mappedVisitas.filter(v => !v.data_hora_saida).length;

      setKpis({
        totalVisitas,
        pacientesDistintos,
        visitantesUnicos,
        visitasEmAberto
      });

      setProgressText('');
    } catch (err: any) {
      console.error('Erro ao buscar relatório:', err);
      setProgressText(`Erro: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  // Paginação Logic
  const totalPages = Math.max(1, Math.ceil(visitas.length / itemsPerPage));
  const paginatedVisitas = visitas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Formatação de datas
  const formatarDataHora = (isoStr: string | null) => {
    if (!isoStr) return '-';
    try {
      const date = new Date(isoStr);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  };

  const calcularDuracao = (entrada: string | null, saida: string | null) => {
    if (!entrada || !saida) return '-';
    try {
      const t1 = new Date(entrada).getTime();
      const t2 = new Date(saida).getTime();
      const diffMs = t2 - t1;
      if (diffMs < 0) return '-';
      const diffMins = Math.floor(diffMs / 60000);
      const hrs = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      if (hrs > 0) {
        return `${hrs}h ${mins}m`;
      }
      return `${mins} min`;
    } catch (e) {
      return '-';
    }
  };

  // Exportação CSV
  const exportarCSV = () => {
    if (visitas.length === 0) return;
    
    // Cabeçalhos
    const headers = [
      'Paciente',
      'Clinica/Setor',
      'Leito',
      'Visitante/Terceiro',
      'Documento',
      'Telefone',
      'Tipo de Acesso',
      'Parentesco/Motivo',
      'Data Entrada',
      'Data Saida',
      'Duracao',
      'Cracha',
      'Atendente'
    ];

    const rows = visitas.map(v => [
      v.paciente,
      v.clinica || v.setor_acesso_terceiro || 'NÃO INFORMADO',
      v.leito || v.apartamento || '-',
      v.visitante?.nome || 'PRESTADOR/OUTRO',
      v.visitante?.documento || '-',
      v.visitante?.telefone || '-',
      v.identificado_como,
      v.parentesco || v.motivo_acesso_terceiro || '-',
      v.data_hora_entrada ? formatarDataHora(v.data_hora_entrada) : '-',
      v.data_hora_saida ? formatarDataHora(v.data_hora_saida) : '-',
      calcularDuracao(v.data_hora_entrada, v.data_hora_saida),
      v.id_cracha ? String(v.id_cracha) : '-',
      v.atendente || '-'
    ]);

    // Montar conteúdo CSV com caractere de escape adequado e BOM do UTF-8
    const csvContent = '\uFEFF' + [
      headers.join(';'),
      ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(';'))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_visitas_paciente_${dataInicio}_a_${dataFim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportação PDF
  const exportarPDF = async () => {
    if (visitas.length === 0) return;

    try {
      const doc = new jsPDF('landscape');

      // Logo
      try {
        const imgObj = new Image();
        imgObj.src = '/LOGO_HSC_PRIMARY.png';
        await new Promise((resolve) => {
          imgObj.onload = resolve;
          imgObj.onerror = resolve;
        });
        doc.addImage(imgObj, 'PNG', 14, 10, 45, 12);
      } catch (e) {
        console.error('Erro ao adicionar logo no PDF:', e);
      }

      // Título
      doc.setFontSize(14);
      doc.setTextColor(30);
      doc.text('Relatório de Visitas e Acessos de Paciente', 14, 28);

      // Info do Paciente no Cabeçalho
      const primeiroRegistro = visitas[0];
      const pacienteNome = primeiroRegistro ? primeiroRegistro.paciente.toUpperCase() : (pacienteSearch.toUpperCase() || 'GERAL');

      doc.setFontSize(10);
      doc.setTextColor(50);
      doc.setFont('helvetica', 'bold');
      doc.text('Paciente:', 14, 35);
      doc.setFont('helvetica', 'normal');
      doc.text(pacienteNome, 33, 35);

      // Metadados na direita (alinhado a 282 que é a margem direita da página de 297mm)
      doc.setFontSize(9);
      doc.setTextColor(100);
      const formatarDataBR = (dateStr: string) => dateStr.split('-').reverse().join('/');
      doc.text(`Período: ${formatarDataBR(dataInicio)} a ${formatarDataBR(dataFim)}`, 282, 35, { align: 'right' });
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, 282, 40, { align: 'right' });

      // Linha Separadora
      doc.setDrawColor(220);
      doc.line(14, 43, 282, 43);

      // Tabela de Dados (Colunas: Setor, Leito, Visitante, Tipo, Parentesco, Entrada, Saída, Duração)
      const headers = [[
        'Setor',
        'Leito',
        'Visitante',
        'Tipo',
        'Parentesco / Motivo',
        'Entrada',
        'Saída',
        'Duração'
      ]];

      const body = visitas.map(v => [
        v.clinica || v.setor_acesso_terceiro || '-',
        v.leito || v.apartamento || '-',
        v.visitante?.nome || 'PRESTADOR/OUTRO',
        v.identificado_como,
        v.parentesco || v.motivo_acesso_terceiro || '-',
        v.data_hora_entrada ? formatarDataHora(v.data_hora_entrada) : '-',
        v.data_hora_saida ? formatarDataHora(v.data_hora_saida) : '-',
        v.data_hora_saida ? calcularDuracao(v.data_hora_entrada, v.data_hora_saida) : '-'
      ]);

      autoTable(doc, {
        startY: 46,
        head: headers,
        body: body,
        theme: 'striped',
        headStyles: {
          fillColor: [138, 21, 21], // Cor Bordô da marca
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 28, overflow: 'ellipsize' }, // Setor
          1: { cellWidth: 26, halign: 'center', overflow: 'ellipsize' }, // Leito
          2: { cellWidth: 55, overflow: 'ellipsize' }, // Visitante
          3: { cellWidth: 32, halign: 'center', overflow: 'ellipsize' }, // Tipo
          4: { cellWidth: 35, overflow: 'ellipsize' }, // Parentesco
          5: { cellWidth: 34, halign: 'center', overflow: 'ellipsize' }, // Entrada
          6: { cellWidth: 34, halign: 'center', overflow: 'ellipsize' }, // Saída
          7: { cellWidth: 25, halign: 'center', overflow: 'ellipsize' }  // Duração
        },
        styles: {
          fontSize: 8,
          cellPadding: 2.5,
          overflow: 'ellipsize' // Força a não quebrar linhas em nenhuma coluna por padrão
        }
      });

      // Rodapé
      const finalY = (doc as any).lastAutoTable.finalY || 150;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text('Hospital Santa Casa de Araguari - Relatório de Recepção e Controle de Acessos', 14, finalY + 15);

      // Salvar
      doc.save(`relatorio_visitas_pacientes_${dataInicio}_a_${dataFim}.pdf`);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12 animate-in fade-in duration-500 text-foreground bg-background"
    >
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <div className="p-2 bg-red-500/10 rounded-xl border border-red-500/20 text-[#8a1515] dark:text-[#f43f5e]">
              <FileText className="h-5 w-5" />
            </div>
            Relatório de Visitas por Paciente
          </h1>
          <p className="text-sm text-muted-foreground">Consulte o histórico de acessos dos pacientes de forma detalhada</p>
        </div>
      </div>

      {/* FILTROS CARD */}
      <div className="bg-card border border-border shadow-md rounded-2xl p-6">
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
          Filtros de Pesquisa
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end">
          {/* Busca por Paciente */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User size={13} /> Paciente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Nome do paciente..."
                value={pacienteSearch}
                onChange={(e) => setPacienteSearch(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all font-semibold"
              />
            </div>
          </div>

          {/* Data Inicial */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={13} /> Data Inicial
            </label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all font-semibold"
            />
          </div>

          {/* Data Final */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={13} /> Data Final
            </label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all font-semibold"
            />
          </div>

          {/* Tipo de Acesso */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Tipo de Acesso
            </label>
            <select
              value={tipoAcesso}
              onChange={(e) => setTipoAcesso(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all font-semibold cursor-pointer"
            >
              <option value="TODOS">Todos os Acessos</option>
              <option value="VISITANTE">Visitante</option>
              <option value="ACOMPANHANTE">Acompanhante</option>
              <option value="TERCEIRO">Terceiro</option>
            </select>
          </div>

          {/* Situação */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Situação da Visita
            </label>
            <select
              value={situacao}
              onChange={(e) => setSituacao(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all font-semibold cursor-pointer"
            >
              <option value="TODOS">Todas</option>
              <option value="ABERTO">Em Aberto</option>
              <option value="ENCERRADO">Finalizada</option>
            </select>
          </div>

          {/* Ordenação por Data */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ArrowUpDown size={13} /> Ordenação Data
            </label>
            <select
              value={ordenarPorData}
              onChange={(e) => setOrdenarPorData(e.target.value as 'ASC' | 'DESC')}
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 outline-none transition-all font-semibold cursor-pointer"
            >
              <option value="ASC">Mais Antigas Primeiro</option>
              <option value="DESC">Mais Novas Primeiro</option>
            </select>
          </div>
        </div>

        {/* AÇÕES FILTRO */}
        <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-border">
          <button
            onClick={handleBuscar}
            disabled={loading}
            className="px-6 py-2.5 bg-[#8a1515] hover:bg-[#8a1515]/90 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer text-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Filtrando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Aplicar Filtros
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPIS CARDS */}
      {firstSearchDone && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Visitas */}
          <div className="bg-card p-5 rounded-2xl border border-border flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-red-500/10 rounded-xl text-[#8a1515] dark:text-[#f43f5e] border border-red-500/10">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Registros Localizados</span>
              <span className="text-2xl font-extrabold text-foreground">{kpis.totalVisitas.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Pacientes Visitados */}
          <div className="bg-card p-5 rounded-2xl border border-border flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 dark:text-rose-400 border border-rose-500/10">
              <User className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Pacientes Visitados</span>
              <span className="text-2xl font-extrabold text-foreground">{kpis.pacientesDistintos.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Visitantes Únicos */}
          <div className="bg-card p-5 rounded-2xl border border-border flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Visitantes Únicos</span>
              <span className="text-2xl font-extrabold text-foreground">{kpis.visitantesUnicos.toLocaleString('pt-BR')}</span>
            </div>
          </div>

          {/* Visitas em Aberto */}
          <div className="bg-card p-5 rounded-2xl border border-border flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-500/10">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider block">Visitas em Aberto</span>
              <span className="text-2xl font-extrabold text-foreground">{kpis.visitasEmAberto.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      )}

      {/* DADOS RELATORIO */}
      {firstSearchDone && (
        <div className="bg-card border border-border shadow-md rounded-2xl overflow-hidden">
          {/* Header da Tabela */}
          <div className="p-5 border-b border-border bg-muted/20 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Info className="h-4 w-4 text-blue-500" />
              <span>
                Mostrando {paginatedVisitas.length} de {visitas.length} registros encontrados
              </span>
            </div>

            {visitas.length > 0 && (
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={exportarCSV}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl text-sm font-bold border border-border bg-background hover:bg-muted text-foreground px-4 py-2 shadow-sm cursor-pointer gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Exportar CSV
                </button>
                <button
                  onClick={exportarPDF}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl text-sm font-bold border border-border bg-background hover:bg-muted text-foreground px-4 py-2 shadow-sm cursor-pointer gap-2"
                >
                  <Download className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
                  Baixar PDF
                </button>
              </div>
            )}
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                  <th scope="col" className="px-5 py-3.5">Paciente</th>
                  <th scope="col" className="px-5 py-3.5">Setor / Leito</th>
                  <th scope="col" className="px-5 py-3.5">Visitante / Terceiro</th>
                  <th scope="col" className="px-5 py-3.5">Contato / Doc</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Tipo</th>
                  <th scope="col" className="px-5 py-3.5">Parentesco / Motivo</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Entrada</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Saída</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Duração</th>
                  <th scope="col" className="px-5 py-3.5 text-center">Crachá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <span className="text-muted-foreground text-sm font-medium">{progressText || 'Carregando dados...'}</span>
                      </div>
                    </td>
                  </tr>
                ) : visitas.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="h-40 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center p-6">
                        <AlertCircle className="h-10 w-10 text-muted-foreground/60 mb-2" />
                        <span className="text-base font-bold text-foreground">Nenhum registro encontrado</span>
                        <p className="text-xs text-muted-foreground mt-1 max-w-sm">Tente ajustar os filtros de data ou buscar por outro termo de paciente.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedVisitas.map((v) => (
                    <tr key={v.id} className="transition-colors hover:bg-muted/30">
                      {/* Paciente */}
                      <td className="px-5 py-3.5 font-bold text-foreground uppercase max-w-[180px] truncate" title={v.paciente}>
                        {v.paciente}
                      </td>
                      
                      {/* Setor/Leito */}
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground uppercase">{v.clinica || v.setor_acesso_terceiro || '-'}</span>
                          {v.leito && (
                            <span className="text-xs text-muted-foreground font-semibold">Leito: {v.leito}</span>
                          )}
                          {!v.leito && v.apartamento && (
                            <span className="text-xs text-muted-foreground font-semibold">Apto: {v.apartamento}</span>
                          )}
                        </div>
                      </td>

                      {/* Visitante */}
                      <td className="px-5 py-3.5 font-semibold text-foreground uppercase max-w-[180px] truncate" title={v.visitante?.nome || 'NÃO INFORMADO'}>
                        {v.visitante?.nome || 'PRESTADOR/OUTRO'}
                      </td>

                      {/* Contato/Doc */}
                      <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">
                        <div className="flex flex-col">
                          {v.visitante?.documento && (
                            <span>Doc: {v.visitante.documento}</span>
                          )}
                          {v.visitante?.telefone && (
                            <span>Tel: {v.visitante.telefone}</span>
                          )}
                          {!v.visitante?.documento && !v.visitante?.telefone && (
                            <span>-</span>
                          )}
                        </div>
                      </td>

                      {/* Tipo */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase border ${
                          v.identificado_como.toUpperCase() === 'VISITANTE'
                            ? 'bg-red-500/10 text-[#8a1515] dark:text-[#f43f5e] border-red-500/20'
                            : v.identificado_como.toUpperCase() === 'ACOMPANHANTE'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20'
                        }`}>
                          {v.identificado_como}
                        </span>
                      </td>

                      {/* Parentesco/Motivo */}
                      <td className="px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase max-w-[140px] truncate" title={v.parentesco || v.motivo_acesso_terceiro || '-'}>
                        {v.parentesco || v.motivo_acesso_terceiro || '-'}
                      </td>

                      {/* Entrada */}
                      <td className="px-5 py-3.5 text-center text-xs font-semibold text-foreground whitespace-nowrap">
                        {formatarDataHora(v.data_hora_entrada)}
                      </td>

                      {/* Saída */}
                      <td className="px-5 py-3.5 text-center">
                        {v.data_hora_saida ? (
                          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
                            {formatarDataHora(v.data_hora_saida)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold uppercase text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            Em Andamento
                          </span>
                        )}
                      </td>

                      {/* Duração */}
                      <td className="px-5 py-3.5 text-center font-medium text-xs text-muted-foreground">
                        {v.data_hora_saida ? (
                          calcularDuracao(v.data_hora_entrada, v.data_hora_saida)
                        ) : (
                          <span className="animate-pulse text-[#8a1515] dark:text-[#f43f5e] font-bold">...</span>
                        )}
                      </td>

                      {/* Crachá */}
                      <td className="px-5 py-3.5 text-center font-bold text-foreground">
                        {v.id_cracha || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer da Tabela (PAGINAÇÃO) */}
          {totalPages > 1 && (
            <div className="p-5 border-t border-border flex justify-between items-center bg-muted/20">
              <span className="text-sm text-muted-foreground">
                Página <span className="font-semibold text-foreground">{currentPage}</span> de <span className="font-semibold text-foreground">{totalPages}</span> - {visitas.length} registros no total
              </span>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                {(() => {
                  let startPage = Math.max(1, currentPage - 2);
                  let endPage = startPage + 4;
                  if (endPage > totalPages) {
                    endPage = totalPages;
                    startPage = Math.max(1, endPage - 4);
                  }
                  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
                  
                  return visiblePages.map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all cursor-pointer ${
                        page === currentPage
                          ? 'bg-[#8a1515] text-white shadow-md border-transparent'
                          : 'border border-border bg-background hover:bg-muted text-foreground'
                      }`}
                    >
                      {page}
                    </button>
                  ));
                })()}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-9 h-9 flex items-center justify-center rounded-xl border border-border bg-background hover:bg-muted text-muted-foreground disabled:opacity-50 cursor-pointer transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
