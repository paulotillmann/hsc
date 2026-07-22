import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Search,
  Download,
  FileText,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Users,
  Activity,
  BarChart2,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { webhookService } from '../../../services/webhookService';

interface PermanenciaProps {
  dataInicio: string;
  dataFim: string;
  onKpiChange: (kpi: any) => void;
}

const META_HORAS = 8.0; // Meta institucional: <= 8.0 horas na Emergência
const META_MINUTOS = 480;

const MOCK_DATA = [
  { NR_ATENDIMENTO: 114680, NM_PACIENTE: 'Pablo José Rodrigues Malta', DT_ENTRADA: '2026-07-22 09:34:30', TEMPO_MEDIO_HHMI: '01.30', MEDICO: 'Santa Casa', DS_CLINICA: 'Clínica Médica' },
  { NR_ATENDIMENTO: 114679, NM_PACIENTE: 'Jovair Raimundo do Prado', DT_ENTRADA: '2026-07-22 09:32:45', TEMPO_MEDIO_HHMI: '03.15', MEDICO: 'Santa Casa', DS_CLINICA: 'Clínica Médica' },
  { NR_ATENDIMENTO: 114678, NM_PACIENTE: 'Edmur Miguel Marques Caixeta', DT_ENTRADA: '2026-07-22 09:30:17', TEMPO_MEDIO_HHMI: '05.20', MEDICO: 'Luciana da Cruz Machado Araújo', DS_CLINICA: 'Pediatria' },
  { NR_ATENDIMENTO: 114676, NM_PACIENTE: 'Benicio Cardoso Silva de Castro', DT_ENTRADA: '2026-07-22 08:23:30', TEMPO_MEDIO_HHMI: '02.45', MEDICO: 'Luciana da Cruz Machado Araújo', DS_CLINICA: 'Pediatria' },
  { NR_ATENDIMENTO: 114670, NM_PACIENTE: 'Maria Eduarda Fernandes', DT_ENTRADA: '2026-07-21 14:12:00', TEMPO_MEDIO_HHMI: '04.50', MEDICO: 'Dr. Roberto Alves', DS_CLINICA: 'Ortopedia' },
  { NR_ATENDIMENTO: 114665, NM_PACIENTE: 'Carlos Eduardo Santos', DT_ENTRADA: '2026-07-21 11:05:00', TEMPO_MEDIO_HHMI: '01.10', MEDICO: 'Dra. Patricia Lima', DS_CLINICA: 'Ginecologia e Obstetrícia' },
  { NR_ATENDIMENTO: 114660, NM_PACIENTE: 'Ana Clara Souza', DT_ENTRADA: '2026-07-20 18:40:00', TEMPO_MEDIO_HHMI: '03.40', MEDICO: 'Santa Casa', DS_CLINICA: 'Cirúrgica' },
  { NR_ATENDIMENTO: 114655, NM_PACIENTE: 'João Pedro Oliveira', DT_ENTRADA: '2026-07-20 10:15:00', TEMPO_MEDIO_HHMI: '02.05', MEDICO: 'Dr. Fernando Costa', DS_CLINICA: 'Cardiologia' },
  { NR_ATENDIMENTO: 114650, NM_PACIENTE: 'Francisca das Chagas Silva', DT_ENTRADA: '2026-07-19 22:10:00', TEMPO_MEDIO_HHMI: '06.10', MEDICO: 'Santa Casa', DS_CLINICA: 'Clínica Médica' }
];

/**
 * Converte tempo em minutos totais a partir das datas reais ou string HH:MM/HH.MM
 */
