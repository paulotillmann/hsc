import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Stethoscope, DollarSign, Users, FileText, Search, Plus, 
  FileSpreadsheet, RefreshCw, Calendar, Edit3, Trash2, Building2,
  ChevronRight, ArrowUpRight, Check, AlertCircle, Sparkles,
  Download, FileCheck, Layers, Eye, Wrench, Construction, ArrowLeft, ShieldAlert, Clock
} from 'lucide-react';
import { 
  repasseService, 
  RepasseCompetencia, 
  RepasseItem, 
  ReferenciaOpcao 
} from '../../../services/repasseService';
import { DetalhamentoSetorModal } from './DetalhamentoSetorModal';
import { ImportarExcelModal } from './ImportarExcelModal';
import { NovoItemModal } from './NovoItemModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  const clean = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

// Dados padrão do Print para inicialização imediata caso a tabela esteja vazia
const SEED_PRINT_ITENS: Array<Partial<RepasseItem>> = [
  { tipo: 'profissional', descricao: 'ADELIO DE LIMA DIAS', valor_bruto: 18.00, valor_liquido: 18.00 },
  { tipo: 'profissional', descricao: 'AMANDA CRISTINA GONÇALVES GOMES SOUSA', valor_bruto: 721.13, valor_liquido: 721.13 },
  { tipo: 'profissional', descricao: 'ANDRE RESENDE RODRIGUES DA CUNHA SEPULVE', valor_bruto: 101.25, valor_liquido: 101.25 },
  { tipo: 'profissional', descricao: 'ARIANE FRANCIS SOARES CHAGAS', valor_bruto: 405.00, valor_liquido: 405.00 },
  { tipo: 'profissional', descricao: 'BIANCA CHRISTINA RIBEIRO REZENDE', valor_bruto: 1491.75, valor_liquido: 1491.75 },
  { tipo: 'profissional', descricao: 'BIANCA VELOSO VIDAL DE OLIVEIRA', valor_bruto: 202.50, valor_liquido: 202.50 },
  { tipo: 'profissional', descricao: 'CAMILLA STEFANI DE OLIVEIRA', valor_bruto: 223.88, valor_liquido: 223.88 },
  { tipo: 'profissional', descricao: 'CAROLINE GABRIELE FERREIRA SANTOS', valor_bruto: 721.13, valor_liquido: 721.13 },
  { tipo: 'profissional', descricao: 'CAROLINE OLIVEIRA VILLARES', valor_bruto: 131.63, valor_liquido: 131.63 },
  { tipo: 'profissional', descricao: 'CECILIA FERREIRA DA CUNHA ANDRADE', valor_bruto: 382.50, valor_liquido: 382.50 },
  { tipo: 'profissional', descricao: 'CINTIA DA SILVA FERNANDES', valor_bruto: 1890.00, valor_liquido: 1890.00 },
  { tipo: 'profissional', descricao: 'DANDHARA SANTOS DAMIAO', valor_bruto: 447.75, valor_liquido: 447.75 },
  { tipo: 'profissional', descricao: 'DANIEL FERREIRA MOREIRA', valor_bruto: 6975.00, valor_liquido: 6975.00 },
  { tipo: 'profissional', descricao: 'GEORGEANA DEBS GUESINE', valor_bruto: 3020.85, valor_liquido: 3020.85 },
  { tipo: 'profissional', descricao: 'GIOVANNA GOBBI OBALHE', valor_bruto: 101.25, valor_liquido: 101.25 },
  { tipo: 'profissional', descricao: 'GUILHERME PEREIRA FIGUEIREDO', valor_bruto: 472.50, valor_liquido: 472.50 },
  { tipo: 'profissional', descricao: 'HELOISA DAVANSO DE SOUZA', valor_bruto: 2250.00, valor_liquido: 2250.00 },
  { tipo: 'profissional', descricao: 'ISABELA GOMES MALDI', valor_bruto: 1310.18, valor_liquido: 1310.18 },
  { tipo: 'profissional', descricao: 'ISABELLA MORAIS ARANTES DE OLIVEIRA', valor_bruto: 141.75, valor_liquido: 141.75 },
  { tipo: 'profissional', descricao: 'IVANA ALVES BEN', valor_bruto: 2404.30, valor_liquido: 2404.30 },
  { tipo: 'profissional', descricao: 'JOAO MARCOS DE ARAUJO CAMARGOS', valor_bruto: 101.25, valor_liquido: 101.25 },
  { tipo: 'profissional', descricao: 'JOAO RIBEIRO DE MATTOS NETO', valor_bruto: 761.27, valor_liquido: 761.27 },
  { tipo: 'profissional', descricao: 'JOAO VICTOR SILVEIRA MACHADO DE CAMPOS', valor_bruto: 2531.25, valor_liquido: 2531.25 },
  { tipo: 'profissional', descricao: 'JOSE LUIZ DA SILVA NETO', valor_bruto: 320.63, valor_liquido: 320.63 },
  { tipo: 'profissional', descricao: 'JOSE PAULO OLIVEIRA SILVEIRA', valor_bruto: 810.00, valor_liquido: 810.00 },
  { tipo: 'profissional', descricao: 'JUHLY SEVERINO DOS SANTOS', valor_bruto: 303.75, valor_liquido: 303.75 },
  { tipo: 'profissional', descricao: 'KARINE BISINOTO FERNANDES', valor_bruto: 497.25, valor_liquido: 497.25 },
  { tipo: 'profissional', descricao: 'KELVYN LUCAS SANTOS ZANETTI', valor_bruto: 810.00, valor_liquido: 810.00 },
  { tipo: 'profissional', descricao: 'LAURA DE PADUA SANTOS', valor_bruto: 994.50, valor_liquido: 994.50 },
  { tipo: 'profissional', descricao: 'LETICIA MAIA E CRUZ', valor_bruto: 1636.88, valor_liquido: 1636.88 },
  { tipo: 'profissional', descricao: 'MAURICIO BRAZ DA SILVA JUNIOR', valor_bruto: 497.25, valor_liquido: 497.25 },
  { tipo: 'profissional', descricao: 'NATALIA TALITA LELES COSTA', valor_bruto: 830.25, valor_liquido: 830.25 },
  { tipo: 'profissional', descricao: 'PAULO DOS REIS VELASCO', valor_bruto: 101.25, valor_liquido: 101.25 },
  { tipo: 'setor', descricao: 'PEDIATRIA', valor_bruto: 8212.50, desconto_percentual: 10, desconto_valor: 821.25, valor_liquido: 7391.25, possui_detalhes: true },
  { tipo: 'profissional', descricao: 'REINALDO FRANCISCO DOS SANTOS JUNIOR', valor_bruto: 1535.63, valor_liquido: 1535.63 },
  { tipo: 'profissional', descricao: 'RENATO MASON RODRIGUES DA CUNHA', valor_bruto: 1068.75, valor_liquido: 1068.75 },
  { tipo: 'profissional', descricao: 'ROGERIO DA CRUZ CUNHA', valor_bruto: 911.25, valor_liquido: 911.25 },
  { tipo: 'profissional', descricao: 'SERGIO DE OLIVEIRA CUNHA JUNIOR', valor_bruto: 1046.25, valor_liquido: 1046.25 },
  { tipo: 'profissional', descricao: 'THALES SOUZA CAMPOS RODRIGUES', valor_bruto: 787.50, valor_liquido: 787.50 },
  { tipo: 'setor', descricao: 'UTI ADULTO I', valor_bruto: 9452.50, desconto_percentual: 10, desconto_valor: 945.25, valor_liquido: 8507.25, possui_detalhes: true },
  { tipo: 'setor', descricao: 'UTI ADULTO II', valor_bruto: 1990.00, desconto_percentual: 10, desconto_valor: 199.00, valor_liquido: 1791.00, possui_detalhes: true },
  { tipo: 'setor', descricao: 'UTI NEONATAL', valor_bruto: 40297.50, desconto_percentual: 10, desconto_valor: 4029.75, valor_liquido: 36267.75, possui_detalhes: true }
];

