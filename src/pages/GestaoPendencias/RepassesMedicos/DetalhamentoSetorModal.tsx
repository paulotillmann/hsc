import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Trash2, Save, Calculator, AlertCircle, 
  CheckCircle2, FileSpreadsheet, Printer, Download, Sparkles
} from 'lucide-react';
import { 
  RepasseItem, 
  RepasseDetalheProducao, 
  repasseService 
} from '../../../services/repasseService';

interface DetalhamentoSetorModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: RepasseItem | null;
  convenio: string;
  competencia: string;
  onItemUpdated: (itemAtualizado: RepasseItem) => void;
}

interface LinhaDetalhe {
  id?: string;
  paciente: string;
  procedimento: string;
  data_procedimento: string;
  quantidade: string | number;
  valor_total: string | number;
}

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

export const DetalhamentoSetorModal: React.FC<DetalhamentoSetorModalProps> = ({
  isOpen,
  onClose,
  item,
  convenio,
  competencia,
  onItemUpdated
}) => {
  const [linhas, setLinhas] = useState<LinhaDetalhe[]>([]);
  const [descontoPerc, setDescontoPerc] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showPasteArea, setShowPasteArea] = useState<boolean>(false);
  const [pastedText, setPastedText] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Carregar dados ao abrir
  useEffect(() => {
    if (!isOpen || !item) return;

    setDescontoPerc(item.desconto_percentual > 0 ? item.desconto_percentual : 10);
    setLoading(true);
    setFeedbackMsg(null);
    setShowPasteArea(false);

    repasseService.listarDetalhes(item.id)
      .then((detalhes) => {
        if (detalhes.length > 0) {
          setLinhas(
            detalhes.map(d => ({
              id: d.id,
              paciente: d.paciente,
              procedimento: d.procedimento,
              data_procedimento: d.data_procedimento,
              quantidade: d.quantidade,
              valor_total: d.valor_total
            }))
          );
        } else {
          // Linha inicial vazia para facilitar a digitação
          setLinhas([
            {
              paciente: '',
              procedimento: 'ATENDIMENTO DO INTENSIVISTA',
              data_procedimento: new Date().toISOString().slice(0, 10),
              quantidade: 1,
              valor_total: ''
            }
          ]);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar detalhes:', err);
      })
      .finally(() => setLoading(false));
  }, [isOpen, item]);

  // Cálculos em tempo real
  const totalBruto = useMemo(() => {
    return linhas.reduce((acc, row) => acc + parseCurrency(row.valor_total), 0);
  }, [linhas]);

  const valorDesconto = useMemo(() => {
    return Number((totalBruto * (descontoPerc / 100)).toFixed(2));
  }, [totalBruto, descontoPerc]);

  const totalAReceber = useMemo(() => {
    return Number((totalBruto - valorDesconto).toFixed(2));
  }, [totalBruto, valorDesconto]);

  // Adicionar linha vazia
  const handleAddLinha = () => {
    setLinhas(prev => [
      ...prev,
      {
        paciente: '',
        procedimento: prev[prev.length - 1]?.procedimento || 'ATENDIMENTO DO INTENSIVISTA',
        data_procedimento: prev[prev.length - 1]?.data_procedimento || new Date().toISOString().slice(0, 10),
        quantidade: 1,
        valor_total: ''
      }
    ]);
  };

  // Remover linha
  const handleRemoveLinha = (index: number) => {
    setLinhas(prev => prev.filter((_, i) => i !== index));
  };

  // Atualizar campo da linha
  const handleUpdateLinha = (index: number, field: keyof LinhaDetalhe, val: any) => {
    setLinhas(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Processar texto colado do Excel
  const handleProcessPaste = () => {
    if (!pastedText.trim()) return;

    const rows = pastedText.split(/\r?\n/).filter(r => r.trim().length > 0);
    const novasLinhas: LinhaDetalhe[] = [];

    for (const r of rows) {
      // Divide por Tab (padrão de cópia do Excel) ou ponto e vírgula
      const cols = r.includes('\t') ? r.split('\t') : r.split(';');
      if (cols.length >= 2) {
        const paciente = cols[0]?.trim() || '';
        const procedimento = cols[1]?.trim() || 'ATENDIMENTO DO INTENSIVISTA';
        
        let dataStr = cols[2]?.trim() || '';
        if (dataStr.includes('/')) {
          const parts = dataStr.split('/');
          if (parts.length === 3) {
            // DD/MM/AAAA -> AAAA-MM-DD
            dataStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          }
        } else if (!dataStr) {
          dataStr = new Date().toISOString().slice(0, 10);
        }

        const qtd = cols[3] ? parseCurrency(cols[3]) : 1;
        const total = cols[4] ? parseCurrency(cols[4]) : (cols[2] ? parseCurrency(cols[2]) : 0);

        novasLinhas.push({
          paciente,
          procedimento,
          data_procedimento: dataStr,
          quantidade: qtd || 1,
          valor_total: total || ''
        });
      }
    }

    if (novasLinhas.length > 0) {
      setLinhas(prev => {
        // Se tinha apenas 1 linha vazia, substitui
        if (prev.length === 1 && !prev[0].paciente && !prev[0].valor_total) {
          return novasLinhas;
        }
        return [...prev, ...novasLinhas];
      });
      setPastedText('');
      setShowPasteArea(false);
      setFeedbackMsg({ text: `${novasLinhas.length} linhas coladas do Excel com sucesso!`, type: 'success' });
    }
  };

  // Salvar alterações
  const handleSalvar = async () => {
    if (!item) return;

    // Filtra linhas com paciente preenchido
    const linhasValidas = linhas.filter(l => l.paciente.trim().length > 0);

    if (linhasValidas.length === 0 && linhas.length > 0) {
      setFeedbackMsg({ text: 'Informe ao menos o nome do paciente para salvar.', type: 'error' });
      return;
    }

    setSaving(true);
    setFeedbackMsg(null);

    try {
      const payloadDetalhes = linhasValidas.map((l, idx) => ({
        paciente: l.paciente.trim().toUpperCase(),
        procedimento: (l.procedimento || 'ATENDIMENTO DO INTENSIVISTA').trim().toUpperCase(),
        data_procedimento: l.data_procedimento || new Date().toISOString().slice(0, 10),
        quantidade: Number(l.quantidade) || 1,
        valor_total: parseCurrency(l.valor_total),
        ordem: idx
      }));

      const { itemAtualizado } = await repasseService.salvarDetalhesLote(
        item,
        payloadDetalhes,
        descontoPerc
      );

      onItemUpdated(itemAtualizado);
      setFeedbackMsg({ text: 'Detalhamento salvo e sincronizado com o Resumo Geral!', type: 'success' });
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error('Erro ao salvar detalhamento:', err);
      setFeedbackMsg({ text: 'Erro ao salvar: ' + (err.message || 'Verifique sua conexão'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* ── CABEÇALHO DO MODAL (ESTILO SANTA CASA) ── */}
          <div className="px-6 py-4 bg-muted/40 border-b border-border/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {convenio} • Competência {competencia}
                </span>
                <span className="text-xs text-muted-foreground">Santa Casa de Misericórdia de Araguari</span>
              </div>
              <h2 className="text-xl font-bold text-foreground mt-1 flex items-center gap-2">
                <span className="text-primary font-mono">{item.descricao}</span>
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                  Detalhamento de Procedimentos / Pacientes
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setShowPasteArea(!showPasteArea)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted/80 text-foreground transition-colors"
                title="Colar dados de tabela copiados do Excel"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                {showPasteArea ? 'Ocultar Colagem' : 'Colar do Excel'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* ── ÁREA DE COLAGEM RÁPIDA DO EXCEL ── */}
          {showPasteArea && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/20 text-xs"
            >
              <div className="flex items-center justify-between mb-1.5 text-emerald-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Cole as colunas copiadas do Excel (Paciente, Procedimento, Data, Quantidade, Total):
                </span>
                <span className="text-[11px] text-muted-foreground">Colunas separadas por Tabulação</span>
              </div>
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Exemplo colado:&#10;FREIDEL ALEXIS RODRIGUES BERIA	ATENDIMENTO DO INTENSIVISTA	28/04/2026	06	1492,50&#10;GERALDA LOURDES DA COSTA RODRIGUES	ATENDIMENTO DO INTENSIVISTA	14/05/2026	14	3482,50"
                rows={3}
                className="w-full p-2.5 rounded-lg border border-emerald-500/30 bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-emerald-500 outline-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowPasteArea(false)}
                  className="px-3 py-1 rounded-md text-xs border border-border text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleProcessPaste}
                  disabled={!pastedText.trim()}
                  className="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Processar e Inserir Linhas
                </button>
              </div>
            </motion.div>
          )}

          {/* ── MENSAGEM DE FEEDBACK ── */}
          {feedbackMsg && (
            <div className={`px-6 py-2.5 text-xs flex items-center gap-2 ${
              feedbackMsg.type === 'success' 
                ? 'bg-emerald-500/10 text-emerald-600 border-b border-emerald-500/20' 
                : 'bg-destructive/10 text-destructive border-b border-destructive/20'
            }`}>
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* ── CORPO: TABELA DE PACIENTES / PRODUÇÃO ── */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">Carregando dados da produção...</span>
              </div>
            ) : (
              <div className="border border-border/80 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-muted/70 text-muted-foreground font-semibold uppercase tracking-wider text-[11px] border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3 w-8 text-center">#</th>
                      <th className="py-2.5 px-3">Paciente</th>
                      <th className="py-2.5 px-3">Procedimento</th>
                      <th className="py-2.5 px-3 w-32">Data</th>
                      <th className="py-2.5 px-3 w-20 text-center">Qtd</th>
                      <th className="py-2.5 px-3 w-32 text-right">Total (R$)</th>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {linhas.map((linha, idx) => (
                      <tr key={linha.id || idx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 text-center text-muted-foreground font-mono text-[10px]">
                          {String(idx + 1).padStart(2, '0')}
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={linha.paciente}
                            onChange={(e) => handleUpdateLinha(idx, 'paciente', e.target.value)}
                            placeholder="Nome do paciente"
                            className="w-full px-2.5 py-1.5 rounded-md border border-border/70 bg-background text-foreground font-medium uppercase text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={linha.procedimento}
                            onChange={(e) => handleUpdateLinha(idx, 'procedimento', e.target.value)}
                            placeholder="Ex: ATENDIMENTO DO INTENSIVISTA"
                            className="w-full px-2.5 py-1.5 rounded-md border border-border/70 bg-background text-foreground uppercase text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="date"
                            value={linha.data_procedimento}
                            onChange={(e) => handleUpdateLinha(idx, 'data_procedimento', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-border/70 bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="number"
                            min="1"
                            value={linha.quantidade}
                            onChange={(e) => handleUpdateLinha(idx, 'quantidade', e.target.value)}
                            className="w-full px-1.5 py-1 text-center rounded-md border border-border/70 bg-background text-foreground font-mono text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                          />
                        </td>
                        <td className="py-1.5 px-2">
                          <input
                            type="text"
                            value={linha.valor_total}
                            onChange={(e) => handleUpdateLinha(idx, 'valor_total', e.target.value)}
                            placeholder="0,00"
                            className="w-full px-2.5 py-1.5 text-right rounded-md border border-border/70 bg-background text-foreground font-mono font-semibold text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none"
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLinha(idx)}
                            disabled={linhas.length === 1}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30"
                            title="Remover linha"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-between items-center mt-3">
              <button
                type="button"
                onClick={handleAddLinha}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors border border-primary/20"
              >
                <Plus className="w-4 h-4" />
                Adicionar Paciente
              </button>
              <span className="text-xs text-muted-foreground font-mono">
                {linhas.filter(l => l.paciente.trim().length > 0).length} paciente(s) lançado(s)
              </span>
            </div>
          </div>

          {/* ── PAINEL DE TOTAIS E DESCONTO (PRINT 1 EXCEL) ── */}
          <div className="px-6 py-4 bg-muted/40 border-t border-border/80 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="w-full sm:w-auto flex flex-col gap-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-primary" />
                Resumo Contábil do Setor ({item.descricao})
              </span>
              <span>Os valores serão sincronizados automaticamente com o Resumo Geral da Competência.</span>
            </div>

            <div className="w-full sm:w-auto bg-card border border-border rounded-xl p-3.5 shadow-sm min-w-[320px] space-y-2">
              <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                <span>TOTAL BRUTO:</span>
                <span className="font-mono text-foreground font-semibold">{formatCurrency(totalBruto)}</span>
              </div>

              <div className="flex justify-between items-center text-xs font-medium text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span>DESCONTO:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={descontoPerc}
                      onChange={(e) => setDescontoPerc(parseFloat(e.target.value) || 0)}
                      className="w-14 px-1 py-0.5 text-center text-xs rounded border border-border bg-background font-mono outline-none"
                    />
                    <span className="text-[11px]">%</span>
                  </div>
                </div>
                <span className="font-mono text-destructive font-semibold">
                  - {formatCurrency(valorDesconto)}
                </span>
              </div>

              <div className="pt-2 border-t border-border/80 flex justify-between items-center text-sm font-bold">
                <span className="text-foreground">TOTAL A RECEBER:</span>
                <span className="font-mono text-primary text-base">{formatCurrency(totalAReceber)}</span>
              </div>
            </div>
          </div>

          {/* ── BOTÕES DE AÇÃO ── */}
          <div className="px-6 py-3.5 bg-background border-t border-border flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar e Sincronizar Setor
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