function parseHHMIToMinutes(val: any, row?: any): number {
  if (row && (row.DT_ENTRADA || row.dt_entrada)) {
    try {
      const dtEntradaStr = String(row.DT_ENTRADA || row.dt_entrada).trim();
      const dtFimStr = row.DT_FIM_CONSULTA || row.dt_fim_consulta;
      if (dtEntradaStr) {
        const start = new Date(dtEntradaStr.replace(' ', 'T'));
        const end = dtFimStr ? new Date(String(dtFimStr).replace(' ', 'T')) : new Date();
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          const diffMs = end.getTime() - start.getTime();
          return Math.max(0, Math.round(diffMs / 60000));
        }
      }
    } catch {
      // Fallback para o parse de string
    }
  }

  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return Math.round(val * 60);
  }
  const str = String(val).trim();
  if (!str || str.includes('#')) return 0;

  if (str.includes(':')) {
    const [h, m] = str.split(':').map(Number);
    return ((h || 0) * 60) + (m || 0);
  } else if (str.includes('.')) {
    const [h, m] = str.split('.').map(Number);
    return ((h || 0) * 60) + (m || 0);
  } else {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.round(num * 60);
  }
}

/**
 * Formata minutos totais no padrão HHh MMm
 */
function formatMinutesToHHMM(totalMinutes: number): string {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return '00h 00m';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

/**
 * Converte minutos totais para Horas Decimais com 1 casa
 */
function minutesToHoursDecimal(totalMinutes: number): number {
  if (isNaN(totalMinutes) || totalMinutes <= 0) return 0;
  return Number((totalMinutes / 60).toFixed(1));
}

export default function MediaPermanencia({ dataInicio, dataFim, onKpiChange }: PermanenciaProps) {
  const [loading, setLoading] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [dados, setDados] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtros
  const [selectedClinica, setSelectedClinica] = useState('');
  const [selectedMedico, setSelectedMedico] = useState('');
  const [selectedMetaFilter, setSelectedMetaFilter] = useState<'all' | 'within' | 'exceeded' | 'finished_only' | 'pending_over_12h'>('all');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const carregarDados = async () => {
    setLoading(true);
    setUsingMock(false);
    try {
      const response = await webhookService.fetchIndicadoresQualidade({
        indicador: 'media_permanencia',
        data_inicio: dataInicio,
        data_fim: dataFim
      });
      if (response && response.length > 0) {
        setDados(response);
      } else {
        setDados(MOCK_DATA);
        setUsingMock(true);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de media permanencia:', error);
      setDados(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedClinica('');
    setSelectedMedico('');
    setSelectedMetaFilter('all');
    setCurrentPage(1);
    carregarDados();
  }, [dataInicio, dataFim]);

  // Lista de clínicas únicas disponíveis
  const listClinicas = useMemo(() => {
    const setClinicas = new Set<string>();
    dados.forEach(item => {
      const clinica = item.DS_CLINICA || item.ds_clinica || item.SETOR || item.setor;
      if (clinica) setClinicas.add(String(clinica).trim());
    });
    return Array.from(setClinicas).sort();
  }, [dados]);

  // Lista de médicos únicos disponíveis
  const listMedicos = useMemo(() => {
    const setMedicos = new Set<string>();
    dados.forEach(item => {
      const medico = item.MEDICO || item.medico;
      if (medico) setMedicos.add(String(medico).trim());
    });
    return Array.from(setMedicos).sort();
  }, [dados]);

  // Filtragem pelos selects de Clínica, Médico e Meta
  const dadosFiltradosDrop = useMemo(() => {
    return dados.filter(item => {
      const clinica = item.DS_CLINICA || item.ds_clinica || item.SETOR || item.setor || '';
      const medico = item.MEDICO || item.medico || '';

      const hhmiVal = item.TEMPO_MEDIO_HHMI || item.tempo_medio_hhmi || item.tempo_medio_horas || item.tempo_medio || 0;
      const mins = parseHHMIToMinutes(hhmiVal, item);
      const horas = mins / 60;

      const dtFimStr = item.DT_FIM_CONSULTA || item.dt_fim_consulta;
      const isPending = !dtFimStr || String(dtFimStr).trim() === '' || String(dtFimStr).trim() === '-';

      if (selectedClinica && clinica !== selectedClinica) return false;
      if (selectedMedico && medico !== selectedMedico) return false;

      if (selectedMetaFilter === 'within' && horas > META_HORAS) return false;
      if (selectedMetaFilter === 'exceeded' && horas <= META_HORAS) return false;
      if (selectedMetaFilter === 'finished_only' && isPending) return false;
      if (selectedMetaFilter === 'pending_over_12h' && (!isPending || mins < 720)) return false;

      return true;
    });
  }, [dados, selectedClinica, selectedMedico, selectedMetaFilter]);

  // Filtragem secundária por termo de busca
  const filteredDados = useMemo(() => {
    if (!searchTerm.trim()) return dadosFiltradosDrop;
    const term = searchTerm.toLowerCase();
    return dadosFiltradosDrop.filter(item =>
      Object.values(item).some(val => String(val).toLowerCase().includes(term))
    );
  }, [dadosFiltradosDrop, searchTerm]);

  // Resetar a página para 1 quando alterar busca ou filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedClinica, selectedMedico, selectedMetaFilter]);

  // Cálculos de KPIs Globais
  const kpi = useMemo(() => {
    if (dadosFiltradosDrop.length === 0) {
      return {
        tempoMedioHoras: 0,
        tempoMedioHHMMStr: '00h 00m',
        totalAtendimentos: 0,
        dentroMetaCount: 0,
        foraMetaCount: 0,
        taxaConformidade: 0,
        maiorPermanencia: '0h 0m',
        tendencia: 'baixa' as const
      };
    }

    let somaMinutos = 0;
    let dentroMeta = 0;
    let maxMinutos = 0;

    dadosFiltradosDrop.forEach(item => {
      const hhmiVal = item.TEMPO_MEDIO_HHMI || item.tempo_medio_hhmi || item.tempo_medio_horas || item.tempo_medio || 0;
      const mins = parseHHMIToMinutes(hhmiVal);
      somaMinutos += mins;

      if (mins < META_MINUTOS) {
        dentroMeta++;
      }
      if (mins > maxMinutos) {
        maxMinutos = mins;
      }
    });

    const total = dadosFiltradosDrop.length;
    const mediaMin = total > 0 ? somaMinutos / total : 0;
    const tempoMedioHoras = minutesToHoursDecimal(mediaMin);
    const tempoMedioHHMMStr = formatMinutesToHHMM(mediaMin);
    const taxaConformidade = total > 0 ? Number(((dentroMeta / total) * 100).toFixed(1)) : 0;
    const tendencia = tempoMedioHoras > META_HORAS ? 'alta' : 'baixa';

    return {
      tempoMedioHoras,
      tempoMedioHHMMStr,
      totalAtendimentos: total,
      dentroMetaCount: dentroMeta,
      foraMetaCount: total - dentroMeta,
      taxaConformidade,
      maiorPermanencia: formatMinutesToHHMM(maxMinutos),
      tendencia
    };
  }, [dadosFiltradosDrop]);

  // Notificar componente pai sobre os KPIs calculados
  useEffect(() => {
    onKpiChange({
      taxaMedia: `${kpi.tempoMedioHoras} h`,
      labelTaxa: 'Média de Permanência',
      totalValue: `${kpi.totalAtendimentos} pacientes`,
      totalLabel: 'Atendimentos Totais',
      meta: `<= ${META_HORAS} horas na Emergência`,
      metaDesc: `Tempo médio desejável do acolhimento/entrada na emergência até a alta ou internação. (${kpi.taxaConformidade}% dentro da meta)`,
      usingMock,
      tendencia: kpi.tendencia,
      loading
    });
  }, [kpi, usingMock, loading]);

  // Dados agrupados por DIA para o gráfico de linha/área temporal
  const dadosGraficoDiario = useMemo(() => {
    if (dadosFiltradosDrop.length === 0) return [];

    const grupos: Record<string, { dataStr: string; somaMinutos: number; count: number; dentroMeta: number }> = {};

    dadosFiltradosDrop.forEach(item => {
      const dtEntradaRaw = item.DT_ENTRADA || item.dt_entrada || item.data || item.DATA || '';
      if (!dtEntradaRaw) return;

      const dateKey = String(dtEntradaRaw).substring(0, 10); // YYYY-MM-DD
      const hhmiVal = item.TEMPO_MEDIO_HHMI || item.tempo_medio_hhmi || item.tempo_medio_horas || item.tempo_medio || 0;
      const mins = parseHHMIToMinutes(hhmiVal);

      if (!grupos[dateKey]) {
        grupos[dateKey] = { dataStr: dateKey, somaMinutos: 0, count: 0, dentroMeta: 0 };
      }
      grupos[dateKey].somaMinutos += mins;
      grupos[dateKey].count += 1;
      if (mins < META_MINUTOS) grupos[dateKey].dentroMeta += 1;
    });

    return Object.values(grupos)
      .map(g => {
        const mediaMins = g.somaMinutos / g.count;
        return {
          dataStr: g.dataStr,
          tempoHoras: minutesToHoursDecimal(mediaMins),
          tempoHHMM: formatMinutesToHHMM(mediaMins),
          atendimentos: g.count,
          conformidade: Number(((g.dentroMeta / g.count) * 100).toFixed(0))
        };
      })
      .sort((a, b) => a.dataStr.localeCompare(b.dataStr));
  }, [dadosFiltradosDrop]);

  // Dados agrupados por ESPECIALIDADE CLÍNICA para o gráfico de barras
  const dadosGraficoClinica = useMemo(() => {
    if (dadosFiltradosDrop.length === 0) return [];

    const grupos: Record<string, { clinica: string; somaMinutos: number; count: number }> = {};

    dadosFiltradosDrop.forEach(item => {
      const clinica = String(item.DS_CLINICA || item.ds_clinica || item.SETOR || item.setor || 'Não Especificado').trim();
      const hhmiVal = item.TEMPO_MEDIO_HHMI || item.tempo_medio_hhmi || item.tempo_medio_horas || item.tempo_medio || 0;
      const mins = parseHHMIToMinutes(hhmiVal);

      if (!grupos[clinica]) {
        grupos[clinica] = { clinica, somaMinutos: 0, count: 0 };
      }
      grupos[clinica].somaMinutos += mins;
      grupos[clinica].count += 1;
    });

    return Object.values(grupos)
      .map(g => {
        const mediaMins = g.somaMinutos / g.count;
        return {
          clinica: g.clinica,
          tempoHoras: minutesToHoursDecimal(mediaMins),
          tempoHHMM: formatMinutesToHHMM(mediaMins),
          atendimentos: g.count
        };
      })
      .sort((a, b) => b.tempoHoras - a.tempoHoras);
  }, [dadosFiltradosDrop]);

  // Paginação da Tabela
  const totalPages = Math.ceil(filteredDados.length / itemsPerPage) || 1;
  const paginatedDados = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredDados.slice(start, start + itemsPerPage);
  }, [filteredDados, currentPage, itemsPerPage]);

  // Exportar CSV
  const exportarCSV = () => {
    if (filteredDados.length === 0) return;

    const headers = ['N° Atendimento', 'Paciente', 'Data/Hora Entrada', 'Especialidade / Clínica', 'Médico Responsável', 'Permanência (HH:MM)', 'Permanência (Horas)', 'Status Meta'];
    const rows = filteredDados.map(row => {
      const hhmi = row.TEMPO_MEDIO_HHMI || row.tempo_medio_hhmi || row.tempo_medio_horas || '-';
      const mins = parseHHMIToMinutes(hhmi);
      const horas = minutesToHoursDecimal(mins);
      const statusMeta = mins < META_MINUTOS ? 'Dentro da Meta (<4h)' : 'Acima da Meta (>=4h)';

      return [
        row.NR_ATENDIMENTO || row.nr_atendimento || '-',
        `"${(row.NM_PACIENTE || row.nm_paciente || 'Paciente').replace(/"/g, '""')}"`,
        `"${row.DT_ENTRADA || row.dt_entrada || row.data || '-'}"`,
        `"${(row.DS_CLINICA || row.ds_clinica || row.setor || '-').replace(/"/g, '""')}"`,
        `"${(row.MEDICO || row.medico || '-').replace(/"/g, '""')}"`,
        formatMinutesToHHMM(mins),
        horas,
        statusMeta
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tempo_permanencia_emergencia_${dataInicio}_a_${dataFim}.csv`;
    link.click();
  };

  // Gerar PDF Oficial da Gestão da Qualidade HSC
  const gerarPDF = () => {
    if (filteredDados.length === 0) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho institucional HSC
    doc.setFillColor(90, 16, 16); // Bordô institucional #5A1010
    doc.rect(0, 0, pageWidth, 32, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('HOSPITAL SANTA CASA DE ARAGUARI', 15, 14);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('GESTÃO DA QUALIDADE E SEGURANÇA DO PACIENTE', 15, 22);
    doc.text(`Período do Relatório: ${dataInicio.split('-').reverse().join('/')} até ${dataFim.split('-').reverse().join('/')}`, 15, 28);

    // Título do Indicador
    doc.setTextColor(90, 16, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Indicador: Tempo de Permanência na Emergência (Pronto Socorro)', 15, 42);

    // Resumo de KPIs no PDF
    autoTable(doc, {
      startY: 46,
      head: [['Métrica Avaliada', 'Resultado Apurado', 'Meta Institucional', 'Status de Conformidade']],
      body: [
        ['Tempo Médio de Permanência', `${kpi.tempoMedioHoras} h (${kpi.tempoMedioHHMMStr})`, `<= ${META_HORAS} horas`, kpi.tempoMedioHoras <= META_HORAS ? 'DENTRO DA META' : 'ACIMA DA META'],
        ['Total de Atendimentos Analisados', `${kpi.totalAtendimentos} pacientes`, '100% dos fluxos de emergência', 'ANALISADO'],
        ['Pacientes no Período <= 8.0 horas', `${kpi.dentroMetaCount} (${kpi.taxaConformidade}%)`, 'Conformidade Esperada > 80%', kpi.taxaConformidade >= 80 ? 'CONFORME' : 'ALERTA'],
        ['Maior Permanência Registrada', kpi.maiorPermanencia, 'Observação em PS < 24h', 'REGISTRADO']
      ],
      headStyles: { fillColor: [90, 16, 16], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      theme: 'grid',
      margin: { left: 15, right: 15 }
    });

    // Tabela por Especialidades no PDF
    const yEspecialidade = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(90, 16, 16);
    doc.text('Consolidado por Especialidade Clínica / Setor', 15, yEspecialidade);

    const tableClinicas = dadosGraficoClinica.map(c => [
      c.clinica,
      `${c.atendimentos} atendimentos`,
      c.tempoHHMM,
      `${c.tempoHoras} h`,
      c.tempoHoras <= META_HORAS ? 'Dentro da Meta' : 'Acima da Meta'
    ]);

    autoTable(doc, {
      startY: yEspecialidade + 4,
      head: [['Especialidade Clínica', 'Atendimentos', 'Permanência Média (HH:MM)', 'Permanência Média (Horas)', 'Avaliação de Meta']],
      body: tableClinicas,
      headStyles: { fillColor: [90, 16, 16], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      theme: 'striped',
      margin: { left: 15, right: 15 }
    });

    // Listagem amostragem de atendimentos (primeiros 50)
    const yRegistros = (doc as any).lastAutoTable.finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(90, 16, 16);
    doc.text(`Detalhamento dos Atendimentos (Top 50 de ${filteredDados.length})`, 15, yRegistros);

    const sampleRows = filteredDados.slice(0, 50).map(r => {
      const hhmi = r.TEMPO_MEDIO_HHMI || r.tempo_medio_hhmi || r.tempo_medio_horas || '-';
      const mins = parseHHMIToMinutes(hhmi);
      return [
        r.NR_ATENDIMENTO || r.nr_atendimento || '-',
        r.NM_PACIENTE || r.nm_paciente || 'Paciente',
        r.DT_ENTRADA || r.dt_entrada || '-',
        r.DS_CLINICA || r.ds_clinica || '-',
        r.MEDICO || r.medico || '-',
        formatMinutesToHHMM(mins),
        mins <= META_MINUTOS ? 'OK (<=8h)' : 'ALERTA (>8h)'
      ];
    });

    autoTable(doc, {
      startY: yRegistros + 4,
      head: [['Nº Atend.', 'Paciente', 'Data Entrada', 'Especialidade', 'Médico', 'Permanência', 'Status']],
      body: sampleRows,
      headStyles: { fillColor: [90, 16, 16], textColor: 255, fontStyle: 'bold', fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      margin: { left: 15, right: 15 },
      theme: 'grid'
    });

    // Rodapé de todas as páginas
    const totalPagesPDF = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPagesPDF; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`Hospital Santa Casa de Araguari - Relatório Oficial de Gestão da Qualidade | Página ${i} de ${totalPagesPDF}`, 15, 288);
    }

    doc.save(`relatorio_permanencia_emergencia_${dataInicio}_a_${dataFim}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">

      {/* Barra de Filtros Específicos do Indicador */}
      <div className="bg-card border border-border/60 p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mr-1">
            <Filter className="h-4 w-4 text-primary" />
            <span>Filtros do Indicador:</span>
          </div>

          {/* Filtro por Especialidade */}
          {listClinicas.length > 0 && (
            <select
              value={selectedClinica}
              onChange={(e) => setSelectedClinica(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium h-8"
            >
              <option value="">Todas as Especialidades ({listClinicas.length})</option>
              {listClinicas.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Filtro por Médico */}
          {listMedicos.length > 0 && (
            <select
              value={selectedMedico}
              onChange={(e) => setSelectedMedico(e.target.value)}
              className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium h-8 max-w-[200px]"
            >
              <option value="">Todos os Médicos ({listMedicos.length})</option>
              {listMedicos.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}

          {/* Filtro de Meta */}
          <select
            value={selectedMetaFilter}
            onChange={(e) => setSelectedMetaFilter(e.target.value as any)}
            className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-medium h-8"
          >
            <option value="all">Todos os Atendimentos</option>
            <option value="within">Dentro da Meta (&le; 8h)</option>
            <option value="exceeded">Acima da Meta (&gt; 8h)</option>
            <option value="finished_only">Apenas Pacientes Finalizados (Com Alta)</option>
            <option value="pending_over_12h">🚨 Pendentes no Tasy (&gt; 12h sem Fim)</option>
          </select>
        </div>

        {/* Botões de Ação: PDF e CSV */}
        <div className="flex items-center gap-2">
          <button
            onClick={gerarPDF}
            disabled={filteredDados.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 rounded-lg shadow-sm font-medium transition-colors cursor-pointer"
            title="Gerar Relatório PDF com os dados filtrados"
          >
            <FileText className="h-3.5 w-3.5" />
            Relatório PDF
          </button>

          <button
            onClick={exportarCSV}
            disabled={filteredDados.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg shadow-sm font-medium transition-colors cursor-pointer"
            title="Exportar dados da tabela em formato CSV"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Cards Internos de Resumo Estatístico Interativos (Clique para filtrar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Permanência Média */}
        <div
          onClick={() => setSelectedMetaFilter('all')}
          title="Clique para ver todos os atendimentos"
          className={`bg-card border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
            selectedMetaFilter === 'all'
              ? 'ring-2 ring-[#5A1010] border-[#5A1010] shadow-md bg-[#5A1010]/5'
              : 'border-border/60 hover:border-[#5A1010]/50'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Permanência Média</p>
            <p className="text-2xl font-extrabold text-foreground mt-1">{kpi.tempoMedioHoras} h</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">{kpi.tempoMedioHHMMStr} no PS (Todos)</p>
          </div>
          <div className="p-3 bg-[#5A1010]/10 text-[#5A1010] rounded-xl">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* Card 2: Total Atendimentos */}
        <div
          onClick={() => setSelectedMetaFilter('finished_only')}
          title="Clique para filtrar apenas pacientes com Alta/Finalizados"
          className={`bg-card border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
            selectedMetaFilter === 'finished_only'
              ? 'ring-2 ring-blue-500 border-blue-500 shadow-md bg-blue-500/5'
              : 'border-border/60 hover:border-blue-500/50'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Atendimentos Totais</p>
            <p className="text-2xl font-extrabold text-foreground mt-1">{kpi.totalAtendimentos}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-semibold">🔍 Filtrar apenas Finalizados</p>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Card 3: Taxa de Conformidade (<= 8h) */}
        <div
          onClick={() => setSelectedMetaFilter('within')}
          title="Clique para filtrar apenas atendimentos dentro da meta (<= 8h)"
          className={`bg-card border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
            selectedMetaFilter === 'within'
              ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md bg-emerald-500/5'
              : 'border-border/60 hover:border-emerald-500/50'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Conformidade (&le; 8h)</p>
            <p className={`text-2xl font-extrabold mt-1 ${kpi.taxaConformidade >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
              {kpi.taxaConformidade}%
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">{kpi.dentroMetaCount} de {kpi.totalAtendimentos} (&le; 8h)</p>
          </div>
          <div className={`p-3 rounded-xl ${kpi.taxaConformidade >= 80 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        {/* Card 4: Maior Permanência / Fora da Meta (> 8h) */}
        <div
          onClick={() => setSelectedMetaFilter('exceeded')}
          title="Clique para filtrar atendimentos acima da meta (> 8h)"
          className={`bg-card border p-4 rounded-xl shadow-sm flex items-center justify-between cursor-pointer transition-all duration-200 hover:scale-[1.01] ${
            selectedMetaFilter === 'exceeded'
              ? 'ring-2 ring-rose-500 border-rose-500 shadow-md bg-rose-500/5'
              : 'border-border/60 hover:border-rose-500/50'
          }`}
        >
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Acima da Meta (&gt; 8h)</p>
            <p className="text-2xl font-extrabold text-rose-500 mt-1">{kpi.foraMetaCount} casos</p>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-semibold">Max: {kpi.maiorPermanencia}</p>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Seção de Gráficos (Dual Layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Gráfico 1: Evolução Diária da Permanência Média */}
        <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Evolução Diária da Permanência (Horas)
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tempo médio em horas registrado por dia na Emergência</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#5A1010]/10 text-[#5A1010]">
              Meta: &le; 8.0h
            </span>
          </div>

          <div className="h-[260px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : dadosGraficoDiario.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Clock className="h-8 w-8 opacity-40" />
                <span className="text-xs">Nenhum registro para o gráfico diário.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dadosGraficoDiario} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTempo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5A1010" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#5A1010" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                  <XAxis
                    dataKey="dataStr"
                    tickFormatter={(str) => {
                      if (!str) return '';
                      if (String(str).includes('-')) {
                        const parts = String(str).split('-');
                        return `${parts[2]}/${parts[1]}`;
                      }
                      return String(str);
                    }}
                    tick={{ fontSize: 10 }}
                  />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: 11 }}
                    itemStyle={{ fontSize: 11 }}
                    formatter={(val: any) => [`${val} horas`, 'Permanência Média']}
                    labelFormatter={(label) => {
                      if (String(label).includes('-')) {
                        return `Data: ${String(label).split('-').reverse().join('/')}`;
                      }
                      return label;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="tempoHoras"
                    name="Permanência Média (Horas)"
                    stroke="#5A1010"
                    fillOpacity={1}
                    fill="url(#colorTempo)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Gráfico 2: Permanência Média por Especialidade Clínica */}
        <div className="bg-card border border-border/60 p-5 rounded-2xl shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-[#5A1010]" />
                Permanência Média por Especialidade
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Média de horas em observação separada por clínica</p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
              {dadosGraficoClinica.length} Especialidades
            </span>
          </div>

          <div className="h-[260px] w-full">
            {loading ? (
              <div className="h-full w-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5A1010]"></div>
              </div>
            ) : dadosGraficoClinica.length === 0 ? (
              <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <BarChart2 className="h-8 w-8 opacity-40" />
                <span className="text-xs">Nenhuma especialidade identificada.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGraficoClinica} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                  <XAxis
                    dataKey="clinica"
                    tick={{ fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: 11 }}
                    itemStyle={{ fontSize: 11 }}
                    formatter={(val: any, name: any, item: any) => [`${val} h (${item.payload.tempoHHMM})`, 'Média Permanência']}
                  />
                  <Bar dataKey="tempoHoras" name="Permanência Média (Horas)" radius={[4, 4, 0, 0]} maxBarSize={45}>
                    {dadosGraficoClinica.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.tempoHoras > META_HORAS ? '#e11d48' : '#5A1010'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Tabela Detalhada de Atendimentos com Paginação e Busca */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-sm overflow-hidden">

        {/* Cabeçalho da Tabela */}
        <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="font-bold text-base text-foreground flex items-center gap-2">
              Registros de Atendimento na Emergência
              <span className="text-xs font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                {filteredDados.length} registros
              </span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Listagem individualizada dos fluxos no Pronto Socorro e avaliação da meta de 4.0h.
            </p>
          </div>

          {/* Campo de Busca Textual */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Buscar paciente, nº atendimento, médico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary h-8"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
              <Search className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>

        {/* Conteúdo da Tabela */}
        <div className="overflow-x-auto w-full">
          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : paginatedDados.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <Clock className="h-8 w-8 opacity-40" />
              <span className="text-sm font-medium">Nenhum registro de atendimento encontrado para os filtros selecionados.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border/60">
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider">Nº Atendimento</th>
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider">Paciente</th>
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider">Data / Hora Entrada</th>
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider">Fim Consulta</th>
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider">Especialidade / Clínica</th>
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider">Médico Responsável</th>
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider text-right">Tempo Permanência</th>
                  <th className="p-3.5 font-bold text-muted-foreground uppercase tracking-wider text-center">Status Meta (&lt; 4h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paginatedDados.map((row, idx) => {
                  const numAtend = row.NR_ATENDIMENTO || row.nr_atendimento || '-';
                  const paciente = row.NM_PACIENTE || row.nm_paciente || 'Paciente';
                  const dtEntrada = row.DT_ENTRADA || row.dt_entrada || row.data || '-';
                  const dtFim = row.DT_FIM_CONSULTA || row.dt_fim_consulta || '-';
                  const clinica = row.DS_CLINICA || row.ds_clinica || row.SETOR || row.setor || '-';
                  const medico = row.MEDICO || row.medico || 'Santa Casa';

                  const hhmiVal = row.TEMPO_MEDIO_HHMI || row.tempo_medio_hhmi || row.tempo_medio_horas || 0;
                  const mins = parseHHMIToMinutes(hhmiVal);
                  const hhmmFormatted = formatMinutesToHHMM(mins);
                  const dentroMeta = mins < META_MINUTOS;

                  return (
                    <tr key={idx} className="hover:bg-muted/15 transition-colors">
                      <td className="p-3.5 font-mono text-muted-foreground font-medium">{numAtend}</td>
                      <td className="p-3.5 font-semibold text-foreground">{paciente}</td>
                      <td className="p-3.5 text-muted-foreground font-medium">{dtEntrada}</td>
                      <td className="p-3.5 text-muted-foreground font-medium">{dtFim}</td>
                      <td className="p-3.5 text-foreground">{clinica}</td>
                      <td className="p-3.5 text-muted-foreground">{medico}</td>
                      <td className="p-3.5 text-right font-bold text-primary font-mono">{hhmmFormatted}</td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${dentroMeta
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}>
                          {dentroMeta ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                          {dentroMeta ? 'Conforme (&le; 8h)' : 'Acima Meta (&gt; 8h)'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Rodapé com Médias e Totais */}
              <tfoot>
                <tr className="bg-muted/30 font-bold border-t-2 border-border/80 text-xs">
                  <td colSpan={6} className="p-3.5 text-muted-foreground uppercase tracking-wider font-extrabold">
                    Média Geral do Período ({filteredDados.length} Atendimentos)
                  </td>
                  <td className="p-3.5 text-right font-extrabold text-primary font-mono text-sm">
                    {kpi.tempoMedioHHMMStr}
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="font-extrabold text-foreground">
                      {kpi.taxaConformidade}% OK
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Rodapé da Paginação */}
        {filteredDados.length > itemsPerPage && (
          <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/20 text-xs">
            <div className="text-muted-foreground font-medium">
              Exibindo <span className="font-bold text-foreground">{(currentPage - 1) * itemsPerPage + 1}</span> até{' '}
              <span className="font-bold text-foreground">{Math.min(currentPage * itemsPerPage, filteredDados.length)}</span> de{' '}
              <span className="font-bold text-foreground">{filteredDados.length}</span> registros
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Página anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-3 py-1 font-bold text-foreground">
                Página {currentPage} de {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Próxima página"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