const SEED_UTI_ADULTO_I_DETALHES = [
  { paciente: 'FREIDEL ALEXIS RODRIGUES BERIA', procedimento: 'ATENDIMENTO DO INTENSIVISTA', data_procedimento: '2026-04-28', quantidade: 6, valor_total: 1492.50, ordem: 1 },
  { paciente: 'GERALDA LOURDES DA COSTA RODRIGUES', procedimento: 'ATENDIMENTO DO INTENSIVISTA', data_procedimento: '2026-05-14', quantidade: 14, valor_total: 3482.50, ordem: 2 },
  { paciente: 'FILIPE RODRIGUES DE OLIVEIRA', procedimento: 'ATENDIMENTO DO INTENSIVISTA', data_procedimento: '2026-05-15', quantidade: 7, valor_total: 1741.25, ordem: 3 },
  { paciente: 'BRUNO HENRIQUE IZIDORO DE AGUIAR', procedimento: 'ATENDIMENTO DO INTENSIVISTA', data_procedimento: '2026-04-30', quantidade: 3, valor_total: 746.25, ordem: 4 },
  { paciente: 'JACINTO PIMENTA DE FIGUEIREDO JUNIOR', procedimento: 'ATENDIMENTO DO INTENSIVISTA', data_procedimento: '2026-05-22', quantidade: 6, valor_total: 1492.50, ordem: 5 },
  { paciente: 'MATHEUS MEIRA CARDOSO', procedimento: 'ATENDIMENTO DO INTENSIVISTA', data_procedimento: '2026-06-24', quantidade: 2, valor_total: 497.50, ordem: 6 }
];

