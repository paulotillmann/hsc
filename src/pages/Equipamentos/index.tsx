import React, { useEffect, useState, useMemo } from 'react';
import { 
  Laptop, 
  ShieldCheck, 
  Building2, 
  Network, 
  Search, 
  X, 
  Check, 
  Copy, 
  ExternalLink, 
  Calendar, 
  Info, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Monitor, 
  Cpu, 
  Database, 
  FileText,
  AlertTriangle,
  Filter,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { webhookService } from '../../services/webhookService';
import { VisaoGeralCard } from '../../components/recepcao/VisaoGeralCard';

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface Equipamento {
  NR_SEQUENCIA: number;
  DS_EQUIPAMENTO: string;
  LOCALIZACAO: string;
  TIPO: string;
  PROPRIEDADE: string;
  'OBTER_NOME_PJ(CD_CGC_TERC)': string | null;
  'OBTER_NOME_PJ(A.CD_CGC_TERC)'?: string | null;
  DS_CATEGORIA: string | null;
  PATRIMONIO: string | null;
  IP: string | null;
  PROCESSADOR: string | null;
  MEMORIA: string | null;
  ANYDESK: string | null;
  DS_OBSERVACAO_TENSAO: string | null;
  INICIO_CONTRATO: string | null;
  FIM_CONTRATO: string | null;
  FORNECEDOR?: string | null;
  fornecedor?: string | null;
}

export default function Equipamentos() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPropriedade, setSelectedPropriedade] = useState('');
  const [selectedLocalizacoes, setSelectedLocalizacoes] = useState<string[]>([]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedFornecedores, setSelectedFornecedores] = useState<string[]>([]);
  const [isCategoriaDropdownOpen, setIsCategoriaDropdownOpen] = useState(false);
  const [isLocalizacaoDropdownOpen, setIsLocalizacaoDropdownOpen] = useState(false);
  const [isFornecedorDropdownOpen, setIsFornecedorDropdownOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Paginação e Ordenação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [sortField, setSortField] = useState<keyof Equipamento>('NR_SEQUENCIA');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Modal de Detalhes
  const [selectedEquipamento, setSelectedEquipamento] = useState<Equipamento | null>(null);
  const [copiedAnydesk, setCopiedAnydesk] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadData = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    try {
      const data = await webhookService.fetchEquipamentosTi();
      setEquipamentos(data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Erro ao carregar equipamentos:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.categoria-dropdown-container')) {
        setIsCategoriaDropdownOpen(false);
      }
      if (!target.closest('.localizacao-dropdown-container')) {
        setIsLocalizacaoDropdownOpen(false);
      }
      if (!target.closest('.fornecedor-dropdown-container')) {
        setIsFornecedorDropdownOpen(false);
      }
      if (!target.closest('.datepicker-dropdown-container')) {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Resetar todos os filtros
  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedPropriedade('');
    setSelectedLocalizacoes([]);
    setSelectedCategorias([]);
    setSelectedFornecedores([]);
    setSelectedMonth(null);
    setSelectedYear(new Date().getFullYear());
    setCurrentPage(1);
  };

  // Listas de opções para filtros (obtidas dinamicamente a partir dos dados)
  const filterOptions = useMemo(() => {
    const propriedades = new Set<string>();
    const localizacoes = new Set<string>();
    const categorias = new Set<string>();
    const fornecedores = new Set<string>();
 
    equipamentos.forEach(e => {
      if (e.PROPRIEDADE) propriedades.add(e.PROPRIEDADE.trim());
      if (e.LOCALIZACAO) localizacoes.add(e.LOCALIZACAO.trim());
      if (e.DS_CATEGORIA) categorias.add(e.DS_CATEGORIA.trim());
      
      const forn = e.FORNECEDOR || e.fornecedor || e['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || e['OBTER_NOME_PJ(CD_CGC_TERC)'];
      if (forn) fornecedores.add(forn.trim());
    });

    return {
      propriedades: Array.from(propriedades).sort(),
      localizacoes: Array.from(localizacoes).sort(),
      categorias: Array.from(categorias).sort(),
      fornecedores: Array.from(fornecedores).sort()
    };
  }, [equipamentos]);



  // Ordenação de dados
  const handleSort = (field: keyof Equipamento) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filtragem e Ordenação
  const filteredAndSortedEquipamentos = useMemo(() => {
    return equipamentos
      .filter(e => {
        // Busca textual
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term || 
          e.DS_EQUIPAMENTO?.toLowerCase().includes(term) ||
          e.LOCALIZACAO?.toLowerCase().includes(term) ||
          e.PATRIMONIO?.toLowerCase().includes(term) ||
          e.IP?.toLowerCase().includes(term) ||
          e.ANYDESK?.toLowerCase().includes(term) ||
          e.PROCESSADOR?.toLowerCase().includes(term) ||
          e.MEMORIA?.toLowerCase().includes(term) ||
          e.DS_CATEGORIA?.toLowerCase().includes(term) ||
          e.NR_SEQUENCIA?.toString().includes(term) ||
          e.FORNECEDOR?.toLowerCase().includes(term) ||
          e.fornecedor?.toLowerCase().includes(term) ||
          e['OBTER_NOME_PJ(A.CD_CGC_TERC)']?.toLowerCase().includes(term) ||
          e['OBTER_NOME_PJ(CD_CGC_TERC)']?.toLowerCase().includes(term);

        // Filtros estruturados
        const matchesPropriedade = !selectedPropriedade || e.PROPRIEDADE?.trim() === selectedPropriedade;
        const matchesLocalizacao = selectedLocalizacoes.length === 0 || 
          (e.LOCALIZACAO && selectedLocalizacoes.includes(e.LOCALIZACAO.trim()));
        const matchesCategoria = selectedCategorias.length === 0 || 
          (e.DS_CATEGORIA && selectedCategorias.includes(e.DS_CATEGORIA.trim()));
        const matchesFornecedor = selectedFornecedores.length === 0 || 
          (() => {
            const forn = e.FORNECEDOR || e.fornecedor || e['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || e['OBTER_NOME_PJ(CD_CGC_TERC)'];
            return !!forn && selectedFornecedores.includes(forn.trim());
          })();

        // Filtro de Mês/Ano de Fim de Contrato
        let matchesGarantia = true;
        if (selectedMonth !== null) {
          if (e.FIM_CONTRATO) {
            const dateParts = e.FIM_CONTRATO.split('-');
            if (dateParts.length >= 2) {
              const year = parseInt(dateParts[0], 10);
              const month = parseInt(dateParts[1], 10) - 1; // 0-indexed
              if (year !== selectedYear || month !== selectedMonth) {
                matchesGarantia = false;
              }
            } else {
              const date = new Date(e.FIM_CONTRATO);
              const year = date.getFullYear();
              const month = date.getMonth();
              if (year !== selectedYear || month !== selectedMonth) {
                matchesGarantia = false;
              }
            }
          } else {
            matchesGarantia = false;
          }
        }

        return matchesSearch && matchesPropriedade && matchesLocalizacao && matchesCategoria && matchesFornecedor && matchesGarantia;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // Trata nulos
        if (valA === null || valA === undefined) return sortDirection === 'asc' ? 1 : -1;
        if (valB === null || valB === undefined) return sortDirection === 'asc' ? -1 : 1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortDirection === 'asc' 
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        return 0;
      });
  }, [equipamentos, searchTerm, selectedPropriedade, selectedLocalizacoes, selectedCategorias, selectedFornecedores, selectedMonth, selectedYear, sortField, sortDirection]);

  // Estatísticas / KPIs calculadas dinamicamente com base nos dados filtrados
  const stats = useMemo(() => {
    const total = filteredAndSortedEquipamentos.length;
    const proprios = filteredAndSortedEquipamentos.filter(e => e.PROPRIEDADE === 'Próprio').length;
    const terceiros = filteredAndSortedEquipamentos.filter(e => e.PROPRIEDADE === 'Terceiros').length;
    const emRede = filteredAndSortedEquipamentos.filter(e => e.IP && e.IP.trim() !== '').length;
    const comAnydesk = filteredAndSortedEquipamentos.filter(e => e.ANYDESK && e.ANYDESK.trim() !== '').length;

    return { total, proprios, terceiros, emRede, comAnydesk };
  }, [filteredAndSortedEquipamentos]);

  // Paginação
  const paginatedEquipamentos = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedEquipamentos.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedEquipamentos, currentPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedEquipamentos.length / itemsPerPage));

  // Funções Auxiliares
  const handleCopyAnydesk = (anydeskId: string) => {
    navigator.clipboard.writeText(anydeskId);
    setCopiedAnydesk(true);
    setTimeout(() => setCopiedAnydesk(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Não definida';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('pt-BR').format(d);
    } catch {
      return dateStr;
    }
  };

  // Exportar Excel (CSV com BOM UTF-8 totalmente compatível com Excel + Cabeçalho de Filtros)
  const handleExportExcel = () => {
    if (filteredAndSortedEquipamentos.length === 0) return;

    // Detalhes dos Filtros Ativos para o Cabeçalho
    const filtrosAplicados: string[] = [];
    if (searchTerm) filtrosAplicados.push(`Busca: "${searchTerm}"`);
    if (selectedPropriedade) filtrosAplicados.push(`Propriedade: ${selectedPropriedade}`);
    if (selectedCategorias.length > 0) filtrosAplicados.push(`Categorias: ${selectedCategorias.join(', ')}`);
    if (selectedFornecedores.length > 0) filtrosAplicados.push(`Fornecedores: ${selectedFornecedores.join(', ')}`);
    if (selectedLocalizacoes.length > 0) filtrosAplicados.push(`Setores: ${selectedLocalizacoes.join(', ')}`);
    if (selectedMonth !== null) filtrosAplicados.push(`Período: ${months[selectedMonth]} / ${selectedYear}`);

    const dataEmissao = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());

    const metaHeaderRows = [
      `"SANTA CASA DE MISERICÓRDIA DE PELOTAS - HSC"`,
      `"RELATÓRIO DE EQUIPAMENTOS DE T.I."`,
      `"Gerado em: ${dataEmissao}"`,
      `"Total de Registros: ${filteredAndSortedEquipamentos.length}"`,
      `"Filtros Aplicados: ${filtrosAplicados.length > 0 ? filtrosAplicados.join(' | ') : 'Nenhum (Todos os registros)'}"`,
      `""`
    ];

    const headers = [
      'Seq',
      'Equipamento',
      'Patrimônio',
      'Tipo',
      'Categoria',
      'Propriedade',
      'Fornecedor',
      'Início Contrato',
      'Fim Contrato',
      'Localização / Setor',
      'IP',
      'AnyDesk',
      'Processador',
      'Memória',
      'Observação / Tensão'
    ];

    const rows = filteredAndSortedEquipamentos.map(e => {
      const forn = e.FORNECEDOR || e.fornecedor || e['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || e['OBTER_NOME_PJ(CD_CGC_TERC)'] || '';
      return [
        e.NR_SEQUENCIA || '',
        e.DS_EQUIPAMENTO || '',
        e.PATRIMONIO || '',
        e.TIPO || '',
        e.DS_CATEGORIA || '',
        e.PROPRIEDADE || '',
        forn,
        e.INICIO_CONTRATO ? formatDate(e.INICIO_CONTRATO) : '',
        e.FIM_CONTRATO ? formatDate(e.FIM_CONTRATO) : '',
        e.LOCALIZACAO || '',
        e.IP || '',
        e.ANYDESK || '',
        e.PROCESSADOR || '',
        e.MEMORIA || '',
        e.DS_OBSERVACAO_TENSAO || ''
      ];
    });

    const csvContent = 
      '\uFEFF' + 
      [
        ...metaHeaderRows,
        headers.join(';'), 
        ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'))
      ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('href', url);
    link.setAttribute('download', `Relatorio_Equipamentos_TI_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Exportar PDF
  const handleExportPDF = async () => {
    if (filteredAndSortedEquipamentos.length === 0) return;

    setIsExportingPdf(true);
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4');

      // Tentar adicionar logo do HSC
      try {
        const imgObj = new Image();
        imgObj.src = '/LOGO_HSC_PRIMARY.png';
        await new Promise((resolve) => {
          imgObj.onload = resolve;
          imgObj.onerror = resolve;
        });
        doc.addImage(imgObj, 'PNG', 14, 10, 45, 12);
      } catch (e) {
        console.error('Erro ao carregar logo para o PDF:', e);
      }

      // Cabeçalho do Documento com cores do Hospital Santa Casa (#5A1010 / RGB: 90, 16, 16)
      doc.setFontSize(16);
      doc.setTextColor(90, 16, 16); // Vermelho Institucional HSC
      doc.setFont('helvetica', 'bold');
      doc.text('Relatório de Equipamentos de T.I.', 14, 28);

      // Linha decorativa no tom vermelho do hospital
      doc.setDrawColor(90, 16, 16);
      doc.setLineWidth(0.6);
      doc.line(14, 31, 283, 31);

      // Data de emissão e estatísticas
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      const dataEmissao = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      }).format(new Date());
      doc.text(`Gerado em: ${dataEmissao}`, 283, 16, { align: 'right' });
      doc.text(`Total de registros: ${filteredAndSortedEquipamentos.length}`, 283, 22, { align: 'right' });

      // Detalhes dos Filtros Ativos
      const filtrosAplicados: string[] = [];
      if (searchTerm) filtrosAplicados.push(`Busca: "${searchTerm}"`);
      if (selectedPropriedade) filtrosAplicados.push(`Propriedade: ${selectedPropriedade}`);
      if (selectedCategorias.length > 0) filtrosAplicados.push(`Categorias: ${selectedCategorias.join(', ')}`);
      if (selectedFornecedores.length > 0) filtrosAplicados.push(`Fornecedores: ${selectedFornecedores.join(', ')}`);
      if (selectedLocalizacoes.length > 0) filtrosAplicados.push(`Setores: ${selectedLocalizacoes.join(', ')}`);
      if (selectedMonth !== null) filtrosAplicados.push(`Período: ${months[selectedMonth]} / ${selectedYear}`);

      let startY = 37;
      if (filtrosAplicados.length > 0) {
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        const txtFiltros = `Filtros aplicados: ${filtrosAplicados.join(' | ')}`;
        const splitFiltros = doc.splitTextToSize(txtFiltros, 269);
        doc.text(splitFiltros, 14, startY);
        startY += (splitFiltros.length * 4.5) + 2;
      }

      // Tabela com autoTable nas cores do hospital (#5A1010)
      const tableHeaders = [
        ['Seq', 'Equipamento', 'Patrimônio', 'Tipo', 'Categoria', 'Propriedade', 'Fornecedor', 'Local / Setor', 'IP', 'AnyDesk', 'Fim Contrato']
      ];

      const tableRows = filteredAndSortedEquipamentos.map(e => {
        const forn = e.FORNECEDOR || e.fornecedor || e['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || e['OBTER_NOME_PJ(CD_CGC_TERC)'] || '-';
        return [
          e.NR_SEQUENCIA ? String(e.NR_SEQUENCIA) : '-',
          e.DS_EQUIPAMENTO || '-',
          e.PATRIMONIO || '-',
          e.TIPO || '-',
          e.DS_CATEGORIA || '-',
          e.PROPRIEDADE || '-',
          forn,
          e.LOCALIZACAO || '-',
          e.IP || '-',
          e.ANYDESK || '-',
          e.FIM_CONTRATO ? formatDate(e.FIM_CONTRATO) : '-'
        ];
      });

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: startY,
        theme: 'striped',
        headStyles: {
          fillColor: [90, 16, 16], // Vermelho Institucional HSC #5A1010
          textColor: [255, 255, 255],
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [51, 65, 85]
        },
        alternateRowStyles: {
          fillColor: [253, 242, 242] // Tom suave avermelhado de fundo alternado
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 20 },
          3: { cellWidth: 18 },
          4: { cellWidth: 26 },
          5: { cellWidth: 20 },
          6: { cellWidth: 38 },
          7: { cellWidth: 35 },
          8: { cellWidth: 22 },
          9: { cellWidth: 20 },
          10: { cellWidth: 20 }
        },
        margin: { top: 15, right: 14, bottom: 15, left: 14 },
        didDrawPage: (data) => {
          const str = `Página ${data.pageNumber} de ${doc.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(str, 283, 200, { align: 'right' });
          doc.text('Santa Casa de Misericórdia de Pelotas - HSC', 14, 200);
        }
      });

      const today = new Date().toISOString().split('T')[0];
      doc.save(`Relatorio_Equipamentos_TI_${today}.pdf`);
    } catch (err) {
      console.error('Erro ao gerar PDF de equipamentos:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <div className="flex-1 space-y-8 min-h-screen pb-12 w-full mx-auto pt-4 animate-in fade-in duration-300">
      {/* Header Geral com Filtros Inline Compactos */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" />
            Equipamentos de T.I.
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            Gestão, controle patrimonial e indicadores.
          </p>
        </div>

        {/* Painel de Filtros Inline */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* 1. Busca rápida */}
          <div className="relative w-full sm:w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Pesquisa rápida..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-background border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all h-[34px]"
            />
          </div>

          {/* 3. Categoria (Multi-seleção Checkbox) */}
          <div className="relative w-full sm:w-40 categoria-dropdown-container">
            <button
              type="button"
              onClick={() => setIsCategoriaDropdownOpen(!isCategoriaDropdownOpen)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground text-left flex justify-between items-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
            >
              <span className="truncate max-w-[85%]">
                {selectedCategorias.length === 0
                  ? 'Categorias'
                  : selectedCategorias.length === 1
                  ? selectedCategorias[0]
                  : `${selectedCategorias.length} selecionadas`}
              </span>
              <ChevronRight className={`h-3 w-3 transform transition-transform text-muted-foreground ${isCategoriaDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {isCategoriaDropdownOpen && (
              <div className="absolute top-[100%] left-0 right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-lg py-1.5 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex flex-col px-1">
                  {filterOptions.categorias.map(cat => {
                    const isChecked = selectedCategorias.includes(cat);
                    return (
                      <label
                        key={cat}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-xs transition-colors select-none font-medium text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedCategorias(prev => prev.filter(c => c !== cat));
                            } else {
                              setSelectedCategorias(prev => [...prev, cat]);
                            }
                            setCurrentPage(1);
                          }}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="truncate">{cat}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Fornecedor (Multi-seleção Checkbox) */}
          <div className="relative w-full sm:w-44 fornecedor-dropdown-container">
            <button
              type="button"
              onClick={() => setIsFornecedorDropdownOpen(!isFornecedorDropdownOpen)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground text-left flex justify-between items-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
            >
              <span className="truncate max-w-[85%]">
                {selectedFornecedores.length === 0
                  ? 'Fornecedores'
                  : selectedFornecedores.length === 1
                  ? selectedFornecedores[0]
                  : `${selectedFornecedores.length} selecionados`}
              </span>
              <ChevronRight className={`h-3 w-3 transform transition-transform text-muted-foreground ${isFornecedorDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {isFornecedorDropdownOpen && (
              <div className="absolute top-[100%] left-0 right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-lg py-1.5 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150 min-w-[200px]">
                <div className="flex flex-col px-1">
                  {filterOptions.fornecedores.map(forn => {
                    const isChecked = selectedFornecedores.includes(forn);
                    return (
                      <label
                        key={forn}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-xs transition-colors select-none font-medium text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedFornecedores(prev => prev.filter(f => f !== forn));
                            } else {
                              setSelectedFornecedores(prev => [...prev, forn]);
                            }
                            setCurrentPage(1);
                          }}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="truncate" title={forn}>{forn}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Propriedade */}
          <select
            value={selectedPropriedade}
            onChange={(e) => {
              setSelectedPropriedade(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full sm:w-32 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
          >
            <option value="">Propriedades</option>
            {filterOptions.propriedades.map(prop => (
              <option key={prop} value={prop}>{prop}</option>
            ))}
          </select>

          {/* 5. Localização / Setor (Multi-seleção Checkbox) */}
          <div className="relative w-full sm:w-40 localizacao-dropdown-container">
            <button
              type="button"
              onClick={() => setIsLocalizacaoDropdownOpen(!isLocalizacaoDropdownOpen)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground text-left flex justify-between items-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
            >
              <span className="truncate max-w-[85%]">
                {selectedLocalizacoes.length === 0
                  ? 'Setores'
                  : selectedLocalizacoes.length === 1
                  ? selectedLocalizacoes[0]
                  : `${selectedLocalizacoes.length} selecionadas`}
              </span>
              <ChevronRight className={`h-3 w-3 transform transition-transform text-muted-foreground ${isLocalizacaoDropdownOpen ? 'rotate-90' : ''}`} />
            </button>

            {isLocalizacaoDropdownOpen && (
              <div className="absolute top-[100%] left-0 right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-lg py-1.5 max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="flex flex-col px-1">
                  {filterOptions.localizacoes.map(loc => {
                    const isChecked = selectedLocalizacoes.includes(loc);
                    return (
                      <label
                        key={loc}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-muted rounded cursor-pointer text-xs transition-colors select-none font-medium text-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedLocalizacoes(prev => prev.filter(l => l !== loc));
                            } else {
                              setSelectedLocalizacoes(prev => [...prev, loc]);
                            }
                            setCurrentPage(1);
                          }}
                          className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="truncate">{loc}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 6. Filtro de Mês/Ano do Contrato */}
          <div className="relative w-full sm:w-48 datepicker-dropdown-container">
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground text-left flex justify-between items-center focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-medium h-[34px]"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {selectedMonth !== null
                  ? `${months[selectedMonth]} ${selectedYear}`
                  : 'Todos os Períodos'}
              </span>
              <ChevronRight className={`h-3 w-3 transform transition-transform text-muted-foreground ${isDatePickerOpen ? 'rotate-90' : ''}`} />
            </button>

            {isDatePickerOpen && (
              <div className="absolute top-[100%] right-0 z-20 mt-1 bg-card border border-border rounded-lg shadow-lg p-3 w-64 animate-in fade-in slide-in-from-top-1 duration-150">
                {/* Cabeçalho do Ano */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <button
                    type="button"
                    onClick={() => setSelectedYear(prev => prev - 1)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-foreground">{selectedYear}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedYear(prev => prev + 1)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Grade de Meses */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {months.map((m, idx) => {
                    const isSelected = selectedMonth === idx;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setSelectedMonth(idx);
                          setIsDatePickerOpen(false);
                          setCurrentPage(1);
                        }}
                        className={`py-1.5 text-2xs font-semibold rounded-md transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>

                {/* Botão Todos os Períodos */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(null);
                    setIsDatePickerOpen(false);
                    setCurrentPage(1);
                  }}
                  className="w-full py-1.5 text-2xs font-bold text-center border border-border rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  Todos os Períodos
                </button>
              </div>
            )}
          </div>

          {/* Botão de Limpar Filtros */}
          {(searchTerm || selectedPropriedade || selectedLocalizacoes.length > 0 || selectedCategorias.length > 0 || selectedFornecedores.length > 0 || selectedMonth !== null) && (
            <button
              onClick={handleResetFilters}
              title="Limpar Filtros"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20 text-xs font-semibold transition-colors h-[34px]"
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </button>
          )}

          {/* Botão de Atualizar Dados */}
          <button
            onClick={() => loadData(true)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border text-xs font-medium disabled:opacity-50 h-[34px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Atualizando...' : 'Atualizar'}
          </button>

          {/* Separador */}
          <div className="h-4 w-px bg-border/60 mx-0.5 hidden sm:block" />

          {/* Botões de Exportação Relatório (Excel / PDF) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportExcel}
              disabled={isLoading || filteredAndSortedEquipamentos.length === 0}
              title="Exportar relatório em Excel (CSV) com os dados filtrados"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed h-[34px]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isLoading || isExportingPdf || filteredAndSortedEquipamentos.length === 0}
              title="Exportar relatório em PDF com os dados filtrados"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed h-[34px]"
            >
              {isExportingPdf ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600 dark:text-rose-400" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              )}
              <span>{isExportingPdf ? 'Gerando...' : 'PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Seção 1: Indicadores (KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Total Geral" 
          value={stats.total} 
          icon={Laptop} 
          subtext="🖥️ Equipamentos cadastrados" 
          subtextColorClass="text-slate-500 dark:text-slate-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Próprios" 
          value={stats.proprios} 
          icon={ShieldCheck} 
          subtext="🛡️ Patrimônio da Santa Casa" 
          subtextColorClass="text-emerald-600 dark:text-emerald-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="De Terceiros" 
          value={stats.terceiros} 
          icon={Building2} 
          subtext="🏢 Locados / Fornecedores" 
          subtextColorClass="text-amber-600 dark:text-amber-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Em Rede" 
          value={stats.emRede} 
          icon={Network} 
          subtext="🌐 Possuem IP configurado" 
          subtextColorClass="text-sky-600 dark:text-sky-400"
        />
        <VisaoGeralCard 
          isLoading={isLoading} 
          title="Com AnyDesk" 
          value={stats.comAnydesk} 
          icon={Monitor} 
          subtext="⚡ Acesso remoto configurado" 
          subtextColorClass="text-purple-600 dark:text-purple-400"
        />
      </div>

      {/* Seção 3: Tabela */}
      <div className="bg-card text-card-foreground rounded-xl border border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">Buscando equipamentos...</p>
          </div>
        ) : filteredAndSortedEquipamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center px-4">
            <Info className="h-10 w-10 text-muted-foreground" />
            <h3 className="font-semibold text-foreground text-lg">Nenhum equipamento encontrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Não foram encontrados equipamentos para a combinação de filtros selecionada. Tente redefinir os filtros.
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 font-medium text-muted-foreground">
                    <th 
                      onClick={() => handleSort('NR_SEQUENCIA')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Seq {sortField === 'NR_SEQUENCIA' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('DS_EQUIPAMENTO')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Equipamento {sortField === 'DS_EQUIPAMENTO' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('TIPO')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Tipo {sortField === 'TIPO' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('DS_CATEGORIA')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Categoria {sortField === 'DS_CATEGORIA' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('PROPRIEDADE')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Propriedade {sortField === 'PROPRIEDADE' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('FORNECEDOR' as any)} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Fornecedor {sortField === 'FORNECEDOR' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('FIM_CONTRATO')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Fim do Contrato {sortField === 'FIM_CONTRATO' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('LOCALIZACAO')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      Localização {sortField === 'LOCALIZACAO' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      onClick={() => handleSort('IP')} 
                      className="px-6 py-3.5 cursor-pointer hover:text-foreground transition-colors select-none"
                    >
                      IP {sortField === 'IP' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paginatedEquipamentos.map((eq) => (
                    <tr 
                      key={eq.NR_SEQUENCIA}
                      className="hover:bg-muted/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedEquipamento(eq)}
                    >
                      <td className="px-6 py-4 font-mono font-medium text-xs text-muted-foreground">
                        {eq.NR_SEQUENCIA}
                      </td>
                      <td className="px-6 py-4 font-semibold text-foreground">
                        {eq.DS_EQUIPAMENTO}
                        {eq.PATRIMONIO && (
                          <span className="block text-xs font-normal text-muted-foreground mt-0.5">
                            Patr: {eq.PATRIMONIO}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          eq.TIPO?.trim() === 'Hardware' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                            : 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                        }`}>
                          {eq.TIPO}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-[150px] truncate" title={eq.DS_CATEGORIA || ''}>
                        {eq.DS_CATEGORIA || <span className="text-muted-foreground/45">—</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          eq.PROPRIEDADE?.trim() === 'Próprio' 
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                        }`}>
                          {eq.PROPRIEDADE}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs font-medium whitespace-normal break-words max-w-[240px]">
                        {eq.FORNECEDOR || eq.fornecedor || eq['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || eq['OBTER_NOME_PJ(CD_CGC_TERC)'] || <span className="text-muted-foreground/45">—</span>}
                      </td>
                      <td className="px-6 py-4 font-medium text-foreground text-xs">
                        {eq.FIM_CONTRATO ? formatDate(eq.FIM_CONTRATO) : <span className="text-muted-foreground/45">—</span>}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground max-w-[200px] truncate" title={eq.LOCALIZACAO}>
                        {eq.LOCALIZACAO}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-foreground">
                        {eq.IP || <span className="text-muted-foreground/45">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Rodapé e Paginação */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/50 px-6 py-4 gap-4 bg-muted/20">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium">
                  Exibindo {paginatedEquipamentos.length} de {filteredAndSortedEquipamentos.length} equipamentos
                </span>

                <div className="flex items-center gap-1.5 border-l border-border/60 pl-3">
                  <button
                    onClick={handleExportExcel}
                    disabled={isLoading || filteredAndSortedEquipamentos.length === 0}
                    title="Exportar dados filtrados do grid para Excel (CSV)"
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-2xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FileSpreadsheet className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Excel</span>
                  </button>

                  <button
                    onClick={handleExportPDF}
                    disabled={isLoading || isExportingPdf || filteredAndSortedEquipamentos.length === 0}
                    title="Exportar relatório PDF com os dados filtrados do grid"
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-2xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isExportingPdf ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-rose-600 dark:text-rose-400" />
                    ) : (
                      <FileText className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    )}
                    <span>{isExportingPdf ? 'Gerando...' : 'PDF'}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                
                <span className="text-xs font-semibold px-3 py-1.5 rounded-md border border-border bg-background min-w-[70px] text-center">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Equipamento */}
      {selectedEquipamento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col scale-in animate-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-border/60 p-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/10 text-primary">
                    # {selectedEquipamento.NR_SEQUENCIA}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                    selectedEquipamento.TIPO?.trim() === 'Hardware' 
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' 
                      : 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300'
                  }`}>
                    {selectedEquipamento.TIPO}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold ${
                    selectedEquipamento.PROPRIEDADE?.trim() === 'Próprio' 
                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' 
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
                  }`}>
                    {selectedEquipamento.PROPRIEDADE}
                  </span>
                  {selectedEquipamento.DS_CATEGORIA && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-2xs font-semibold bg-secondary text-secondary-foreground border border-border">
                      {selectedEquipamento.DS_CATEGORIA}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-foreground">
                  {selectedEquipamento.DS_EQUIPAMENTO}
                </h3>
              </div>
              <button
                onClick={() => setSelectedEquipamento(null)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Conteúdo Modal */}
            <div className="p-6 space-y-6">
              {/* Informações Básicas Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                  <Database className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Patrimônio</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {selectedEquipamento.PATRIMONIO || 'Não informado'}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Localização / Setor</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">
                      {selectedEquipamento.LOCALIZACAO || 'Não informada'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Informações de Rede e Conectividade */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1">
                  Rede e Suporte
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Endereço IP */}
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">Endereço IP</span>
                      </div>
                    </div>
                    <p className="text-base font-mono font-medium text-foreground">
                      {selectedEquipamento.IP || 'Sem IP atribuído'}
                    </p>
                  </div>

                  {/* AnyDesk */}
                  <div className="p-4 rounded-lg bg-muted/40 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Laptop className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-foreground">AnyDesk</span>
                      </div>
                      {selectedEquipamento.ANYDESK && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyAnydesk(selectedEquipamento.ANYDESK!)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-all"
                            title="Copiar ID"
                          >
                            {copiedAnydesk ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          <a
                            href={`anydesk:${selectedEquipamento.ANYDESK.replace(/\s+/g, '')}`}
                            className="p-1 rounded hover:bg-secondary text-primary hover:text-primary/80 transition-all"
                            title="Conectar"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                    <p className="text-base font-mono font-medium text-foreground">
                      {selectedEquipamento.ANYDESK || 'Não cadastrado'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Especificações de Hardware */}
              {(selectedEquipamento.PROCESSADOR || selectedEquipamento.MEMORIA) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1">
                    Especificações Técnicas
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEquipamento.PROCESSADOR && (
                      <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                        <Cpu className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Processador</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {selectedEquipamento.PROCESSADOR}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedEquipamento.MEMORIA && (
                      <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex items-start gap-3">
                        <Database className="h-5 w-5 text-primary/75 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Memória RAM</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">
                            {selectedEquipamento.MEMORIA}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Informações de Contrato (Se houver ou se for Terceirizado) */}
              {(selectedEquipamento.PROPRIEDADE === 'Terceiros' || selectedEquipamento.INICIO_CONTRATO) && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1">
                    Informações do Contrato / Proprietário
                  </h4>
                  <div className="space-y-3">
                    <div className="p-4 rounded-lg bg-muted/40 border border-border/30 flex flex-col gap-3">
                      <div>
                        <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Proprietário / Fornecedor</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">
                          {selectedEquipamento['OBTER_NOME_PJ(CD_CGC_TERC)'] || selectedEquipamento['OBTER_NOME_PJ(A.CD_CGC_TERC)'] || 'Não informado'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border/40 pt-3 mt-1">
                        <div className="flex items-center gap-2.5">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Início do Contrato</p>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              {formatDate(selectedEquipamento.INICIO_CONTRATO)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-2xs font-bold text-muted-foreground uppercase tracking-wider">Fim do Contrato</p>
                            <p className="text-xs font-semibold text-foreground mt-0.5">
                              {formatDate(selectedEquipamento.FIM_CONTRATO)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações / Tensão */}
              {selectedEquipamento.DS_OBSERVACAO_TENSAO && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/35 pb-1 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Observações e Licenciamento
                  </h4>
                  <div className="p-4 rounded-lg bg-amber-50/10 border border-amber-500/20 text-sm text-foreground flex gap-3">
                    <FileText className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed font-medium">
                      {selectedEquipamento.DS_OBSERVACAO_TENSAO}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="border-t border-border/60 p-4 bg-muted/20 flex justify-end">
              <button
                onClick={() => setSelectedEquipamento(null)}
                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border text-sm font-semibold transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
