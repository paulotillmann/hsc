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
  const [conveniosDisponiveis, setConveniosDisponiveis] = useState<string[]>([]);
  const [competenciaStr, setCompetenciaStr] = useState<string>('07-2026');
  const [competenciaAtual, setCompetenciaAtual] = useState<RepasseCompetencia | null>(null);

  // Estados dos Itens e Listagens
  const [itens, setItens] = useState<RepasseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'profissional' | 'setor'>('todos');

  // Metadados Médicos e Setores
  const [medicosDisponiveis, setMedicosDisponiveis] = useState<ReferenciaOpcao[]>([]);
  const [setoresDisponiveis, setSetoresDisponiveis] = useState<ReferenciaOpcao[]>([]);

  // Estados da Barra de Inserção Rápida
  const [novoTipo, setNovoTipo] = useState<'profissional' | 'setor'>('profissional');
  const [novoItemSelecionado, setNovoItemSelecionado] = useState<string>('');
  const [novoValorBruto, setNovoValorBruto] = useState<string>('');
  const [novoDescontoPerc, setNovoDescontoPerc] = useState<number>(0);
  const [inserindoRapido, setInserindoRapido] = useState<boolean>(false);

  // Estados de Edição Inline na Grid
  const [salvandoItemId, setSalvandoItemId] = useState<string | null>(null);
  const [sucessoItemId, setSucessoItemId] = useState<string | null>(null);

  // Estados de Modais
  const [detalheModalOpen, setDetalheModalOpen] = useState<boolean>(false);
  const [itemParaDetalhe, setItemParaDetalhe] = useState<RepasseItem | null>(null);

  const [importarModalOpen, setImportarModalOpen] = useState<boolean>(false);

  const [novoItemModalOpen, setNovoItemModalOpen] = useState<boolean>(false);
  const [itemParaEdicao, setItemParaEdicao] = useState<RepasseItem | null>(null);

  // Estado de exportação do PDF
  const [exportandoPdf, setExportandoPdf] = useState<boolean>(false);

  // Edição rápida de Nota Fiscal
  const [isEditingNF, setIsEditingNF] = useState<boolean>(false);
  const [inputNFNum, setInputNFNum] = useState<string>('');
  const [inputNFVal, setInputNFVal] = useState<string>('');

  // Formatação de data padrão brasileiro (DD/MM/AAAA)
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '';
    const clean = String(dateStr).trim().slice(0, 10);
    if (clean.includes('-')) {
      const parts = clean.split('-');
      if (parts.length === 3 && parts[0].length === 4) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return clean;
  };

  // 1. Carregamento inicial de referências e convênios
  useEffect(() => {
    const carregarReferencias = async () => {
      try {
        const [refData, convList] = await Promise.all([
          repasseService.carregarMedicosESetoresDisponiveis(),
          repasseService.carregarConveniosDisponiveis()
        ]);
        setMedicosDisponiveis(refData.medicos);
        setSetoresDisponiveis(refData.setores);
        setConveniosDisponiveis(convList);
      } catch (e) {
        console.error('Erro ao carregar referências de médicos/setores/convênios:', e);
      }
    };
    carregarReferencias();
  }, []);

  // 2. Carregamento da competência atual e itens
  const carregarDadosCompetencia = useCallback(async () => {
    setLoading(true);
    try {
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
    carregarDadosCompetencia();
  }, [carregarDadosCompetencia]);

  // Recarregar itens quando houver alteração externa
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

  // Adicionar item rapidamente via formulário da barra
  const handleAdicionarRapido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!competenciaAtual || !novoItemSelecionado.trim()) return;

    const nomeFormatado = novoItemSelecionado.trim().toUpperCase();

    // Verifica se já está na lista
    const jaExiste = itens.some(i => i.descricao.toUpperCase() === nomeFormatado);
    if (jaExiste) {
      alert(`O médico/setor "${nomeFormatado}" já está presente nesta planilha de repasse.`);
      return;
    }

    setInserindoRapido(true);
    try {
      const list = novoTipo === 'profissional' ? medicosDisponiveis : setoresDisponiveis;
      const refEncontrada = list.find(x => x.nome.toUpperCase() === nomeFormatado);

      const numBruto = parseCurrency(novoValorBruto);
      const numPerc = novoTipo === 'setor' && novoDescontoPerc === 0 ? 10 : novoDescontoPerc;
      const descValor = Number((numBruto * (numPerc / 100)).toFixed(2));
      const valorLiquido = Number((numBruto - descValor).toFixed(2));

      const payload: Partial<RepasseItem> = {
        competencia_id: competenciaAtual.id,
        tipo: novoTipo,
        descricao: nomeFormatado,
        medico_id: novoTipo === 'profissional' ? (refEncontrada?.id || null) : null,
        setor_id: novoTipo === 'setor' ? (refEncontrada?.id || null) : null,
        valor_bruto: numBruto,
        desconto_percentual: numPerc,
        desconto_valor: descValor,
        valor_liquido: valorLiquido,
        possui_detalhes: false,
        ordem: itens.length + 1
      };

      const salvo = await repasseService.salvarItem(payload);
      setItens(prev => [...prev, salvo]);

      // Limpar campos
      setNovoItemSelecionado('');
      setNovoValorBruto('');
      if (novoTipo === 'profissional') {
        setNovoDescontoPerc(0);
      } else {
        setNovoDescontoPerc(10);
      }

      setSucessoItemId(salvo.id);
      setTimeout(() => setSucessoItemId(null), 2500);
    } catch (err) {
      console.error('Erro ao adicionar rapidamente:', err);
      alert('Não foi possível adicionar o médico/setor. Tente novamente.');
    } finally {
      setInserindoRapido(false);
    }
  };

  // Edição inline de valores na tabela
  const handleAtualizarCampoItem = async (itemId: string, campo: 'valor_bruto' | 'desconto_percentual', novoValor: any) => {
    const itemAtual = itens.find(i => i.id === itemId);
    if (!itemAtual) return;

    let bruto = itemAtual.valor_bruto;
    let perc = itemAtual.desconto_percentual;

    if (campo === 'valor_bruto') {
      bruto = parseCurrency(novoValor);
    } else if (campo === 'desconto_percentual') {
      perc = Number(novoValor) || 0;
    }

    const descValor = Number((bruto * (perc / 100)).toFixed(2));
    const liquido = Number((bruto - descValor).toFixed(2));

    // Atualização otimista na interface
    setItens(prev => prev.map(it => {
      if (it.id === itemId) {
        return {
          ...it,
          valor_bruto: bruto,
          desconto_percentual: perc,
          desconto_valor: descValor,
          valor_liquido: liquido
        };
      }
      return it;
    }));

    // Persiste no Supabase / Local
    setSalvandoItemId(itemId);
    try {
      await repasseService.salvarItem({
        id: itemId,
        competencia_id: itemAtual.competencia_id,
        tipo: itemAtual.tipo,
        descricao: itemAtual.descricao,
        valor_bruto: bruto,
        desconto_percentual: perc,
        desconto_valor: descValor,
        valor_liquido: liquido,
        possui_detalhes: itemAtual.possui_detalhes
      });

      setSucessoItemId(itemId);
      setTimeout(() => setSucessoItemId(null), 2000);
    } catch (err) {
      console.error('Erro ao salvar item inline:', err);
    } finally {
      setSalvandoItemId(null);
    }
  };

  // Excluir item do resumo
  const handleExcluirItem = async (item: RepasseItem) => {
    if (!competenciaAtual) return;
    if (!window.confirm(`Tem certeza que deseja remover "${item.descricao}" da planilha?`)) return;

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

  // Médicos ou setores disponíveis ainda não adicionados à planilha para facilitar seleção
  const opcoesDisponiveisParaAdicionar = useMemo(() => {
    const list = novoTipo === 'profissional' ? medicosDisponiveis : setoresDisponiveis;
    const jaAdicionados = new Set(itens.map(i => i.descricao.toUpperCase().trim()));
    return list.filter(op => !jaAdicionados.has(op.nome.toUpperCase().trim()));
  }, [novoTipo, medicosDisponiveis, setoresDisponiveis, itens]);

  // Exportar PDF no formato oficial Santa Casa com Resumo e Detalhamento de Produção dos Setores
  const handleExportarPDF = async () => {
    try {
      setExportandoPdf(true);
      const doc = new jsPDF();

      // ── 1. LOGO OFICIAL HSC E CABEÇALHO INSTITUCIONAL ──
      try {
        const imgObj = new Image();
        imgObj.src = '/LOGO_HSC_PRIMARY.png';
        await new Promise((resolve) => {
          imgObj.onload = resolve;
          imgObj.onerror = resolve;
        });
        doc.addImage(imgObj, 'PNG', 14, 10, 45, 12);
      } catch (e) {
        console.error('Erro ao carregar logo do HSC:', e);
      }

      doc.setFontSize(15);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0);
      doc.text(`Resumo de Repasse ${convenio} - Competência ${competenciaStr}`, 14, 29);

      // ── 2. DADOS FILTRADOS CONFORME A VISUALIZAÇÃO ATIVA NA PLANILHA ──
      const itensParaExportar = itensFiltrados;
      const totalFiltradoLiquido = itensParaExportar.reduce(
        (acc, curr) => acc + (Number(curr.valor_liquido) || 0),
        0
      );

      // Metadados dos filtros ativos
      const filtrosDesc: string[] = [];
      if (filtroTipo === 'profissional') filtrosDesc.push('Exibindo: Apenas Médicos');
      if (filtroTipo === 'setor') filtrosDesc.push('Exibindo: Apenas Setores');
      if (searchTerm.trim()) filtrosDesc.push(`Busca: "${searchTerm.trim()}"`);
      const textoFiltros = filtrosDesc.length > 0 ? `  |  ${filtrosDesc.join(' | ')}` : '';

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(
        `Nº NOTA FISCAL: ${competenciaAtual?.numero_nota_fiscal || 'N/A'}  |  Valor da NF: ${formatCurrency(valorNotaFiscal)}  |  Data de Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}${textoFiltros}`,
        14,
        35
      );

      // Linhas da tabela
      const tableData = itensParaExportar.map((it, idx) => [
        idx + 1,
        it.tipo === 'setor' ? `[SETOR] ${it.descricao}` : it.descricao,
        formatCurrency(it.valor_bruto),
        `${it.desconto_percentual || 0}%`,
        formatCurrency(it.valor_liquido)
      ]);

      const rotuloTotal = filtroTipo === 'profissional'
        ? 'TOTAL MÉDICOS'
        : filtroTipo === 'setor'
        ? 'TOTAL SETORES'
        : 'TOTAL REPASSES';

      // Linha de total geral dos itens exibidos
      tableData.push([
        '',
        rotuloTotal,
        '',
        '',
        formatCurrency(totalFiltradoLiquido)
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['#', 'PROFISSIONAL / SETOR', 'VALOR BRUTO', 'DESC.', 'VALOR LÍQUIDO']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [90, 16, 16], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 35, halign: 'right' },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.row.index === tableData.length - 1) {
            data.cell.styles.fillColor = [248, 240, 240];
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.textColor = [90, 16, 16];
          }
        }
      });

      // ── 3. DETALHAMENTO DE PRODUÇÃO POR SETOR (Apenas dos setores presentes na listagem filtrada) ──
      const itensComSetorOuDetalhes = itensParaExportar.filter(it => it.tipo === 'setor' || it.possui_detalhes);

      if (itensComSetorOuDetalhes.length > 0) {
        // Carrega todos os detalhes de produção dos setores filtrados
        const detalhesCarregados = await Promise.all(
          itensComSetorOuDetalhes.map(async (it) => {
            const detalhes = await repasseService.listarDetalhes(it.id);
            return { item: it, detalhes };
          })
        );

        for (const { item: it, detalhes } of detalhesCarregados) {
          if (!detalhes || detalhes.length === 0) continue;

          let lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 40;
          // Se o espaço restante for insuficiente, quebra para nova página
          if (lastY + 55 > 265) {
            doc.addPage();
            lastY = 18;
          } else {
            lastY += 14;
          }

          // Título e identificação do Setor
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(90, 16, 16);
          doc.text(`Detalhamento de Produção — ${it.descricao.toUpperCase()}`, 14, lastY);

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100);
          doc.text(
            `Setor: ${it.descricao}  |  Desconto Contratual: ${it.desconto_percentual || 0}%  |  Qtd. de Procedimentos: ${detalhes.length}`,
            14,
            lastY + 5
          );

          // Linhas dos procedimentos do paciente
          const sectorBody = detalhes.map((d, dIdx) => [
            dIdx + 1,
            (d.paciente || '').toUpperCase(),
            (d.procedimento || 'ATENDIMENTO DO INTENSIVISTA').toUpperCase(),
            formatDateBR(d.data_procedimento),
            Number(d.quantidade) || 1,
            formatCurrency(Number(d.valor_total) || 0)
          ]);

          // Linhas de fechamento contábil do setor
          sectorBody.push([
            '',
            `SUBTOTAL BRUTO (${it.descricao})`,
            '',
            '',
            '',
            formatCurrency(it.valor_bruto)
          ]);

          if ((it.desconto_percentual || 0) > 0 || (it.desconto_valor || 0) > 0) {
            sectorBody.push([
              '',
              `DESCONTO (${it.desconto_percentual || 0}%)`,
              '',
              '',
              '',
              `- ${formatCurrency(it.desconto_valor)}`
            ]);
          }

          sectorBody.push([
            '',
            `TOTAL LÍQUIDO DO SETOR`,
            '',
            '',
            '',
            formatCurrency(it.valor_liquido)
          ]);

          const numTotais = ((it.desconto_percentual || 0) > 0 || (it.desconto_valor || 0) > 0) ? 3 : 2;

          autoTable(doc, {
            startY: lastY + 9,
            head: [['#', 'PACIENTE', 'PROCEDIMENTO', 'DATA', 'QTD', 'VALOR TOTAL']],
            body: sectorBody,
            theme: 'grid',
            headStyles: { fillColor: [90, 16, 16], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            bodyStyles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 'auto' },
              2: { cellWidth: 55 },
              3: { cellWidth: 22, halign: 'center' },
              4: { cellWidth: 12, halign: 'center' },
              5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' }
            },
            didParseCell: (data) => {
              if (data.row.index >= sectorBody.length - numTotais) {
                data.cell.styles.fillColor = [248, 240, 240];
                data.cell.styles.fontStyle = 'bold';
                if (data.row.index === sectorBody.length - 1) {
                  data.cell.styles.textColor = [90, 16, 16];
                }
              }
            }
          });
        }
      }

      // ── 4. NUMERAÇÃO DE PÁGINAS E RODAPÉ OFICIAL HSC ──
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        // Linha divisória fina no rodapé
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.3);
        doc.line(14, 283, 196, 283);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(130);
        doc.text(
          `Santa Casa de Misericórdia de Araguari • HSC Sistemas • Página ${i} de ${totalPages}`,
          14,
          288
        );
        doc.text(
          `Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          196,
          288,
          { align: 'right' }
        );
      }

      const prefixoArquivo = filtroTipo === 'profissional'
        ? 'Repasse_Medicos'
        : filtroTipo === 'setor'
        ? 'Repasse_Setores'
        : 'Repasse';
      doc.save(`${prefixoArquivo}_${convenio}_${competenciaStr}.pdf`);
    } catch (err: any) {
      console.error('Erro ao gerar PDF detalhado:', err);
      alert('Erro ao exportar PDF: ' + (err.message || 'Verifique o console'));
    } finally {
      setExportandoPdf(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 w-full px-4 sm:px-8 max-w-none pb-14 font-sans"
    >
      {/* ── HEADER PRINCIPAL ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-xs">
            <Stethoscope className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Repasses Médicos e Convênios
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Planilha Inteligente
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Lançamentos operacionais de honorários, auditoria por setor e conferência de notas fiscais
            </p>
          </div>
        </div>

        {/* Seletores de Convênio, Competência e Ações */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Seletor de Convênio Dinâmico */}
          <div className="flex items-center gap-1.5 bg-card border border-border px-3 py-1.5 rounded-xl shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase">Convênio:</span>
            <select
              value={convenio}
              onChange={(e) => setConvenio(e.target.value)}
              className="bg-transparent font-semibold text-foreground text-xs focus:outline-none cursor-pointer"
            >
              {conveniosDisponiveis.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              {!conveniosDisponiveis.includes(convenio) && (
                <option value={convenio}>{convenio}</option>
              )}
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-card border border-border text-foreground hover:bg-muted shadow-xs transition-colors"
            title="Formulário completo com mais detalhes"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            Lançamento Completo
          </button>


          <button
            type="button"
            onClick={handleExportarPDF}
            disabled={exportandoPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            title="Exportar Relatório em PDF com Resumo e Detalhamento de Produção"
          >
            {exportandoPdf ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-primary" />
                <span>PDF Detalhado</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={carregarDadosCompetencia}
            className="p-2 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── CARDS DE RESUMO (NF, TOTAIS E RETENÇÃO) ── */}
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
            <span className="text-[11px] font-semibold uppercase tracking-wider">Saldo / Retenção HSC</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground font-mono">
            {formatCurrency(diferencaNF)}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Margem hospitalar restante da nota
          </p>
        </div>

        {/* Card 4: Quantidade de Profissionais e Setores */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Destinatários na Folha</span>
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

      {/* ── BARRA DE SELEÇÃO & PREENCHIMENTO RÁPIDO DO MÉDICO (BARRA OPERACIONAL) ── */}
      <div className="bg-card border-2 border-primary/20 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <span className="text-sm font-bold text-foreground">
              Adicionar Médico ou Setor à Planilha de Repasse
            </span>
            <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
              (Selecione no filtro abaixo para iniciar o preenchimento)
            </span>
          </div>

          {/* Alternador Médico / Setor */}
          <div className="flex items-center bg-muted/60 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => {
                setNovoTipo('profissional');
                setNovoItemSelecionado('');
                setNovoDescontoPerc(0);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                novoTipo === 'profissional'
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              Médico / Profissional ({medicosDisponiveis.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setNovoTipo('setor');
                setNovoItemSelecionado('');
                setNovoDescontoPerc(10);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all ${
                novoTipo === 'setor'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Setor / UTI ({setoresDisponiveis.length})
            </button>
          </div>
        </div>

        {/* Formulário Inline de Inserção */}
        <form onSubmit={handleAdicionarRapido} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          {/* Campo de Seleção / Autocomplete */}
          <div className="sm:col-span-6">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              {novoTipo === 'profissional' ? 'Selecione o Médico:' : 'Selecione o Setor:'}
            </label>
            <div className="relative">
              <input
                type="text"
                list="lista-opcoes-rapidas"
                value={novoItemSelecionado}
                onChange={(e) => setNovoItemSelecionado(e.target.value)}
                placeholder={novoTipo === 'profissional' ? 'Digite ou selecione o nome do médico...' : 'Digite ou selecione o setor (Ex: UTI ADULTO I)...'}
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground font-semibold uppercase focus:ring-2 focus:ring-primary outline-none"
                required
              />
              <datalist id="lista-opcoes-rapidas">
                {opcoesDisponiveisParaAdicionar.map((op, idx) => (
                  <option key={op.id || idx} value={op.nome} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Campo Valor Bruto */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Valor Bruto (R$):
            </label>
            <input
              type="text"
              value={novoValorBruto}
              onChange={(e) => setNovoValorBruto(e.target.value)}
              placeholder="0,00"
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background font-mono font-bold text-foreground focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          {/* Campo Desconto / Retenção % */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Retenção (%):
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={novoDescontoPerc}
              onChange={(e) => setNovoDescontoPerc(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background font-mono text-foreground focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          {/* Botão de Inserir */}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={inserindoRapido || !novoItemSelecionado.trim()}
              className="w-full py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {inserindoRapido ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Adicionar Linha</span>
            </button>
          </div>
        </form>
      </div>

      {/* ── TABELA OPERACIONAL DE REPASSES (GRID EDITÁVEL TIPO PLANILHA) ── */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        {/* Barra superior de busca e filtros */}
        <div className="px-6 py-4 border-b border-border/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground">
              Planilha de Lançamentos — {convenio} ({competenciaStr})
            </h2>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-mono text-muted-foreground font-semibold">
              {itens.length} linhas
            </span>
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
                placeholder="Filtrar médico ou setor..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>
        </div>

        {/* Conteúdo da Grid */}
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-muted-foreground space-y-3">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Carregando planilha de repasses...</span>
          </div>
        ) : itensFiltrados.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground space-y-2">
            <FileSpreadsheet className="w-10 h-10 mx-auto opacity-30 text-primary" />
            <p className="text-sm font-medium">Nenhum médico ou setor inserido nesta competência.</p>
            <p className="text-xs">Utilize a barra acima para selecionar um médico e adicionar à planilha.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/60 text-muted-foreground font-semibold uppercase tracking-wider text-[11px] border-b border-border">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-28">Tipo</th>
                  <th className="py-3 px-4 min-w-[240px]">Profissional / Setor</th>
                  <th className="py-3 px-3 w-40 text-center">Detalhamento</th>
                  <th className="py-3 px-3 w-36 text-right">Valor Bruto (R$)</th>
                  <th className="py-3 px-2 w-20 text-center">Desc. (%)</th>
                  <th className="py-3 px-3 w-28 text-right">Retenção (R$)</th>
                  <th className="py-3 px-4 w-36 text-right">Líquido Repasse (R$)</th>
                  <th className="py-3 px-2 w-16 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {itensFiltrados.map((item, idx) => {
                  const isSetor = item.tipo === 'setor';
                  const isSaving = salvandoItemId === item.id;
                  const isSuccess = sucessoItemId === item.id;

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-muted/30 transition-colors ${
                        isSetor ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                      } ${isSuccess ? 'bg-emerald-500/10 transition-all' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-center text-muted-foreground font-mono text-[11px]">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-3">
                        {isSetor ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            <Building2 className="w-3 h-3" />
                            SETOR
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
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
                          {isSaving && (
                            <RefreshCw className="w-3 h-3 animate-spin text-primary shrink-0" />
                          )}
                          {isSuccess && (
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          )}
                          {item.possui_detalhes && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-medium border border-primary/20">
                              Auditado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isSetor || item.possui_detalhes ? (
                          <button
                            type="button"
                            onClick={() => {
                              setItemParaDetalhe(item);
                              setDetalheModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20"
                          >
                            <Eye className="w-3 h-3" />
                            Ver Produção
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

                      {/* Célula Editável: Valor Bruto */}
                      <td className="py-1.5 px-3 text-right">
                        <input
                          type="text"
                          defaultValue={item.valor_bruto.toFixed(2).replace('.', ',')}
                          onBlur={(e) => handleAtualizarCampoItem(item.id, 'valor_bruto', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-full text-right font-mono font-bold text-foreground bg-background hover:bg-muted/40 focus:bg-background px-2 py-1 rounded border border-transparent hover:border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          title="Clique para editar o valor bruto diretamente na célula"
                        />
                      </td>

                      {/* Célula Editável: Desconto % */}
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          defaultValue={item.desconto_percentual || 0}
                          onBlur={(e) => handleAtualizarCampoItem(item.id, 'desconto_percentual', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          className="w-14 text-center font-mono text-muted-foreground bg-background hover:bg-muted/40 focus:bg-background px-1 py-1 rounded border border-transparent hover:border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                          title="Percentual de retenção hospitalar"
                        />
                      </td>

                      {/* Célula Calculada: Desconto R$ */}
                      <td className="py-2.5 px-3 text-right font-mono text-muted-foreground text-xs">
                        {formatCurrency(item.desconto_valor || 0)}
                      </td>

                      {/* Célula Calculada: Líquido */}
                      <td className="py-2.5 px-4 text-right font-mono font-extrabold text-foreground text-sm">
                        {formatCurrency(item.valor_liquido)}
                      </td>

                      {/* Ações */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleExcluirItem(item)}
                          className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remover linha da planilha"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Linha de Totalizador Fixo no Rodapé */}
              <tfoot className="bg-muted/80 font-bold border-t-2 border-border text-foreground">
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-sm tracking-wide uppercase text-right sm:text-left">
                    TOTAL GERAL DE REPASSES
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-muted-foreground">
                    {formatCurrency(itens.reduce((acc, c) => acc + (c.valor_bruto || 0), 0))}
                  </td>
                  <td></td>
                  <td className="py-3 px-3 text-right font-mono text-xs text-muted-foreground">
                    {formatCurrency(itens.reduce((acc, c) => acc + (c.desconto_valor || 0), 0))}
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
      {/* 1. Modal de Detalhamento por Setor/Pacientes */}
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

      {/* 2. Modal de Importação em Lote do Excel */}
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

      {/* 3. Modal de Novo/Editar Item Completo */}
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

