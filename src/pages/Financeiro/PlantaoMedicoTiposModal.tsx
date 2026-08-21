import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, Plus, Trash2, Edit2, X, Check, Save,
  AlertCircle, Loader2, Sparkles, Power, ArrowUp, ArrowDown
} from 'lucide-react';
import {
  plantaoMedicoTiposProducaoService,
  PlantaoMedicoTipoProducao,
  DEFAULT_TIPOS_PRODUCAO
} from '../../services/plantaoMedicoTiposProducaoService';

interface PlantaoMedicoTiposModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTiposUpdated?: () => void;
}

const PALETA_CORES = [
  { label: 'Azul', value: 'blue', bgClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { label: 'Verde', value: 'emerald', bgClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { label: 'Rosa / Magenta', value: 'pink', bgClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
  { label: 'Roxo', value: 'purple', bgClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { label: 'Âmbar / Laranja', value: 'amber', bgClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { label: 'Vermelho / Vinho', value: 'rose', bgClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  { label: 'Cinza / Chumbo', value: 'slate', bgClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
  { label: 'Ciano / Índigo', value: 'indigo', bgClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
];

export const getTipoColorClass = (corName?: string) => {
  const found = PALETA_CORES.find(c => c.value === corName);
  return found ? found.bgClass : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
};

export const PlantaoMedicoTiposModal: React.FC<PlantaoMedicoTiposModalProps> = ({
  isOpen,
  onClose,
  onTiposUpdated
}) => {
  const [tipos, setTipos] = useState<PlantaoMedicoTipoProducao[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Formulário de adição / edição
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [cor, setCor] = useState<string>('blue');
  const [ordem, setOrdem] = useState<number>(0);
  const [ativo, setAtivo] = useState<boolean>(true);

  const carregarTipos = async () => {
    try {
      setLoading(true);
      const data = await plantaoMedicoTiposProducaoService.listar(false);
      setTipos(data);
    } catch (err) {
      console.error('Erro ao carregar tipos de produção:', err);
      setTipos(DEFAULT_TIPOS_PRODUCAO);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarTipos();
      setFeedback(null);
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setEditingId(null);
    setNome('');
    setDescricao('');
    setCor('blue');
    setOrdem(tipos.length + 1);
    setAtivo(true);
  };

  const handleStartEdit = (t: PlantaoMedicoTipoProducao) => {
    setEditingId(t.id || null);
    setNome(t.nome);
    setDescricao(t.descricao || '');
    setCor(t.cor || 'blue');
    setOrdem(t.ordem || 0);
    setAtivo(t.ativo !== false);
    setFeedback(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setFeedback({ type: 'error', message: 'O nome do tipo de produção é obrigatório.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      if (editingId && !editingId.startsWith('def-')) {
        await plantaoMedicoTiposProducaoService.atualizar(editingId, {
          nome: nome.trim(),
          descricao: descricao.trim(),
          cor,
          ordem: Number(ordem) || 0,
          ativo
        });
        setFeedback({ type: 'success', message: `Tipo "${nome}" atualizado com sucesso!` });
      } else {
        await plantaoMedicoTiposProducaoService.criar({
          nome: nome.trim(),
          descricao: descricao.trim(),
          cor,
          ordem: Number(ordem) || (tipos.length + 1),
          ativo
        });
        setFeedback({ type: 'success', message: `Tipo "${nome}" cadastrado com sucesso!` });
      }

      await carregarTipos();
      resetForm();
      if (onTiposUpdated) onTiposUpdated();
    } catch (err: any) {
      console.error('Erro ao salvar tipo de produção:', err);
      setFeedback({
        type: 'error',
        message: err?.message || 'Erro ao salvar. Verifique se o nome já existe ou se o banco está acessível.'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (tipo: PlantaoMedicoTipoProducao) => {
    if (!tipo.id || tipo.id.startsWith('def-')) return;
    try {
      await plantaoMedicoTiposProducaoService.toggleAtivo(tipo.id, !tipo.ativo);
      await carregarTipos();
      if (onTiposUpdated) onTiposUpdated();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleDelete = async (tipo: PlantaoMedicoTipoProducao) => {
    if (!tipo.id || tipo.id.startsWith('def-')) {
      alert('Tipos padrão do sistema só podem ser alterados quando cadastrados no Supabase.');
      return;
    }

    if (!confirm(`Deseja realmente excluir o tipo de produção "${tipo.nome}"?`)) {
      return;
    }

    try {
      setLoading(true);
      await plantaoMedicoTiposProducaoService.excluir(tipo.id);
      setFeedback({ type: 'success', message: `Tipo "${tipo.nome}" removido.` });
      await carregarTipos();
      if (onTiposUpdated) onTiposUpdated();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      setFeedback({ type: 'error', message: 'Erro ao excluir tipo de produção.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-auto"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-xl border border-rose-500/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Tipos de Produção Médica
                <span className="text-[11px] font-semibold bg-rose-500/10 text-rose-600 px-2 py-0.5 rounded-full border border-rose-500/20">
                  {tipos.length} {tipos.length === 1 ? 'tipo' : 'tipos'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Cadastre ou edite as modalidades de produção (ex: Procedimento, Consulta, Parto, CC, etc.)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-6 mt-4 p-3 rounded-xl flex items-center gap-3 text-xs font-medium border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            }`}
          >
            {feedback.type === 'success' ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span className="flex-1">{feedback.message}</span>
            <button
              onClick={() => setFeedback(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto max-h-[70vh]">
          {/* Formulário (Coluna Esquerda) */}
          <div className="md:col-span-5 bg-muted/20 border border-border rounded-xl p-4 flex flex-col justify-between">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-rose-500" />
                  {editingId ? 'Editar Tipo de Produção' : 'Novo Tipo de Produção'}
                </span>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Nome da Produção <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Visita UTI, Sobreaviso..."
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-background border border-border focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-foreground font-medium outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  Descrição (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Breve explicação da atividade"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full bg-background border border-border focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-foreground outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Cor da Badge
                  </label>
                  <select
                    value={cor}
                    onChange={(e) => setCor(e.target.value)}
                    className="w-full bg-background border border-border focus:border-rose-500 rounded-lg px-2.5 py-2 text-xs text-foreground font-semibold outline-none cursor-pointer"
                  >
                    {PALETA_CORES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Ordem de Exibição
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ordem}
                    onChange={(e) => setOrdem(Number(e.target.value))}
                    className="w-full bg-background border border-border focus:border-rose-500 rounded-lg px-3 py-2 text-xs text-foreground font-mono outline-none"
                  />
                </div>
              </div>

              {/* Preview da Badge */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Prévia Visual
                </label>
                <div className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-center">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${getTipoColorClass(cor)}`}>
                    <Layers className="h-3 w-3" />
                    {nome.trim() || 'Nome do Tipo'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      {editingId ? 'Atualizar Tipo' : 'Cadastrar Tipo'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Listagem (Coluna Direita) */}
          <div className="md:col-span-7 flex flex-col">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
              Tipos Cadastrados no Sistema
            </span>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-rose-500" />
                <span className="text-xs">Carregando tipos do Supabase...</span>
              </div>
            ) : tipos.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 border border-dashed border-border rounded-xl">
                <Layers className="h-8 w-8 opacity-40" />
                <span className="text-xs font-medium">Nenhum tipo cadastrado</span>
              </div>
            ) : (
              <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                {tipos.map((t, idx) => (
                  <div
                    key={t.id || `tipo-${idx}`}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      editingId === t.id
                        ? 'border-rose-500 bg-rose-500/5'
                        : 'border-border bg-card hover:bg-muted/30'
                    } ${t.ativo === false ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex flex-col items-center justify-center text-[10px] font-mono text-muted-foreground w-5">
                        #{t.ordem || idx + 1}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-bold border ${getTipoColorClass(t.cor)}`}>
                            {t.nome}
                          </span>
                          {t.ativo === false && (
                            <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              Inativo
                            </span>
                          )}
                        </div>
                        {t.descricao && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t.descricao}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAtivo(t)}
                        title={t.ativo === false ? 'Ativar tipo' : 'Desativar tipo'}
                        className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                          t.ativo !== false
                            ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'text-muted-foreground bg-muted border-border hover:text-foreground'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(t)}
                        title="Editar tipo"
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(t)}
                        title="Excluir tipo"
                        className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>* Desativar um tipo preserva o histórico de lançamentos já realizados.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