const RepassesMedicos: React.FC = () => {
  // Estados da Competência e Filtros
  const [convenio, setConvenio] = useState<string>('UNIMED');
  const [competenciaStr, setCompetenciaStr] = useState<string>('07-2026');
  const [competenciasList, setCompetenciasList] = useState<RepasseCompetencia[]>([]);
  const [competenciaAtual, setCompetenciaAtual] = useState<RepasseCompetencia | null>(null);

  // Estados dos Itens e Listagens
  const [itens, setItens] = useState<RepasseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'profissional' | 'setor'>('todos');

  // Metadados Médicos e Setores
  const [medicosDisponiveis, setMedicosDisponiveis] = useState<ReferenciaOpcao[]>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<ReferenciaOpcao[]>([]);

  // Estados de Modais
  const [detalheModalOpen, setDetalheModalOpen] = useState<boolean>(false);
  const [itemParaDetalhe, setItemParaDetalhe] = useState<RepasseItem | null>(null);

  const [importarModalOpen, setImportarModalOpen] = useState<boolean>(false);

  const [novoItemModalOpen, setNovoItemModalOpen] = useState<boolean>(false);
  const [itemParaEdicao, setItemParaEdicao] = useState<RepasseItem | null>(null);

  // Edição rápida de Nota Fiscal
  const [isEditingNF, setIsEditingNF] = useState<boolean>(false);
  const [inputNFNum, setInputNFNum] = useState<string>('');
  const [inputNFVal, setInputNFVal] = useState<string>('');

  // 1. Carregamento inicial de competências e opções
  const carregarDadosIniciais = useCallback(async () => {
    setLoading(true);
    try {
      // Carrega referências
      const { medicos, setores } = await repasseService.carregarMedicosESetoresDisponiveis();
      setMedicosDisponiveis(medicos);
      setSetoresDisponiveis(setores);

      // Carrega ou obtém competência atual
      const comp = await repasseService.obterOuCriarCompetencia(convenio, competenciaStr);
      setCompetenciaAtual(comp);
      setInputNFNum(comp.numero_nota_fiscal || '');
      setInputNFVal(comp.valor_nota_fiscal ? comp.valor_nota_fiscal.toString() : '');

      // Carrega itens da competência
      let itensList = await repasseService.listarItens(comp.id);

      // Se a competência for a inicial do print e estiver vazia, inicializa com o exemplo
      if (itensList.length === 0 && competenciaStr === '07-2026' && convenio === 'UNIMED') {
        await repasseService.salvarItensLote(comp.id, SEED_PRINT_ITENS);
        itensList = await repasseService.listarItens(comp.id);

        // Preenche detalhamento da UTI ADULTO I
        const utiAdultoI = itensList.find(i => i.descricao.toUpperCase() === 'UTI ADULTO I');
        if (utiAdultoI) {
          await repasseService.salvarDetalhesLote(utiAdultoI, SEED_UTI_ADULTO_I_DETALHES, 10);
          itensList = await repasseService.listarItens(comp.id);
        }

        if (!comp.numero_nota_fiscal) {
          const updatedComp = await repasseService.salvarCompetencia(comp.id, {
            numero_nota_fiscal: '64296',
            valor_nota_fiscal: 539766.53
          });
          setCompetenciaAtual(updatedComp);
          setInputNFNum('64296');
          setInputNFVal('539766.53');
        }
      }

      setItens(itensList);
    } catch (err) {
      console.error('Erro ao carregar dados de repasses:', err);
    } finally {
      setLoading(false);
    }
  }, [convenio, competenciaStr]);

  useEffect(() => {
    carregarDadosIniciais();
  }, [carregarDadosIniciais]);

  // Recarregar itens quando houver alteração
  const recarregarItens = async () => {
    if (!competenciaAtual) return;
    try {
      const updated = await repasseService.listarItens(competenciaAtual.id);
      setItens(updated);
    } catch (e) {
      console.error(e);
    }
  };

  // Salvar edição da Nota Fiscal
  const handleSalvarNotaFiscal = async () => {
    if (!competenciaAtual) return;
    try {
      const updated = await repasseService.salvarCompetencia(competenciaAtual.id, {
        numero_nota_fiscal: inputNFNum.trim(),
        valor_nota_fiscal: parseCurrency(inputNFVal)
      });
      setCompetenciaAtual(updated);
      setIsEditingNF(false);
    } catch (e) {
      console.error('Erro ao salvar nota fiscal:', e);
    }
  };

  // Excluir item do resumo
  const handleExcluirItem = async (item: RepasseItem) => {
    if (!competenciaAtual) return;
    if (!window.confirm(`Tem certeza que deseja excluir o lançamento de ${item.descricao}?`)) return;

    try {
      await repasseService.excluirItem(item.id, competenciaAtual.id);
      setItens(prev => prev.filter(i => i.id !== item.id));
    } catch (e) {
      console.error(e);
    }
  };

  // Cálculos consolidados
  const totalRepassesLiquido = useMemo(() => {
    return itens.reduce((acc, curr) => acc + (Number(curr.valor_liquido) || 0), 0);
  }, [itens]);

  const totalProfissionais = useMemo(() => {
    return itens.filter(i => i.tipo === 'profissional').length;
  }, [itens]);

  const totalSetores = useMemo(() => {
    return itens.filter(i => i.tipo === 'setor').length;
  }, [itens]);

  const valorNotaFiscal = competenciaAtual?.valor_nota_fiscal || 0;
  const diferencaNF = valorNotaFiscal - totalRepassesLiquido;

  // Itens filtrados para a tabela
  const itensFiltrados = useMemo(() => {
    return itens.filter(i => {
      const matchSearch = i.descricao.toLowerCase().includes(searchTerm.toLowerCase());
      const matchTipo = filtroTipo === 'todos' ? true : i.tipo === filtroTipo;
      return matchSearch && matchTipo;
    });
  }, [itens, searchTerm, filtroTipo]);

  // Exportar PDF no formato Santa Casa
  const handleExportarPDF = () => {
    const doc = new jsPDF();

    // Cabeçalho Santa Casa
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text('SANTA CASA DE MISERICÓRDIA DE ARAGUARI', 14, 18);

    doc.setFontSize(12);
    doc.setTextColor(71, 85, 105);
    doc.text(`Resumo de Repasse ${convenio} - Competência ${competenciaStr}`, 14, 26);

    doc.setFontSize(10);
    doc.text(
      `Nº NOTA FISCAL: ${competenciaAtual?.numero_nota_fiscal || 'N/A'}  |  Valor da NF: ${formatCurrency(valorNotaFiscal)}`,
      14,
      33
    );

    const tableData = itens.map((it, idx) => [
      idx + 1,
      it.tipo === 'setor' ? `[SETOR] ${it.descricao}` : it.descricao,
      formatCurrency(it.valor_liquido)
    ]);

    // Linha de total
    tableData.push([
      '',
      'TOTAL REPASSES',
      formatCurrency(totalRepassesLiquido)
    ]);

    autoTable(doc, {
      startY: 38,
      head: [['#', 'PROFISSIONAL / SETOR', 'VALOR']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [40, 50, 70], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 45, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.row.index === tableData.length - 1) {
          data.cell.styles.fillColor = [240, 243, 246];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    doc.save(`Repasse_${convenio}_${competenciaStr}.pdf`);
  };

  // Flag de módulo em produção / implantação
  const [emProducao, setEmProducao] = useState<boolean>(true);

  if (emProducao) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full min-h-[70vh] flex items-center justify-center p-4 sm:p-8 font-sans"
      >
        <div className="max-w-xl w-full bg-card border border-border/80 rounded-2xl p-8 sm:p-10 shadow-lg text-center space-y-6 relative overflow-hidden">
          {/* Faixa decorativa superior */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-[#8a1515] to-rose-600" />

          {/* Ícone com pulso */}
          <div className="relative inline-flex items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner">
              <Construction className="w-10 h-10 animate-bounce" style={{ animationDuration: '2.5s' }} />
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500"></span>
            </span>
          </div>

          {/* Textos Informativos */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
              <Clock className="w-3.5 h-3.5" />
              Em Fase de Produção / Homologação
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Repasses Médicos e Convênios
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
              Esta página e os módulos de fechamento de competências, auditoria e detalhamento de repasses estão atualmente em fase de produção e implantação no sistema.
            </p>
          </div>

          {/* Card com aviso adicional */}
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-left flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">Aviso aos Usuários</p>
              <p>
                O acesso às tabelas e relatórios de repasses estará disponível para consulta e lançamentos em breve, após a conclusão dos testes de segurança e validação com o faturamento.
              </p>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-card border border-border hover:bg-muted text-foreground transition-all shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar à página anterior</span>
            </button>

            {/* Acesso rápido para desenvolvimento / testes caso necessário */}
            <button
              type="button"
              onClick={() => setEmProducao(false)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all cursor-pointer"
              title="Permite visualizar a tela em desenvolvimento"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Acessar Prévia (Desenvolvedor)</span>
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 w-full px-4 sm:px-8 max-w-none pb-14"
    >
      {/* ── HEADER PRINCIPAL ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-xs">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground font-sans">
                Repasses Médicos e Convênios
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Ativo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Gestão, fechamento de competências, auditoria e detalhamento de honorários
            </p>
          </div>
        </div>

        {/* Seletores de Convênio, Competência e Ações */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Seletor de Convênio */}
          <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Convênio:</span>
            <select
              value={convenio}
              onChange={(e) => setConvenio(e.target.value)}
              className="bg-transparent font-semibold text-foreground text-xs focus:outline-none cursor-pointer"
            >
              <option value="UNIMED">UNIMED</option>
              <option value="IPSEMG">IPSEMG</option>
              <option value="CASSI">CASSI</option>
              <option value="BRADESCO">BRADESCO SAÚDE</option>
              <option value="PARTICULAR">PARTICULAR</option>
            </select>
          </div>

          {/* Seletor de Competência */}
          <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Comp.:</span>
            <input
              type="text"
              value={competenciaStr}
              onChange={(e) => setCompetenciaStr(e.target.value)}
              placeholder="MM-AAAA"
              className="w-20 bg-transparent font-mono font-bold text-foreground text-xs focus:outline-none"
            />
          </div>

          {/* Botões de Ação */}
          <button
            type="button"
            onClick={() => {
              setItemParaEdicao(null);
              setNovoItemModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-primary text-white hover:bg-primary/90 shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Lançamento
          </button>

          <button
            type="button"
            onClick={() => setImportarModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-600/20 shadow-xs transition-colors"
            title="Importar lista do Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Importar Excel
          </button>

          <button
            type="button"
            onClick={handleExportarPDF}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-2xs"
            title="Exportar Relatório em PDF"
          >
            <Download className="w-3.5 h-3.5 text-muted-foreground" />
            PDF
          </button>

          <button
            type="button"
            onClick={carregarDadosIniciais}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── CARDS DE RESUMO (PRINT 2: NF, TOTAIS E SALDO) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Valor da Nota Fiscal */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Nota Fiscal do Convênio</span>
            <button
              type="button"
              onClick={() => setIsEditingNF(!isEditingNF)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Editar dados da NF"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {isEditingNF ? (
            <div className="space-y-2 mt-1">
              <div>
                <label className="text-[10px] text-muted-foreground">Nº da NF:</label>
                <input
                  type="text"
                  value={inputNFNum}
                  onChange={(e) => setInputNFNum(e.target.value)}
                  placeholder="Ex: 64296"
                  className="w-full px-2 py-1 text-xs border rounded bg-background font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Valor da NF (R$):</label>
                <input
                  type="text"
                  value={inputNFVal}
                  onChange={(e) => setInputNFVal(e.target.value)}
                  placeholder="539766,53"
                  className="w-full px-2 py-1 text-xs border rounded bg-background font-mono font-bold"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingNF(false)}
                  className="px-2 py-0.5 text-[10px] border rounded text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSalvarNotaFiscal}
                  className="px-2.5 py-0.5 text-[10px] bg-primary text-white rounded font-medium"
                >
                  Salvar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="text-2xl font-extrabold text-foreground font-mono">
                {formatCurrency(valorNotaFiscal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <span className="font-semibold text-foreground">NF Nº:</span> 
                <span className="font-mono">{competenciaAtual?.numero_nota_fiscal || 'Não informada'}</span>
              </p>
            </>
          )}
        </div>

        {/* Card 2: Total de Repasses Calculado */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total a Repassar</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
            {formatCurrency(totalRepassesLiquido)}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Soma dos {itens.length} lançamentos da competência
          </p>
        </div>

        {/* Card 3: Saldo / Retenção Hospitalar */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Saldo da Nota Fiscal</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground font-mono">
            {formatCurrency(diferencaNF)}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Margem / Taxa retida no hospital
          </p>
        </div>

        {/* Card 4: Quantidade de Profissionais e Setores */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Destinatários</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <span>{totalProfissionais}</span>
            <span className="text-xs font-normal text-muted-foreground">médicos</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{totalSetores}</span>
            <span className="text-xs font-normal text-muted-foreground">setores</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Totalizando {itens.length} beneficiários vinculados
          </p>
        </div>
      </div>

      {/* ── TABELA CONSOLIDADA DE REPASSES (PRINT 2) ── */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        {/* Barra superior de busca e filtros */}
        <div className="px-6 py-4 border-b border-border/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h2 className="text-base font-bold text-foreground">
              Resumo de Repasse {convenio} — Competência {competenciaStr}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Filtro Tipo */}
            <div className="flex items-center rounded-xl bg-background border border-border p-1 text-xs">
              <button
                type="button"
                onClick={() => setFiltroTipo('todos')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filtroTipo === 'todos' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todos ({itens.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('profissional')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filtroTipo === 'profissional' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Médicos ({totalProfissionais})
              </button>
              <button
                type="button"
                onClick={() => setFiltroTipo('setor')}
                className={`px-3 py-1 rounded-lg font-medium transition-all ${
                  filtroTipo === 'setor' ? 'bg-primary text-white shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Setores ({totalSetores})
              </button>
            </div>

            {/* Busca textual */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar médico ou setor..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Conteúdo da Tabela */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-muted-foreground space-y-3">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Carregando repasses da competência...</span>
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30 text-primary" />
            <p className="text-sm font-medium">Nenhum lançamento encontrado nesta competência.</p>
            <p className="text-xs">Clique em "Novo Lançamento" ou "Importar Excel" para começar.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase tracking-wider text-[11px] border-b border-border">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4 w-32">Tipo</th>
                  <th className="py-3 px-4">Profissional / Setor</th>
                  <th className="py-3 px-4 w-44 text-center">Detalhamento</th>
                  <th className="py-3 px-4 w-40 text-right">Valor Repasse (R$)</th>
                  <th className="py-3 px-4 w-28 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {itensFiltrados.map((item, idx) => {
                  const isSetor = item.tipo === 'setor';
                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-muted/30 transition-colors ${
                        isSetor ? 'bg-amber-500/5 dark:bg-amber-500/10 font-medium' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center text-muted-foreground font-mono text-[11px]">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-4">
                        {isSetor ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Building2 className="w-3 h-3" />
                            SETOR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            <Stethoscope className="w-3 h-3" />
                            MÉDICO
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground uppercase tracking-tight">
                            {item.descricao}
                          </span>
                          {item.possui_detalhes && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                              Auditado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {isSetor || item.possui_detalhes ? (
                          <button
                            type="button"
                            onClick={() => {
                              setItemParaDetalhe(item);
                              setDetalheModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Pacientes / Produção
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setItemParaDetalhe(item);
                              setDetalheModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground hover:underline"
                          >
                            + Detalhar
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground text-sm">
                        {formatCurrency(item.valor_liquido)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setItemParaEdicao(item);
                              setNovoItemModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Editar lançamento"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExcluirItem(item)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Linha de Totalizador Fixo no Rodapé da Tabela (Print 2: TOTAL 92.914,51) */}
              <tfoot className="bg-muted/80 font-bold border-t-2 border-border text-foreground">
                <tr>
                  <td colSpan={4} className="py-3 px-6 text-sm tracking-wide uppercase text-right sm:text-left">
                    TOTAL GERAL DE REPASSES
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-base font-extrabold text-primary">
                    {formatCurrency(totalRepassesLiquido)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── MODAIS INTEGRADOS ── */}
      {/* 1. Modal de Detalhamento por Setor/Pacientes (Print 1) */}
      <DetalhamentoSetorModal
        isOpen={detalheModalOpen}
        onClose={() => {
          setDetalheModalOpen(false);
          setItemParaDetalhe(null);
        }}
        item={itemParaDetalhe}
        convenio={convenio}
        competencia={competenciaStr}
        onItemUpdated={(itemAtualizado) => {
          setItens(prev => prev.map(i => i.id === itemAtualizado.id ? itemAtualizado : i));
        }}
      />

      {/* 2. Modal de Importação em Lote do Excel (Print 2) */}
      {competenciaAtual && (
        <ImportarExcelModal
          isOpen={importarModalOpen}
          onClose={() => setImportarModalOpen(false)}
          competenciaId={competenciaAtual.id}
          setoresDisponiveis={setoresDisponiveis}
          medicosDisponiveis={medicosDisponiveis}
          onImportado={recarregarItens}
        />
      )}

      {/* 3. Modal de Novo/Editar Item */}
      {competenciaAtual && (
        <NovoItemModal
          isOpen={novoItemModalOpen}
          onClose={() => {
            setNovoItemModalOpen(false);
            setItemParaEdicao(null);
          }}
          competenciaId={competenciaAtual.id}
          itemParaEdicao={itemParaEdicao}
          medicosDisponiveis={medicosDisponiveis}
          setoresDisponiveis={setoresDisponiveis}
          onSalvo={(salvo) => {
            setItens(prev => {
              const idx = prev.findIndex(i => i.id === salvo.id);
              if (idx !== -1) {
                const copy = [...prev];
                copy[idx] = salvo;
                return copy;
              }
              return [...prev, salvo];
            });
          }}
        />
      )}
    </motion.div>
  );
};

export default RepassesMedicos;
