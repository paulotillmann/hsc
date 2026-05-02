import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, User, Building, QrCode, Badge as BadgeIcon, Clock, Save, Loader2, UserCircle2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { buscarPacientes, Paciente } from '../../services/pacienteService';
import { inserirVisita, obterProximoCracha } from '../../services/visitaService';

interface NovaVisitaModalProps {
  isOpen: boolean;
  onClose: () => void;
  visitanteId: string;
  visitanteNome: string;
  onVisitaCriada: () => void;
}

const OPCOES_IDENTIFICADO = ['VISITANTE', 'ACOMPANHANTE', 'EXAME EXTERNO', 'ENTREGADOR', 'PRESTADOR DE SERVIÇO'];
const OPCOES_PARENTESCO_PADRAO = ['PAI', 'MÃE', 'FILHO(A)', 'CÔNJUGE', 'IRMÃO(Ã)', 'AVÔ/AVÓ', 'TIO(A)', 'PRIMO(A)', 'SOGRO(A)', 'CUNHADO(A)', 'AMIGO(A)'];

export default function NovaVisitaModal({ isOpen, onClose, visitanteId, visitanteNome, onVisitaCriada }: NovaVisitaModalProps) {
  const [loading, setLoading] = useState(false);
  
  // Dados Automáticos
  const [dataHoraEntrada, setDataHoraEntrada] = useState<Date>(new Date());
  const [idCracha, setIdCracha] = useState<number>(0);
  const [qrcode, setQrcode] = useState<string>('');
  const [atendenteNome, setAtendenteNome] = useState<string>('');
  
  // Estado de Sucesso
  const [visitaRegistradaId, setVisitaRegistradaId] = useState<string | null>(null);

  // Formulário
  const [pacienteBusca, setPacienteBusca] = useState('');
  const [pacientesResultados, setPacientesResultados] = useState<Paciente[]>([]);
  const [buscandoPacientes, setBuscandoPacientes] = useState(false);
  const [pacienteSelecionado, setPacienteSelecionado] = useState<Paciente | null>(null);

  const [identificadoComo, setIdentificadoComo] = useState('VISITANTE');
  const [parentescoTipo, setParentescoTipo] = useState('OUTRO');
  const [parentescoCustom, setParentescoCustom] = useState('');

  // Inicialização
  useEffect(() => {
    if (isOpen) {
      setDataHoraEntrada(new Date());
      setQrcode(gerarQRCodeAleatorio());
      carregarProximoCracha();
      carregarAtendenteLogado();
      
      // Reset form
      setPacienteBusca('');
      setPacienteSelecionado(null);
      setIdentificadoComo('VISITANTE');
      setParentescoTipo('OUTRO');
      setParentescoCustom('');
      setVisitaRegistradaId(null);
    }
  }, [isOpen]);

  // Busca de Pacientes
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (pacienteBusca.length >= 3 && !pacienteSelecionado) {
        setBuscandoPacientes(true);
        try {
          const res = await buscarPacientes(pacienteBusca);
          setPacientesResultados(res);
        } catch (error) {
          console.error(error);
        } finally {
          setBuscandoPacientes(false);
        }
      } else {
        setPacientesResultados([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [pacienteBusca, pacienteSelecionado]);

  const carregarProximoCracha = async () => {
    const prox = await obterProximoCracha();
    setIdCracha(prox);
  };

  const carregarAtendenteLogado = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const nomeCompleto = session.user.user_metadata?.full_name || session.user.user_metadata?.nome || session.user.email;
      setAtendenteNome(nomeCompleto || 'Atendente Desconhecido');
    }
  };

  const gerarQRCodeAleatorio = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let resultado = '';
    for (let i = 0; i < 10; i++) {
      resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return resultado;
  };

  const handleSelecionarPaciente = (p: Paciente) => {
    setPacienteSelecionado(p);
    setPacienteBusca(p.nome);
    setPacientesResultados([]);
  };

  const handleLimparPaciente = () => {
    setPacienteSelecionado(null);
    setPacienteBusca('');
    setPacientesResultados([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pacienteSelecionado) {
      alert('Por favor, selecione um paciente.');
      return;
    }

    setLoading(true);
    try {
      const parentescoFinal = parentescoTipo === 'OUTRO' ? parentescoCustom.toUpperCase() : parentescoTipo;

      const novaVisita = await inserirVisita({
        bubble_id: crypto.randomUUID(), // Temporário para não conflitar com importações do bubble
        visitante_id: visitanteId,
        paciente: pacienteSelecionado.nome,
        clinica: pacienteSelecionado.clinica,
        leito: pacienteSelecionado.leito,
        apartamento: pacienteSelecionado.apartamento,
        data_internacao: pacienteSelecionado.data_internacao,
        identificado_como: identificadoComo,
        parentesco: parentescoFinal || null,
        data_hora_entrada: dataHoraEntrada.toISOString(),
        id_cracha: idCracha,
        qrcode: qrcode,
        atendente: atendenteNome,
        ativo: true
      });

      onVisitaCriada();
      setVisitaRegistradaId(novaVisita.id);
    } catch (err: any) {
      alert('Erro ao registrar visita: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                  <UserCircle2 className="h-6 w-6 text-primary" />
                  Nova Visita
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Registrando entrada para: <span className="font-semibold text-foreground">{visitanteNome}</span>
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {visitaRegistradaId ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">Visita Registrada!</h3>
                  <p className="text-muted-foreground max-w-md">
                    A visita de <strong>{visitanteNome}</strong> para o paciente <strong>{pacienteSelecionado?.nome}</strong> foi registrada com sucesso.
                  </p>
                </div>
              ) : (
                <form id="nova-visita-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* Paciente Section */}
                <div className="bg-muted/10 border border-border rounded-xl p-5 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-foreground">
                    <User className="h-4 w-4 text-primary" />
                    Dados do Paciente
                  </h4>
                  
                  <div className="relative">
                    <label className="block text-sm font-medium mb-1">Buscar Paciente *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Digite o nome do paciente..."
                        value={pacienteBusca}
                        onChange={(e) => {
                          setPacienteBusca(e.target.value);
                          if (pacienteSelecionado && e.target.value !== pacienteSelecionado.nome) {
                            setPacienteSelecionado(null);
                          }
                        }}
                        className="w-full h-10 rounded-md border border-input bg-background pl-9 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={loading}
                        required
                      />
                      {pacienteSelecionado && (
                        <button 
                          type="button" 
                          onClick={handleLimparPaciente}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {buscandoPacientes && !pacienteSelecionado && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
                      )}
                    </div>
                    
                    {/* Lista Suspensa de Resultados */}
                    {!pacienteSelecionado && pacientesResultados.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                        {pacientesResultados.map((p) => (
                          <div 
                            key={p.id} 
                            onClick={() => handleSelecionarPaciente(p)}
                            className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border last:border-0"
                          >
                            <p className="font-semibold text-sm text-foreground">{p.nome}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {p.clinica} | Leito: {p.leito || '-'} | Plano: {p.convenio}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {pacienteSelecionado && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                      <div className="bg-background rounded-md p-3 border border-border shadow-sm overflow-hidden">
                        <span className="block text-[10px] font-semibold uppercase text-muted-foreground mb-1">Clínica</span>
                        <span className="text-sm font-medium truncate block" title={pacienteSelecionado.clinica}>{pacienteSelecionado.clinica || '-'}</span>
                      </div>
                      <div className="bg-background rounded-md p-3 border border-border shadow-sm overflow-hidden">
                        <span className="block text-[10px] font-semibold uppercase text-muted-foreground mb-1">Leito / Apto</span>
                        <span className="text-sm font-medium truncate block">
                          {pacienteSelecionado.leito || '-'} {pacienteSelecionado.apartamento ? `/ ${pacienteSelecionado.apartamento}` : ''}
                        </span>
                      </div>
                      <div className="bg-background rounded-md p-3 border border-border shadow-sm overflow-hidden">
                        <span className="block text-[10px] font-semibold uppercase text-muted-foreground mb-1">Plano</span>
                        <span className="text-sm font-medium truncate block" title={pacienteSelecionado.convenio}>{pacienteSelecionado.convenio || '-'}</span>
                      </div>
                      <div className="bg-background rounded-md p-3 border border-border shadow-sm overflow-hidden">
                        <span className="block text-[10px] font-semibold uppercase text-muted-foreground mb-1">Data Internação</span>
                        <span className="text-sm font-medium truncate block">
                          {pacienteSelecionado.data_internacao ? new Date(pacienteSelecionado.data_internacao + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Identificação Section */}
                <div className="bg-muted/10 border border-border rounded-xl p-5 space-y-4">
                  <h4 className="font-medium flex items-center gap-2 text-foreground">
                    <BadgeIcon className="h-4 w-4 text-primary" />
                    Identificação da Visita
                  </h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Identificado Como *</label>
                      <select
                        value={identificadoComo}
                        onChange={(e) => setIdentificadoComo(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        required
                        disabled={loading}
                      >
                        {OPCOES_IDENTIFICADO.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Parentesco</label>
                      <div className="flex gap-2">
                        <select
                          value={parentescoTipo}
                          onChange={(e) => setParentescoTipo(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          disabled={loading}
                        >
                          <option value="">Selecione...</option>
                          {OPCOES_PARENTESCO_PADRAO.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          <option value="OUTRO">OUTRO (ESPECIFICAR)</option>
                        </select>
                      </div>
                    </div>
                    
                    {parentescoTipo === 'OUTRO' && (
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium mb-1">Especificar Parentesco *</label>
                        <input
                          type="text"
                          value={parentescoCustom}
                          onChange={(e) => setParentescoCustom(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                          placeholder="EX: VIZINHO, PASTOR, MÉDICO..."
                          required
                          disabled={loading}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Sistema Automático Section */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <Clock className="h-5 w-5 text-muted-foreground mb-2" />
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Entrada (Automático)</span>
                    <span className="text-sm font-bold mt-1">{dataHoraEntrada.toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <BadgeIcon className="h-5 w-5 text-muted-foreground mb-2" />
                    <span className="text-xs font-semibold uppercase text-muted-foreground">ID Crachá (Automático)</span>
                    <span className="text-xl font-bold mt-1 text-primary">{idCracha > 0 ? idCracha : '...'}</span>
                  </div>
                  <div className="bg-card border border-border rounded-xl p-4 flex flex-col items-center justify-center text-center">
                    <QrCode className="h-5 w-5 text-muted-foreground mb-2" />
                    <span className="text-xs font-semibold uppercase text-muted-foreground">QRCode (Automático)</span>
                    <span className="text-sm font-bold mt-1 font-mono tracking-wider">{qrcode || '...'}</span>
                  </div>
                </div>

              </form>
              )}
            </div>

            {/* Footer */}
            <div className="bg-muted/30 px-6 py-4 flex items-center justify-between border-t border-border">
              <span className="text-xs text-muted-foreground">
                Atendente: <strong>{atendenteNome || 'Carregando...'}</strong>
              </span>
              <div className="flex gap-3">
                {visitaRegistradaId ? (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted text-foreground h-10 px-6 transition-colors"
                    >
                      Fechar
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(`/imprimir/etiqueta/${visitaRegistradaId}`, '_blank')}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors shadow-sm"
                    >
                      <QrCode className="mr-2 h-4 w-4" />
                      Imprimir Etiqueta
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-muted text-foreground h-10 px-6 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      form="nova-visita-form"
                      disabled={loading || !pacienteSelecionado || idCracha === 0}
                      className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 transition-colors disabled:opacity-50"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {loading ? 'Salvando...' : 'Registrar Visita'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
