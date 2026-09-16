import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight,
  Sparkles, Check, Stethoscope, Building2
} from 'lucide-react';
import { 
  RepasseItem, 
  ReferenciaOpcao, 
  repasseService 
} from '../../../services/repasseService';

interface ImportarExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  competenciaId: string;
  setoresDisponiveis: ReferenciaOpcao[];
  medicosDisponiveis: ReferenciaOpcao[];
  onImportado: () => void;
}

interface LinhaImportacao {
  tipo: 'profissional' | 'setor';
  descricao: string;
  valor: number;
  medicoId?: string | null;
  setorId?: string | null;
}

const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  const clean = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const ImportarExcelModal: React.FC<ImportarExcelModalProps> = ({
  isOpen,
  onClose,
  competenciaId,
  setoresDisponiveis,
  medicosDisponiveis,
  onImportado
}) => {
  const [inputText, setInputText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Mapeamento dos setores conhecidos para detecção automática
  const nomesSetores = useMemo(() => {
    const s = new Set<string>();
    setoresDisponiveis.forEach(item => s.add(item.nome.toUpperCase().trim()));
    // Setores comuns
    ['UTI ADULTO I', 'UTI ADULTO II', 'UTI NEONATAL', 'PEDIATRIA', 'PRONTO ATENDIMENTO', 'CENTRO CIRÚRGICO'].forEach(n => s.add(n));
    return s;
  }, [setoresDisponiveis]);

  // Processa o texto colado
  const parsedItens = useMemo((): LinhaImportacao[] => {
    if (!inputText.trim()) return [];

    const lines = inputText.split(/\r?\n/).filter(l => l.trim().length > 0);
    const result: LinhaImportacao[] = [];

    for (const line of lines) {
      // Pula cabeçalhos comuns se o usuário tiver colado junto
      const lower = line.toLowerCase();
      if (lower.includes('profissional') && lower.includes('valor')) continue;
      if (lower.startsWith('total') && !lower.includes('uti')) continue;

      const cols = line.includes('\t') ? line.split('\t') : line.split(';');
      if (cols.length >= 2) {
        const rawNome = cols[0]?.trim() || '';
        const rawVal = cols[1]?.trim() || '';
        const valor = parseCurrency(rawVal);

        if (!rawNome) continue;

        const upperNome = rawNome.toUpperCase();
        // Verifica se é setor ou profissional
        const isSetor = nomesSetores.has(upperNome) || upperNome.startsWith('UTI') || upperNome.includes('PEDIATRIA');

        // Busca IDs correspondentes se existirem
        let medicoId: string | null = null;
        let setorId: string | null = null;

        if (isSetor) {
          const matchSetor = setoresDisponiveis.find(s => s.nome.toUpperCase() === upperNome);
          if (matchSetor?.id) setorId = matchSetor.id;
        } else {
          const matchMed = medicosDisponiveis.find(m => m.nome.toUpperCase() === upperNome);
          if (matchMed?.id) medicoId = matchMed.id;
        }

        result.push({
          tipo: isSetor ? 'setor' : 'profissional',
          descricao: upperNome,
          valor,
          medicoId,
          setorId
        });
      }
    }

    return result;
  }, [inputText, nomesSetores, setoresDisponiveis, medicosDisponiveis]);

  const totalValor = useMemo(() => {
    return parsedItens.reduce((acc, item) => acc + item.valor, 0);
  }, [parsedItens]);

  const handleSalvar = async () => {
    if (parsedItens.length === 0) {
      setErrorMsg('Nenhuma linha válida identificada. Certifique-se de copiar as colunas Profissional e Valor do Excel.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const payload: Array<Partial<RepasseItem>> = parsedItens.map((p, idx) => ({
        tipo: p.tipo,
        descricao: p.descricao,
        medico_id: p.medicoId,
        setor_id: p.setorId,
        valor_bruto: p.valor,
        desconto_percentual: p.tipo === 'setor' ? 10 : 0,
        desconto_valor: 0,
        valor_liquido: p.valor,
        possui_detalhes: false,
        ordem: idx
      }));

      await repasseService.salvarItensLote(competenciaId, payload);
      onImportado();
      onClose();
    } catch (err: any) {
      console.error('Erro ao importar itens do Excel:', err);
      setErrorMsg('Erro ao salvar no banco: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Cabeçalho */}
          <div className="px-6 py-4 bg-muted/40 border-b border-border/80 flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Importação Rápida do Excel (Resumo)</h2>
                <p className="text-xs text-muted-foreground">
                  Copie as colunas de Profissional e Valor do Excel e cole abaixo para carregar todos os repasses
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="px-6 py-2.5 bg-destructive/10 text-destructive text-xs border-b border-destructive/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Conteúdo */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center justify-between">
                <span>Área de Colagem (Ctrl + V):</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  Detecta automaticamente se é Médico ou Setor (UTIs, Pediatria)
                </span>
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Selecione as colunas no Excel, pressione Ctrl+C e cole aqui. Exemplo:&#10;ADELIO DE LIMA DIAS	18,00&#10;AMANDA CRISTINA GONÇALVES GOMES SOUSA	721,13&#10;PEDIATRIA	7391,25&#10;UTI ADULTO I	8507,25"
                rows={6}
                className="w-full p-3 rounded-xl border border-border bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              />
            </div>

            {/* Pré-visualização */}
            {parsedItens.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    Pré-visualização: {parsedItens.length} itens identificados
                  </span>
                  <span className="font-mono font-bold text-primary">
                    Total: {formatCurrency(totalValor)}
                  </span>
                </div>

                <div className="border border-border rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-muted/70 text-muted-foreground font-semibold uppercase text-[10px] sticky top-0">
                      <tr>
                        <th className="py-2 px-3 w-8">#</th>
                        <th className="py-2 px-3 w-28">Tipo</th>
                        <th className="py-2 px-3">Profissional / Setor</th>
                        <th className="py-2 px-3 w-32 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {parsedItens.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/30">
                          <td className="py-1.5 px-3 text-muted-foreground font-mono text-[10px]">
                            {idx + 1}
                          </td>
                          <td className="py-1.5 px-3">
                            {item.tipo === 'setor' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                <Building2 className="w-2.5 h-2.5" />
                                Setor
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                <Stethoscope className="w-2.5 h-2.5" />
                                Médico
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 px-3 font-medium text-foreground">
                            {item.descricao}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-semibold text-foreground">
                            {formatCurrency(item.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé */}
          <div className="px-6 py-3.5 bg-background border-t border-border flex justify-end items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={submitting || parsedItens.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Confirmar Importação de {parsedItens.length} Linhas
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
