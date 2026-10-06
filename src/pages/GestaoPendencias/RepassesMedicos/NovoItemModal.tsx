import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Stethoscope, Building2, AlertCircle } from 'lucide-react';
import { 
  RepasseItem, 
  ReferenciaOpcao, 
  repasseService 
} from '../../../services/repasseService';

interface NovoItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  competenciaId: string;
  itemParaEdicao?: RepasseItem | null;
  medicosDisponiveis: ReferenciaOpcao[];
  setoresDisponiveis: ReferenciaOpcao[];
  onSalvo: (item: RepasseItem) => void;
}

const parseCurrency = (val: any): number => {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const str = String(val).trim();
  const clean = str.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};

export const NovoItemModal: React.FC<NovoItemModalProps> = ({
  isOpen,
  onClose,
  competenciaId,
  itemParaEdicao,
  medicosDisponiveis,
  setoresDisponiveis,
  onSalvo
}) => {
  const [tipo, setTipo] = useState<'profissional' | 'setor'>('profissional');
  const [descricao, setDescricao] = useState<string>('');
  const [medicoId, setMedicoId] = useState<string | null>(null);
  const [setorId, setSetorId] = useState<string | null>(null);
  const [valorBruto, setValorBruto] = useState<string>('');
  const [descontoPerc, setDescontoPerc] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (itemParaEdicao) {
      setTipo(itemParaEdicao.tipo);
      setDescricao(itemParaEdicao.descricao);
      setMedicoId(itemParaEdicao.medico_id || null);
      setSetorId(itemParaEdicao.setor_id || null);
      setValorBruto(itemParaEdicao.valor_bruto.toString());
      setDescontoPerc(itemParaEdicao.desconto_percentual || (itemParaEdicao.tipo === 'setor' ? 10 : 0));
    } else {
      setTipo('profissional');
      setDescricao('');
      setMedicoId(null);
      setSetorId(null);
      setValorBruto('');
      setDescontoPerc(0);
    }
    setErrorMsg(null);
  }, [isOpen, itemParaEdicao]);

  const handleTipoChange = (newTipo: 'profissional' | 'setor') => {
    setTipo(newTipo);
    setDescricao('');
    setMedicoId(null);
    setSetorId(null);
    if (newTipo === 'setor') {
      setDescontoPerc(10);
    } else {
      setDescontoPerc(0);
    }
  };

  const handleSelectOpcao = (nome: string, id?: string) => {
    setDescricao(nome);
    if (tipo === 'profissional') {
      setMedicoId(id || null);
    } else {
      setSetorId(id || null);
    }
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao.trim()) {
      setErrorMsg('Informe o nome do profissional ou setor.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    const numBruto = parseCurrency(valorBruto);
    const numPerc = Number(descontoPerc) || 0;
    const descValor = Number((numBruto * (numPerc / 100)).toFixed(2));
    const valorLiquido = Number((numBruto - descValor).toFixed(2));

    try {
      const payload: Partial<RepasseItem> = {
        id: itemParaEdicao?.id,
        competencia_id: competenciaId,
        tipo,
        descricao: descricao.trim().toUpperCase(),
        medico_id: tipo === 'profissional' ? medicoId : null,
        setor_id: tipo === 'setor' ? setorId : null,
        valor_bruto: numBruto,
        desconto_percentual: numPerc,
        desconto_valor: descValor,
        valor_liquido: valorLiquido,
        possui_detalhes: itemParaEdicao?.possui_detalhes || false
      };

      const salvo = await repasseService.salvarItem(payload);
      onSalvo(salvo);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar item de repasse:', err);
      setErrorMsg(err.message || 'Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        >
          <div className="px-6 py-4 bg-muted/40 border-b border-border/80 flex justify-between items-center">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              {itemParaEdicao ? 'Editar Lançamento de Repasse' : 'Novo Lançamento de Repasse'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="px-6 py-2 bg-destructive/10 text-destructive text-xs border-b border-destructive/20 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSalvar} className="p-6 space-y-4">
            {/* Seletor Tipo: Médico ou Setor */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Tipo de Destinatário:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTipoChange('profissional')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    tipo === 'profissional'
                      ? 'border-blue-500/50 bg-blue-500/10 text-blue-600 shadow-xs'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Stethoscope className="w-4 h-4" />
                  Médico / Profissional
                </button>
                <button
                  type="button"
                  onClick={() => handleTipoChange('setor')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    tipo === 'setor'
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-600 shadow-xs'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Setor / Unidade
                </button>
              </div>
            </div>

            {/* Nome com Autocomplete / Sugestões */}
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                {tipo === 'profissional' ? 'Nome do Médico / Profissional:' : 'Nome do Setor:'}
              </label>
              <input
                type="text"
                list="opcoes-cadastradas"
                value={descricao}
                onChange={(e) => {
                  const val = e.target.value;
                  setDescricao(val);
                  const list = tipo === 'profissional' ? medicosDisponiveis : setoresDisponiveis;
                  const found = list.find(x => x.nome.toUpperCase() === val.toUpperCase());
                  if (found) {
                    handleSelectOpcao(found.nome, found.id);
                  }
                }}
                placeholder={tipo === 'profissional' ? 'Ex: DR. FREIDEL ALEXIS' : 'Ex: UTI ADULTO I'}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground uppercase text-xs focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                required
              />
              <datalist id="opcoes-cadastradas">
                {(tipo === 'profissional' ? medicosDisponiveis : setoresDisponiveis).map((op, i) => (
                  <option key={op.id || i} value={op.nome} />
                ))}
              </datalist>
            </div>

            {/* Valor e Desconto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Valor Total / Bruto (R$):
                </label>
                <input
                  type="text"
                  value={valorBruto}
                  onChange={(e) => setValorBruto(e.target.value)}
                  placeholder="0,00"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono font-semibold text-xs focus:ring-2 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Desconto Retenção (%):
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={descontoPerc}
                  onChange={(e) => setDescontoPerc(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono text-xs focus:ring-2 focus:ring-primary outline-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm disabled:opacity-50"
              >
                {saving ? 'Salvando...' : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Salvar Lançamento
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
