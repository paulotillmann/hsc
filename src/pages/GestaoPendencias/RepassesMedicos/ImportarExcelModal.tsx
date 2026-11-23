import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileSpreadsheet,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Check,
  Stethoscope,
  Building2,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw,
  ClipboardPaste,
  FileCheck2,
  Info,
} from 'lucide-react';
import {
  ReferenciaOpcao,
  repasseService,
} from '../../../services/repasseService';
import {
  ParsedImportResult,
  ParsedRepasseGroup,
  parseRepasseFile,
  parseTabularRows,
  parseCurrencyValue,
} from '../../../services/repasseImportParser';

interface ImportarExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  competenciaId: string;
  convenioAtual: string;
  competenciaStrAtual: string;
  setoresDisponiveis: ReferenciaOpcao[];
  medicosDisponiveis: ReferenciaOpcao[];
  onImportado: (metaAtualizada?: {
    convenio?: string;
    competencia?: string;
  }) => void;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
};

const formatDateBR = (isoDate: string) => {
  if (!isoDate) return '-';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return isoDate;
};

export const ImportarExcelModal: React.FC<ImportarExcelModalProps> = ({
  isOpen,
  onClose,
  competenciaId,
  convenioAtual,
  competenciaStrAtual,
  setoresDisponiveis,
  medicosDisponiveis,
  onImportado,
}) => {
  const [abaAtiva, setAbaAtiva] = useState<'arquivo' | 'colar'>('arquivo');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [parsing, setParsing] = useState<boolean>(false);
  const [progressInfo, setProgressInfo] = useState<{ current: number; total: number; message: string } | null>(null);
  const [parsedResult, setParsedResult] = useState<ParsedImportResult | null>(null);
  const [gruposEditaveis, setGruposEditaveis] = useState<ParsedRepasseGroup[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [usarValorApresentado, setUsarValorApresentado] = useState<boolean>(false);
  const [atualizarNotaFiscal, setAtualizarNotaFiscal] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [inputText, setInputText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Lista unificada de sugestões para o autocomplete (Setores + Médicos)
  const nomesSetoresSet = useMemo(() => {
    const s = new Set<string>();
    setoresDisponiveis.forEach(item => s.add(item.nome.toUpperCase().trim()));
    [
      'UTI ADULTO I',
      'UTI ADULTO II',
      'UTI NEONATAL',
      'PEDIATRIA',
      'PRONTO ATENDIMENTO',
      'CENTRO CIRÚRGICO',
      'MATERNIDADE',
    ].forEach(n => s.add(n));
    return s;
  }, [setoresDisponiveis]);

  const processarArquivo = async (file: File) => {
    setErrorMsg(null);
    setParsing(true);
    setProgressInfo({ current: 0, total: 1, message: `Analisando arquivo "${file.name}"...` });

    try {
      const res = await parseRepasseFile(file, (info) => {
        setProgressInfo(info);
      });

      setParsedResult(res);
      setGruposEditaveis(res.grupos);
      setUsarValorApresentado(false);
      setAtualizarNotaFiscal(Boolean(res.valorNotaFiscalDetectado && res.valorNotaFiscalDetectado > 0));

      // Se houver poucos grupos ou grupos sem vínculo, expande o primeiro automaticamente
      if (res.grupos.length <= 3) {
        setExpandedGroupIds(new Set(res.grupos.map(g => g.id)));
      } else {
        setExpandedGroupIds(new Set());
      }
    } catch (err: any) {
      console.error('Erro ao analisar arquivo de repasse:', err);
      setErrorMsg('Não foi possível processar o arquivo: ' + (err.message || 'Formato inválido.'));
    } finally {
      setParsing(false);
      setProgressInfo(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processarArquivo(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processarArquivo(file);
    }
  };

  // Processar texto colado na aba Ctrl+V
  const handleProcessarTextoColado = () => {
    if (!inputText.trim()) return;
    setErrorMsg(null);
    const lines = inputText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const rows = lines.map(l => (l.includes('\t') ? l.split('\t') : l.split(';')));
    const res = parseTabularRows(rows, 'Dados Colados (Ctrl+V)');
    setParsedResult(res);
    setGruposEditaveis(res.grupos);
  };

  const toggleExpandGroup = (id: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectGroup = (id: string) => {
    setGruposEditaveis(prev =>
      prev.map(g => (g.id === id ? { ...g, selecionado: !g.selecionado } : g))
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setGruposEditaveis(prev => prev.map(g => ({ ...g, selecionado: checked })));
  };

  const handleChangeTipoGroup = (id: string, novoTipo: 'profissional' | 'setor') => {
    setGruposEditaveis(prev =>
      prev.map(g => {
        if (g.id !== id) return g;
        return {
          ...g,
          tipo: novoTipo,
          desconto_percentual: novoTipo === 'setor' && g.desconto_percentual === 0 ? 10 : novoTipo === 'profissional' && g.desconto_percentual === 10 ? 0 : g.desconto_percentual,
        };
      })
    );
  };

  const handleChangeDestinatarioGroup = (id: string, novoDestinatario: string) => {
    const upper = novoDestinatario.toUpperCase();
    const ehSetorConhecido =
      nomesSetoresSet.has(upper.trim()) ||
      upper.startsWith('UTI') ||
      upper.includes('PEDIATRIA');

    setGruposEditaveis(prev =>
      prev.map(g => {
        if (g.id !== id) return g;
        const tipoAuto = ehSetorConhecido ? 'setor' : g.tipo;
        return {
          ...g,
          destinatario: upper,
          tipo: tipoAuto,
          desconto_percentual:
            tipoAuto === 'setor' && g.desconto_percentual === 0 ? 10 : g.desconto_percentual,
        };
      })
    );
  };

  const handleChangeDescontoGroup = (id: string, novoDesc: number) => {
    setGruposEditaveis(prev =>
      prev.map(g => (g.id === id ? { ...g, desconto_percentual: novoDesc } : g))
    );
  };

  const handleChangeValorGroup = (id: string, rawVal: string) => {
    const val = parseCurrencyValue(rawVal);
    setGruposEditaveis(prev =>
      prev.map(g =>
        g.id === id
          ? {
              ...g,
              valor_bruto_aprovado: val,
              valor_bruto_apresentado: val,
            }
          : g
      )
    );
  };

  // Filtra grupos na visualização
  const gruposFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return gruposEditaveis;
    const term = searchTerm.toLowerCase();
    return gruposEditaveis.filter(
      g =>
        g.destinatario.toLowerCase().includes(term) ||
        g.detalhes.some(
          d =>
            d.paciente.toLowerCase().includes(term) ||
            d.procedimento.toLowerCase().includes(term) ||
            (d.profissional_original || '').toLowerCase().includes(term)
        )
    );
  }, [gruposEditaveis, searchTerm]);

  const gruposSelecionados = useMemo(
    () => gruposEditaveis.filter(g => g.selecionado),
    [gruposEditaveis]
  );

  const totalBrutoSelecionado = useMemo(() => {
    return gruposSelecionados.reduce(
      (acc, g) => acc + (usarValorApresentado ? g.valor_bruto_apresentado : g.valor_bruto_aprovado),
      0
    );
  }, [gruposSelecionados, usarValorApresentado]);

  const totalLiquidoSelecionado = useMemo(() => {
    return gruposSelecionados.reduce((acc, g) => {
      const bruto = usarValorApresentado ? g.valor_bruto_apresentado : g.valor_bruto_aprovado;
      const desc = Number((bruto * ((g.desconto_percentual || 0) / 100)).toFixed(2));
      return acc + Number((bruto - desc).toFixed(2));
    }, 0);
  }, [gruposSelecionados, usarValorApresentado]);

  const handleConfirmarImportacao = async () => {
    if (gruposSelecionados.length === 0) {
      setErrorMsg('Selecione ao menos um item para importar.');
      return;
    }

    // Verifica se algum item selecionado está sem destinatário preenchido
    const semDestinatario = gruposSelecionados.find(g => !g.destinatario.trim());
    if (semDestinatario) {
      setErrorMsg(
        'Há procedimentos selecionados sem Médico ou Setor informado. Selecione ou digite o nome do Médico/Setor na coluna "Destinatário (Médico / Setor)" antes de confirmar.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. Determina se devemos usar a competência atual ou criar/obter a competência detectada no arquivo
      let targetCompetenciaId = competenciaId;

      if (
        parsedResult &&
        atualizarNotaFiscal &&
        (parsedResult.valorNotaFiscalDetectado || parsedResult.numeroDocumentoDetectado)
      ) {
        const updates: Record<string, any> = {};
        if (parsedResult.numeroDocumentoDetectado) {
          updates.numero_nota_fiscal = parsedResult.numeroDocumentoDetectado;
        }
        if (parsedResult.valorNotaFiscalDetectado !== null) {
          updates.valor_nota_fiscal = parsedResult.valorNotaFiscalDetectado;
        }
        await repasseService.salvarCompetencia(targetCompetenciaId, updates);
      }

      // 2. Consolida grupos que tenham o mesmo destinatário (ex: vários médicos redirecionados para UTI ADULTO I)
      const consolidadoPorDestinatario = new Map<
        string,
        {
          tipo: 'profissional' | 'setor';
          descricao: string;
          medico_id: string | null;
          setor_id: string | null;
          valor_bruto: number;
          desconto_percentual: number;
          detalhes: Array<{
            paciente: string;
            procedimento: string;
            data_procedimento: string;
            quantidade: number;
            valor_total: number;
          }>;
        }
      >();

      for (const g of gruposSelecionados) {
        const nomeLimpo = g.destinatario.trim().toUpperCase();
        const brutoGrupo = usarValorApresentado ? g.valor_bruto_apresentado : g.valor_bruto_aprovado;

        const matchSetor = setoresDisponiveis.find(s => s.nome.toUpperCase() === nomeLimpo);
        const matchMed = medicosDisponiveis.find(m => m.nome.toUpperCase() === nomeLimpo);

        const detalhesMapeados = g.detalhes.map(d => ({
          paciente: d.paciente,
          procedimento: d.procedimento,
          data_procedimento: d.data_procedimento,
          quantidade: d.quantidade,
          valor_total: usarValorApresentado ? d.valor_apresentado : d.valor_aprovado,
        }));

        const existente = consolidadoPorDestinatario.get(nomeLimpo);
        if (!existente) {
          consolidadoPorDestinatario.set(nomeLimpo, {
            tipo: g.tipo,
            descricao: nomeLimpo,
            medico_id: g.tipo === 'profissional' ? matchMed?.id || null : null,
            setor_id: g.tipo === 'setor' ? matchSetor?.id || null : null,
            valor_bruto: brutoGrupo,
            desconto_percentual: g.desconto_percentual,
            detalhes: detalhesMapeados,
          });
        } else {
          existente.valor_bruto = Number((existente.valor_bruto + brutoGrupo).toFixed(2));
          existente.detalhes.push(...detalhesMapeados);
        }
      }

      await repasseService.importarLoteComDetalhes(
        targetCompetenciaId,
        Array.from(consolidadoPorDestinatario.values())
      );

      onImportado();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar importação:', err);
      setErrorMsg('Erro ao salvar lançamentos: ' + (err.message || 'Tente novamente.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setParsedResult(null);
    setGruposEditaveis([]);
    setExpandedGroupIds(new Set());
    setErrorMsg(null);
    setSearchTerm('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-background/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* ── CABEÇALHO DO MODAL ── */}
          <div className="px-6 py-4 bg-muted/40 border-b border-border/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-2xs">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    Importador Inteligente de Repasses (PDF & Excel)
                  </h2>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {convenioAtual} • {competenciaStrAtual}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Suporta Espelho UNIMED, IPSEMG, Demonstrativos TISS (CEMIG Saúde), Hapvida/GNDI Minas e Planilhas Excel/CSV
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {/* Alternador de Modo: Upload de Arquivo vs Colar do Excel */}
              <div className="flex items-center bg-background border border-border p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setAbaAtiva('arquivo');
                    handleReset();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    abaAtiva === 'arquivo'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Upload PDF / Excel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAbaAtiva('colar');
                    handleReset();
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    abaAtiva === 'colar'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  Colar (Ctrl+V)
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── MENSAGEM DE ERRO ── */}
          {errorMsg && (
            <div className="px-6 py-3 bg-destructive/10 text-destructive text-xs border-b border-destructive/20 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── CORPO DO MODAL ── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Datalist global de médicos e setores para autocomplete rápido */}
            <datalist id="datalist-destinatarios-import">
              {setoresDisponiveis.map((s, i) => (
                <option key={`setor-${s.id || i}`} value={s.nome.toUpperCase()}>
                  Setor / UTI
                </option>
              ))}
              {medicosDisponiveis.map((m, i) => (
                <option key={`med-${m.id || i}`} value={m.nome.toUpperCase()}>
                  Médico(a)
                </option>
              ))}
            </datalist>

            {/* ESTADO 1: Aguardando Upload ou Colagem */}
            {!parsedResult && (
              <>
                {abaAtiva === 'arquivo' ? (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => !parsing && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-4 ${
                      isDragging
                        ? 'border-primary bg-primary/5 scale-[0.995]'
                        : 'border-border hover:border-primary/60 hover:bg-muted/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {parsing ? (
                      <div className="py-6 flex flex-col items-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                          <RefreshCw className="w-6 h-6 animate-spin" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-foreground">
                            {progressInfo?.message || 'Extraindo dados do arquivo...'}
                          </p>
                          {progressInfo && progressInfo.total > 1 && (
                            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden mx-auto">
                              <div
                                className="h-full bg-primary transition-all duration-200"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round((progressInfo.current / progressInfo.total) * 100)
                                  )}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                            <FileSpreadsheet className="w-6 h-6" />
                          </div>
                        </div>

                        <div className="max-w-lg space-y-1.5">
                          <p className="text-base font-bold text-foreground">
                            Arraste e solte o arquivo PDF ou Excel aqui, ou clique para selecionar
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Formatos aceitos: <span className="font-mono font-semibold text-foreground">.PDF, .XLSX, .XLS, .CSV</span>
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full max-w-4xl pt-3 text-left">
                          <div className="p-3 rounded-xl border border-border bg-card/80 space-y-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                              UNIMED (Cardio)
                            </span>
                            <p className="text-[11px] text-muted-foreground pt-1">
                              Agrupa honorários por médico, abate estornos (C/D) e salva os pacientes detalhados.
                            </p>
                          </div>
                          <div className="p-3 rounded-xl border border-border bg-card/80 space-y-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                              IPSEMG / SIGAS
                            </span>
                            <p className="text-[11px] text-muted-foreground pt-1">
                              Extrai médicos executantes (CPF/Nome), soma valores aprovados e lista pacientes.
                            </p>
                          </div>
                          <div className="p-3 rounded-xl border border-border bg-card/80 space-y-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">
                              CEMIG / Padrão TISS
                            </span>
                            <p className="text-[11px] text-muted-foreground pt-1">
                              Extrai protocolo, valor liberado e procedimentos para vínculo rápido ao médico.
                            </p>
                          </div>
                          <div className="p-3 rounded-xl border border-border bg-card/80 space-y-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-600">
                              GNDI / Hapvida & Excel
                            </span>
                            <p className="text-[11px] text-muted-foreground pt-1">
                              Filtra procedimentos cirúrgicos/médicos da guia ou importa planilhas completas.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-foreground">
                        Cole abaixo as linhas copiadas do Excel (Profissional/Setor + Valor ou Paciente + Procedimento + Data + Qtd + Valor):
                      </label>
                      <span className="text-[11px] text-muted-foreground">
                        Colunas separadas por Tabulação ou Ponto e Vírgula
                      </span>
                    </div>
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={
                        'Exemplo Resumo:\nDANIEL FERREIRA MOREIRA\t7750,00\nGEORGEANA DEBS GUESINE\t3356,50\nUTI ADULTO I\t9452,50'
                      }
                      rows={8}
                      className="w-full p-3.5 rounded-xl border border-border bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleProcessarTextoColado}
                        disabled={!inputText.trim()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                        Processar Dados Colados
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ESTADO 2: Arquivo Processado — Pré-visualização e Vínculo Interativo */}
            {parsedResult && (
              <div className="space-y-4">
                {/* Banner de Metadados Detectados */}
                <div className="bg-muted/30 border border-border rounded-2xl p-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20 shrink-0 mt-0.5">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-extrabold text-foreground uppercase">
                          {parsedResult.layoutLabel}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {parsedResult.nomeArquivo}
                        </span>
                        {parsedResult.totalPaginas && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            ({parsedResult.totalPaginas} pág.)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs pt-0.5">
                        {parsedResult.convenioDetectado && (
                          <div>
                            <span className="text-muted-foreground">Convênio detectado: </span>
                            <span className="font-bold text-foreground">{parsedResult.convenioDetectado}</span>
                          </div>
                        )}
                        {parsedResult.competenciaDetectada && (
                          <div>
                            <span className="text-muted-foreground">Competência: </span>
                            <span className="font-mono font-bold text-foreground">
                              {parsedResult.competenciaDetectada}
                            </span>
                          </div>
                        )}
                        {parsedResult.numeroDocumentoDetectado && (
                          <div>
                            <span className="text-muted-foreground">Nº Doc / Protocolo: </span>
                            <span className="font-mono font-bold text-foreground">
                              {parsedResult.numeroDocumentoDetectado}
                            </span>
                          </div>
                        )}
                        {parsedResult.valorNotaFiscalDetectado !== null && (
                          <div>
                            <span className="text-muted-foreground">Valor Total / NF no Documento: </span>
                            <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(parsedResult.valorNotaFiscalDetectado)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-end">
                    {parsedResult.valorNotaFiscalDetectado !== null && (
                      <label className="inline-flex items-center gap-2 text-xs bg-card border border-border px-3 py-1.5 rounded-xl cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={atualizarNotaFiscal}
                          onChange={(e) => setAtualizarNotaFiscal(e.target.checked)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="font-medium text-foreground">
                          Atualizar Valor da NF ({formatCurrency(parsedResult.valorNotaFiscalDetectado)})
                        </span>
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Trocar Arquivo
                    </button>
                  </div>
                </div>

                {/* Avisos inteligentes do Parser */}
                {parsedResult.avisos.length > 0 && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2.5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
                    <div className="space-y-0.5">
                      {parsedResult.avisos.map((av, idx) => (
                        <p key={idx}>{av}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Barra de Ferramentas da Pré-visualização */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={
                          gruposEditaveis.length > 0 &&
                          gruposEditaveis.every(g => g.selecionado)
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>
                        Selecionar Todos ({gruposSelecionados.length} de {gruposEditaveis.length})
                      </span>
                    </label>

                    {/* Alternador Valor Aprovado vs Valor Apresentado */}
                    <div className="flex items-center bg-muted/60 p-1 rounded-xl text-[11px]">
                      <button
                        type="button"
                        onClick={() => setUsarValorApresentado(false)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          !usarValorApresentado
                            ? 'bg-card text-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Usar Valor Liberado / Pago
                      </button>
                      <button
                        type="button"
                        onClick={() => setUsarValorApresentado(true)}
                        className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          usarValorApresentado
                            ? 'bg-card text-foreground shadow-2xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        Usar Valor Informado / Faturado
                      </button>
                    </div>
                  </div>

                  {/* Busca rápida */}
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar médico, paciente ou código..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none"
                    />
                  </div>
                </div>

                {/* Tabela Interativa de Grupos Extraídos */}
                <div className="border border-border rounded-2xl overflow-hidden shadow-2xs">
                  <div className="max-h-[420px] overflow-y-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-muted/80 text-muted-foreground font-semibold uppercase text-[10px] sticky top-0 z-10 border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">Sel.</th>
                          <th className="py-2.5 px-2 w-8"></th>
                          <th className="py-2.5 px-3 w-32">Classificação</th>
                          <th className="py-2.5 px-3 min-w-[260px]">
                            Destinatário (Médico ou Setor/UTI)
                          </th>
                          <th className="py-2.5 px-3 w-36 text-center">Produção / Pacientes</th>
                          <th className="py-2.5 px-3 w-32 text-right">Valor Bruto (R$)</th>
                          <th className="py-2.5 px-2 w-20 text-center">Desc. (%)</th>
                          <th className="py-2.5 px-3 w-32 text-right">Valor Líquido</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {gruposFiltrados.map((grupo) => {
                          const isExpanded = expandedGroupIds.has(grupo.id);
                          const bruto = usarValorApresentado
                            ? grupo.valor_bruto_apresentado
                            : grupo.valor_bruto_aprovado;
                          const descValor = Number(
                            (bruto * ((grupo.desconto_percentual || 0) / 100)).toFixed(2)
                          );
                          const liquido = Number((bruto - descValor).toFixed(2));
                          const semVinculo = grupo.selecionado && !grupo.destinatario.trim();

                          return (
                            <React.Fragment key={grupo.id}>
                              <tr
                                className={`transition-colors ${
                                  !grupo.selecionado
                                    ? 'opacity-50 bg-muted/10'
                                    : semVinculo
                                    ? 'bg-amber-500/10'
                                    : grupo.tipo === 'setor'
                                    ? 'bg-amber-500/5'
                                    : 'hover:bg-muted/30'
                                }`}
                              >
                                <td className="py-2 px-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={grupo.selecionado}
                                    onChange={() => handleToggleSelectGroup(grupo.id)}
                                    className="rounded border-border text-primary focus:ring-primary cursor-pointer"
                                  />
                                </td>

                                <td className="py-2 px-1 text-center">
                                  {grupo.detalhes.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandGroup(grupo.id)}
                                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                      title="Ver pacientes e procedimentos deste lançamento"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-4 h-4 text-primary" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                </td>

                                {/* Seletor Médico vs Setor */}
                                <td className="py-2 px-3">
                                  <select
                                    value={grupo.tipo}
                                    onChange={(e) =>
                                      handleChangeTipoGroup(
                                        grupo.id,
                                        e.target.value as 'profissional' | 'setor'
                                      )
                                    }
                                    className={`px-2 py-1 rounded-lg text-[11px] font-bold border outline-none cursor-pointer ${
                                      grupo.tipo === 'setor'
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                    }`}
                                  >
                                    <option value="profissional">MÉDICO</option>
                                    <option value="setor">SETOR / UTI</option>
                                  </select>
                                </td>

                                {/* Campo Editável / Autocomplete do Médico ou Setor */}
                                <td className="py-2 px-3">
                                  <div className="space-y-1">
                                    <input
                                      type="text"
                                      list="datalist-destinatarios-import"
                                      value={grupo.destinatario}
                                      onChange={(e) =>
                                        handleChangeDestinatarioGroup(grupo.id, e.target.value)
                                      }
                                      placeholder="Selecione ou digite o Médico ou Setor (ex: UTI ADULTO I)..."
                                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-bold uppercase outline-none transition-all ${
                                        semVinculo
                                          ? 'border-amber-500 bg-amber-500/5 text-foreground focus:ring-2 focus:ring-amber-500'
                                          : 'border-border/80 bg-background text-foreground focus:border-primary focus:ring-1 focus:ring-primary'
                                      }`}
                                    />
                                    {grupo.detalhes.length === 1 && grupo.precisa_vinculo && (
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        Proc.: <span className="font-semibold text-foreground">{grupo.detalhes[0].procedimento}</span> • Pac.: {grupo.detalhes[0].paciente}
                                      </p>
                                    )}
                                  </div>
                                </td>

                                {/* Contagem de detalhes */}
                                <td className="py-2 px-3 text-center">
                                  {grupo.detalhes.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => toggleExpandGroup(grupo.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer"
                                    >
                                      <span>{grupo.detalhes.length} atend.</span>
                                      {isExpanded ? (
                                        <ChevronDown className="w-3 h-3" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3" />
                                      )}
                                    </button>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground">Resumo</span>
                                  )}
                                </td>

                                {/* Valor Bruto */}
                                <td className="py-2 px-3 text-right">
                                  <input
                                    type="text"
                                    value={bruto.toFixed(2).replace('.', ',')}
                                    onChange={(e) => handleChangeValorGroup(grupo.id, e.target.value)}
                                    className="w-28 text-right font-mono font-bold text-foreground bg-background px-2 py-1 rounded-lg border border-border/70 focus:border-primary outline-none"
                                  />
                                </td>

                                {/* Desconto % */}
                                <td className="py-2 px-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={grupo.desconto_percentual}
                                    onChange={(e) =>
                                      handleChangeDescontoGroup(
                                        grupo.id,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    className="w-16 text-center font-mono text-foreground bg-background px-1.5 py-1 rounded-lg border border-border/70 focus:border-primary outline-none"
                                  />
                                </td>

                                {/* Líquido */}
                                <td className="py-2 px-3 text-right font-mono font-extrabold text-primary text-xs">
                                  {formatCurrency(liquido)}
                                </td>
                              </tr>

                              {/* Sub-tabela expansível com os Pacientes e Procedimentos extraídos */}
                              {isExpanded && grupo.detalhes.length > 0 && (
                                <tr className="bg-muted/20">
                                  <td colSpan={8} className="p-3 pl-12">
                                    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-2xs">
                                      <div className="px-3 py-2 bg-muted/50 border-b border-border flex justify-between items-center text-[11px]">
                                        <span className="font-bold text-foreground">
                                          Detalhamento de Produção ({grupo.detalhes.length} registro(s) que serão salvos em "Ver Produção")
                                        </span>
                                        {grupo.detalhes[0]?.profissional_original && (
                                          <span className="text-muted-foreground">
                                            Médico no documento:{' '}
                                            <strong className="text-foreground">
                                              {grupo.detalhes[0].profissional_original}
                                            </strong>
                                          </span>
                                        )}
                                      </div>
                                      <table className="w-full text-left border-collapse text-[11px]">
                                        <thead className="bg-muted/30 text-muted-foreground uppercase text-[10px] border-b border-border">
                                          <tr>
                                            <th className="py-1.5 px-3">Paciente / Beneficiário</th>
                                            <th className="py-1.5 px-3">Procedimento</th>
                                            <th className="py-1.5 px-3 w-24 text-center">Data</th>
                                            <th className="py-1.5 px-3 w-16 text-center">Qtd</th>
                                            <th className="py-1.5 px-3 w-28 text-right">Informado</th>
                                            <th className="py-1.5 px-3 w-28 text-right">Liberado / Pago</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border/40">
                                          {grupo.detalhes.map((det) => (
                                            <tr key={det.id} className="hover:bg-muted/20">
                                              <td className="py-1.5 px-3 font-medium text-foreground">
                                                {det.paciente}
                                              </td>
                                              <td className="py-1.5 px-3 text-muted-foreground">
                                                {det.procedimento}
                                              </td>
                                              <td className="py-1.5 px-3 text-center font-mono">
                                                {formatDateBR(det.data_procedimento)}
                                              </td>
                                              <td className="py-1.5 px-3 text-center font-mono">
                                                {det.quantidade}
                                              </td>
                                              <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                                                {formatCurrency(det.valor_apresentado)}
                                              </td>
                                              <td className="py-1.5 px-3 text-right font-mono font-bold text-foreground">
                                                {formatCurrency(det.valor_aprovado)}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RODAPÉ COM RESUMO E CONFIRMAÇÃO ── */}
          <div className="px-6 py-4 bg-muted/30 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
            {parsedResult ? (
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Selecionados: </span>
                  <span className="font-bold text-foreground">{gruposSelecionados.length} lançamento(s)</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Bruto: </span>
                  <span className="font-mono font-bold text-foreground">
                    {formatCurrency(totalBrutoSelecionado)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Líquido a Importar: </span>
                  <span className="font-mono font-extrabold text-primary text-sm">
                    {formatCurrency(totalLiquidoSelecionado)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Os lançamentos importados poderão ser editados e auditados individualmente na planilha.
              </div>
            )}

            <div className="flex items-center gap-2.5 self-end sm:self-center">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted transition-colors cursor-pointer"
              >
                Cancelar
              </button>

              {parsedResult && (
                <button
                  type="button"
                  onClick={handleConfirmarImportacao}
                  disabled={submitting || gruposSelecionados.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-primary hover:bg-primary/90 rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Importando para a Planilha...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirmar Importação ({gruposSelecionados.length})
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
