import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Plus, Trash2, Search, X, Check, Save, User, 
  AlertCircle, Sparkles, Loader2, Edit2, ExternalLink
} from 'lucide-react';
import { plantaoMedicoContatosService, MedicoContato } from '../../services/plantaoMedicoContatosService';

interface MedicoEmailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicosDisponiveis?: string[]; // Médicos vindos da listagem atual
  onContatosUpdated?: () => void;
}

export const MedicoEmailsModal: React.FC<MedicoEmailsModalProps> = ({
  isOpen,
  onClose,
  medicosDisponiveis = [],
  onContatosUpdated
}) => {
  const [contatos, setContatos] = useState<MedicoContato[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Estado para cadastro/edição
  const [selectedMedico, setSelectedMedico] = useState<string>('');
  const [medicoInput, setMedicoInput] = useState<string>('');
  const [emails, setEmails] = useState<string[]>(['']);
  const [saving, setSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Carregar contatos do Supabase
  const carregarContatos = async () => {
    try {
      setLoading(true);
      const data = await plantaoMedicoContatosService.listar();
      setContatos(data);
    } catch (err) {
      console.error('Erro ao carregar contatos de médicos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      carregarContatos();
      setFeedback(null);
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setSelectedMedico('');
    setMedicoInput('');
    setEmails(['']);
  };

  // Sugestões de médicos combinando os existentes no banco e os vindos da tela de plantão
  const todosMedicos = useMemo(() => {
    const setNomes = new Set<string>();
    medicosDisponiveis.forEach(m => { if (m) setNomes.add(m.trim()); });
    contatos.forEach(c => { if (c.nome_medico) setNomes.add(c.nome_medico.trim()); });
    return Array.from(setNomes).sort((a, b) => a.localeCompare(b));
  }, [medicosDisponiveis, contatos]);

  // Contatos mapeados por nome do médico para busca instantânea
  const contatosMap = useMemo(() => {
    const map = new Map<string, MedicoContato>();
    contatos.forEach(c => {
      map.set(c.nome_medico.toUpperCase().trim(), c);
    });
    return map;
  }, [contatos]);

  // Lista para exibição filtrada
  const medicosFiltrados = useMemo(() => {
    return todosMedicos.filter(nome => 
      nome.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [todosMedicos, searchTerm]);

  // Iniciar edição de um médico
  const handleSelectMedicoParaEdicao = (nome: string) => {
    const limpo = nome.trim();
    setSelectedMedico(limpo);
    setMedicoInput(limpo);
    const contato = contatosMap.get(limpo.toUpperCase());
    if (contato && contato.emails.length > 0) {
      setEmails([...contato.emails]);
    } else {
      setEmails(['']);
    }
    setFeedback(null);
  };

  const handleAddEmailField = () => {
    setEmails(prev => [...prev, '']);
  };

  const handleRemoveEmailField = (index: number) => {
    setEmails(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.length > 0 ? updated : [''];
    });
  };

  const handleEmailChange = (index: number, value: string) => {
    setEmails(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const nome = (medicoInput || selectedMedico).trim();
    if (!nome) {
      setFeedback({ type: 'error', message: 'Selecione ou digite o nome do médico.' });
      return;
    }

    const emailsValidos = emails
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emailsValidos.length === 0) {
      setFeedback({ type: 'error', message: 'Informe pelo menos um e-mail válido.' });
      return;
    }

    // Validar formato simples de email
    const invalidos = emailsValidos.filter(e => !e.includes('@') || !e.includes('.'));
    if (invalidos.length > 0) {
      setFeedback({ type: 'error', message: `E-mail inválido: "${invalidos[0]}"` });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);
      await plantaoMedicoContatosService.salvar(nome, emailsValidos);
      setFeedback({ type: 'success', message: `E-mails de "${nome}" salvos com sucesso!` });
      await carregarContatos();
      if (onContatosUpdated) onContatosUpdated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao salvar contatos no Supabase.' });
    } finally {
      setSaving(false);
    }
  };

  const handleExcluirContato = async (id: string, nome: string) => {
    if (!confirm(`Deseja remover todos os e-mails cadastrados para Dr(a). ${nome}?`)) return;
    try {
      setSaving(true);
      await plantaoMedicoContatosService.excluir(id);
      await carregarContatos();
      if (selectedMedico.toUpperCase() === nome.toUpperCase()) {
        resetForm();
      }
      if (onContatosUpdated) onContatosUpdated();
      setFeedback({ type: 'success', message: `E-mails do Dr(a). ${nome} removidos com sucesso.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir contato.' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ duration: 0.2 }}
        className="bg-card dark:bg-slate-900 border border-border w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-foreground"
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#8a1515]/10 dark:bg-[#8a1515]/20 flex items-center justify-center text-[#8a1515] dark:text-[#f43f5e] border border-[#8a1515]/20">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Gerenciar E-mails dos Médicos</h2>
              <p className="text-xs text-muted-foreground">Cadastre múltiplos endereços de e-mail por médico para envio de relatórios e notificações</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo do Modal em 2 Colunas */}
        <div className="grid grid-cols-1 md:grid-cols-12 flex-1 min-h-0 overflow-hidden divide-y md:divide-y-0 md:divide-x divide-border">
          
          {/* Coluna da Esquerda: Lista / Busca de Médicos */}
          <div className="md:col-span-5 flex flex-col min-h-0 bg-background/50">
            {/* Input de Busca */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar médico..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#8a1515]"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
                <span>{medicosFiltrados.length} médicos encontrados</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {contatos.length} com e-mail cadastrado
                </span>
              </div>
            </div>

            {/* Lista com scroll */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/40 p-2 space-y-1">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[#8a1515]" />
                  <span className="text-xs">Carregando contatos...</span>
                </div>
              ) : medicosFiltrados.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-xs">
                  Nenhum médico encontrado com esse filtro.
                </div>
              ) : (
                medicosFiltrados.map((nome) => {
                  const contato = contatosMap.get(nome.toUpperCase().trim());
                  const isSelected = selectedMedico.toUpperCase() === nome.toUpperCase();
                  const temEmail = contato && contato.emails.length > 0;

                  return (
                    <button
                      key={nome}
                      type="button"
                      onClick={() => handleSelectMedicoParaEdicao(nome)}
                      className={`w-full text-left p-3 rounded-lg transition-all flex flex-col gap-1 cursor-pointer border ${
                        isSelected 
                          ? 'bg-[#8a1515]/10 border-[#8a1515]/40 text-[#8a1515] dark:text-[#f43f5e]' 
                          : 'bg-card hover:bg-muted/60 border-transparent hover:border-border/60 text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs truncate">{nome}</span>
                        {temEmail ? (
                          <span className="flex-shrink-0 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                            {contato.emails.length} {contato.emails.length === 1 ? 'e-mail' : 'e-mails'}
                          </span>
                        ) : (
                          <span className="flex-shrink-0 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/60">
                            Sem e-mail
                          </span>
                        )}
                      </div>
                      {temEmail && (
                        <span className="text-[11px] text-muted-foreground truncate">
                          {contato.emails.join(', ')}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Coluna da Direita: Formulário de Cadastro e Múltiplos E-mails */}
          <div className="md:col-span-7 flex flex-col min-h-0 bg-card p-6 overflow-y-auto">
            <form onSubmit={handleSalvar} className="flex flex-col h-full space-y-5">
              
              {/* Informação do Médico Selecionado */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
                  Nome do Médico / Plantonista
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Selecione na lista ou digite o nome completo..."
                    value={medicoInput}
                    onChange={(e) => {
                      setMedicoInput(e.target.value);
                      setSelectedMedico(e.target.value);
                    }}
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#8a1515] transition-all"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Você pode selecionar da lista ao lado ou digitar um novo médico para cadastrar.
                </p>
              </div>

              {/* Lista Dinâmica de Múltiplos E-mails */}
              <div className="space-y-3 flex-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="h-4 w-4 text-[#8a1515] dark:text-[#f43f5e]" />
                    E-mails de Notificação / Contato
                  </label>
                  <button
                    type="button"
                    onClick={handleAddEmailField}
                    className="text-xs font-bold text-[#8a1515] dark:text-[#f43f5e] hover:bg-[#8a1515]/10 px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 cursor-pointer border border-[#8a1515]/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar Outro E-mail
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {emails.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <input
                          type="email"
                          placeholder={`exemplo.medico${idx > 0 ? idx + 1 : ''}@hospital.com.br`}
                          value={email}
                          onChange={(e) => handleEmailChange(idx, e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#8a1515]"
                        />
                      </div>
                      {emails.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEmailField(idx)}
                          title="Remover este e-mail"
                          className="h-9 w-9 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Feedback Message */}
              {feedback && (
                <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                  feedback.type === 'success' 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                }`}>
                  {feedback.type === 'success' ? <Check className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                {selectedMedico && contatosMap.has(selectedMedico.toUpperCase().trim()) ? (
                  <button
                    type="button"
                    onClick={() => {
                      const c = contatosMap.get(selectedMedico.toUpperCase().trim());
                      if (c && c.id) handleExcluirContato(c.id, c.nome_medico);
                    }}
                    disabled={saving}
                    className="text-xs text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir todos e-mails
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={saving}
                    className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  >
                    Limpar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !medicoInput.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#8a1515] hover:bg-[#701010] text-white text-xs font-bold rounded-lg shadow-md hover:shadow transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Salvar E-mails
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>
          </div>

        </div>

      </motion.div>
    </div>
  );
};
