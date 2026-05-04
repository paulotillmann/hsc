import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Calendar, BedDouble } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SetorOption {
  id: string;
  nome_setor: string;
  total_leitos: number;
  total_leitos_sus: number;
}

interface LeitoReferencia {
  id: string;
  nome_leito: string;
  nome_identificacao: string;
  padrao: boolean;
  qtd_leitos: number;
  qtd_leitos_sus: number;
}

interface LeitoDiaState {
  leito_id: string;
  padrao: boolean;
  qtd_leitos_dia: number | '';
  qtd_leitos_sus: number | '';
}

const LancamentoTaxaForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState('');

  // Master State
  const [masterId, setMasterId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    horario_envio: '10:00',
    setor_id: '',
  });

  // Reference Data
  const [setores, setSetores] = useState<SetorOption[]>([]);
  const [leitosReferencia, setLeitosReferencia] = useState<LeitoReferencia[]>([]);
  
  // Detail State
  const [leitosDia, setLeitosDia] = useState<Record<string, LeitoDiaState>>({});

  useEffect(() => {
    fetchSetores();
    if (id) {
      loadLancamento(id);
    } else {
      setInitialLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (formData.setor_id) {
      fetchLeitos(formData.setor_id);
    } else {
      setLeitosReferencia([]);
      setLeitosDia({});
    }
  }, [formData.setor_id]);

  useEffect(() => {
    // Se não estivermos em modo de edição por URL (id), checa se já existe um registro
    if (!id && formData.data && formData.horario_envio && formData.setor_id) {
      checkExistingRecord();
    }
  }, [formData.data, formData.horario_envio, formData.setor_id]);


  const fetchSetores = async () => {
    // TODO: Ideally filter by 'taxa_setores_usuarios' based on current user
    const { data, error } = await supabase
      .from('taxa_setores')
      .select('id, nome_setor, total_leitos, total_leitos_sus')
      .eq('ativo', true)
      .order('nome_setor');
      
    if (data && !error) {
      setSetores(data);
    }
  };

  const fetchLeitos = async (setorId: string) => {
    const { data, error } = await supabase
      .from('taxa_leitos')
      .select('*')
      .eq('setor_id', setorId)
      .order('padrao', { ascending: false })
      .order('created_at', { ascending: true });
      
    if (data && !error) {
      setLeitosReferencia(data);
      // Inicializar estado dos detalhes apenas se não foi carregado de um master existente
      setLeitosDia(prev => {
        const newState = { ...prev };
        let mudou = false;
        data.forEach(leito => {
          if (!newState[leito.id]) {
            newState[leito.id] = {
              leito_id: leito.id,
              padrao: leito.padrao,
              qtd_leitos_dia: 0,
              qtd_leitos_sus: 0
            };
            mudou = true;
          }
        });
        return mudou ? newState : prev;
      });
    }
  };

  const checkExistingRecord = async () => {
    const { data, error } = await supabase
      .from('taxa_ocupacao_dia')
      .select('id')
      .eq('data', formData.data)
      .eq('horario_envio', formData.horario_envio)
      .eq('setor_id', formData.setor_id)
      .maybeSingle();

    if (data && !error) {
      loadLancamento(data.id);
    } else if (!id) {
      // Limpar masterId se não encontrou (e não estamos na rota de editar /:id)
      setMasterId(null);
      // Os leitos já serão reinicializados pelo useEffect do setor_id que chama fetchLeitos
    }
  };

  const loadLancamento = async (recordId: string) => {
    setInitialLoading(true);
    try {
      const { data: masterData, error: masterError } = await supabase
        .from('taxa_ocupacao_dia')
        .select('*')
        .eq('id', recordId)
        .single();

      if (masterError) throw masterError;

      setMasterId(masterData.id);
      setFormData({
        data: masterData.data,
        horario_envio: masterData.horario_envio,
        setor_id: masterData.setor_id,
      });

      // Carregar os leitos do setor para referência
      const { data: leitosRef, error: leitosError } = await supabase
        .from('taxa_leitos')
        .select('*')
        .eq('setor_id', masterData.setor_id)
        .order('padrao', { ascending: false })
        .order('created_at', { ascending: true });

      if (leitosError) throw leitosError;
      setLeitosReferencia(leitosRef);

      // Carregar detalhes do lançamento
      const { data: detalhesData, error: detalhesError } = await supabase
        .from('taxa_ocupacao_dia_setor_leito')
        .select('*')
        .eq('ocupacao_dia_id', masterData.id);

      if (detalhesError) throw detalhesError;

      const loadedLeitosDia: Record<string, LeitoDiaState> = {};
      detalhesData.forEach(detalhe => {
        loadedLeitosDia[detalhe.leito_id] = {
          leito_id: detalhe.leito_id,
          padrao: detalhe.padrao,
          qtd_leitos_dia: detalhe.qtd_leitos_dia,
          qtd_leitos_sus: detalhe.qtd_leitos_sus,
        };
      });

      // Preencher leitos novos que podem ter sido adicionados ao setor depois
      leitosRef.forEach(leito => {
        if (!loadedLeitosDia[leito.id]) {
          loadedLeitosDia[leito.id] = {
            leito_id: leito.id,
            padrao: leito.padrao,
            qtd_leitos_dia: 0,
            qtd_leitos_sus: 0,
          };
        }
      });

      setLeitosDia(loadedLeitosDia);

    } catch (error) {
      console.error("Erro ao carregar lançamento:", error);
      alert("Erro ao carregar os dados. Verifique a conexão.");
      navigate('/taxa-ocupacao/lancamento-taxas');
    } finally {
      setInitialLoading(false);
    }
  };

  const handleMasterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDetailChange = (leitoId: string, field: 'qtd_leitos_dia' | 'qtd_leitos_sus', value: string) => {
    const numericValue = value === '' ? '' : parseInt(value, 10);
    setLeitosDia(prev => ({
      ...prev,
      [leitoId]: {
        ...prev[leitoId],
        [field]: numericValue
      }
    }));
  };

  const selectedSetor = setores.find(s => s.id === formData.setor_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.setor_id) {
      alert("Por favor, selecione um Setor.");
      return;
    }
    if (!selectedSetor) return;

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const masterPayload = {
        data: formData.data,
        setor_id: formData.setor_id,
        horario_envio: formData.horario_envio,
        total_leitos: selectedSetor.total_leitos,
        total_leitos_sus: selectedSetor.total_leitos_sus,
        created_by: user?.id,
      };

      let currentMasterId = masterId;

      if (currentMasterId) {
        // Atualizar master existente
        const { error: updateError } = await supabase
          .from('taxa_ocupacao_dia')
          .update(masterPayload)
          .eq('id', currentMasterId);
        
        if (updateError) throw updateError;
      } else {
        // Inserir novo master
        const { data, error: insertError } = await supabase
          .from('taxa_ocupacao_dia')
          .insert(masterPayload)
          .select()
          .single();
          
        if (insertError) throw insertError;
        currentMasterId = data.id;
        setMasterId(currentMasterId);
      }

      if (currentMasterId) {
        // Deletar detalhes antigos (Upsert atômico mais simples)
        await supabase
          .from('taxa_ocupacao_dia_setor_leito')
          .delete()
          .eq('ocupacao_dia_id', currentMasterId);

        // Preparar novos detalhes
        const detalhesPayload = Object.values(leitosDia).map(leito => ({
          ocupacao_dia_id: currentMasterId,
          leito_id: leito.leito_id,
          padrao: leito.padrao,
          qtd_leitos_dia: leito.qtd_leitos_dia === '' ? 0 : leito.qtd_leitos_dia,
          qtd_leitos_sus: leito.qtd_leitos_sus === '' ? 0 : leito.qtd_leitos_sus,
        }));

        if (detalhesPayload.length > 0) {
          const { error: detalhesError } = await supabase
            .from('taxa_ocupacao_dia_setor_leito')
            .insert(detalhesPayload);
            
          if (detalhesError) throw detalhesError;
        }
      }

      setSuccessMessage('Lançamento salvo com sucesso!');
      
      setTimeout(() => {
        navigate('/taxa-ocupacao/lancamento-taxas');
      }, 1500);

    } catch (error: any) {
      console.error('Erro ao salvar lançamento:', error);
      alert('Erro ao salvar lançamento. ' + (error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8 animate-in fade-in zoom-in duration-500">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/taxa-ocupacao/lancamento-taxas')}
            className="p-2 hover:bg-muted rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              {masterId ? 'Editar Lançamento' : 'Novo Lançamento'}
            </h1>
            <p className="text-muted-foreground text-sm">
              Registre a ocupação diária dos leitos.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          
          {/* Mestre: Dados Principais */}
          <div className="bg-card border rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 border-b pb-4 mb-4">
              <Calendar className="h-5 w-5 text-primary" />
              Parâmetros do Lançamento
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Data <span className="text-red-500">*</span></label>
                <input
                  required
                  type="date"
                  name="data"
                  value={formData.data}
                  onChange={handleMasterChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Horário de Envio <span className="text-red-500">*</span></label>
                <select
                  required
                  name="horario_envio"
                  value={formData.horario_envio}
                  onChange={handleMasterChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                >
                  <option value="10:00">10:00</option>
                  <option value="20:00">20:00</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold">Setor <span className="text-red-500">*</span></label>
                <select
                  required
                  name="setor_id"
                  value={formData.setor_id}
                  onChange={handleMasterChange}
                  className="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background"
                >
                  <option value="">Selecione um Setor</option>
                  {setores.map(setor => (
                    <option key={setor.id} value={setor.id}>
                      {setor.nome_setor}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedSetor && (
              <div className="mt-4 p-4 bg-muted/20 border rounded-md flex gap-6 animate-in fade-in">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Total de Leitos</span>
                  <span className="text-lg font-bold text-primary">{selectedSetor.total_leitos}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Total de Leitos SUS</span>
                  <span className="text-lg font-bold text-primary">{selectedSetor.total_leitos_sus}</span>
                </div>
              </div>
            )}
          </div>

          {/* Detalhes: Grid de Leitos */}
          {formData.setor_id && (
            <div className="bg-card border rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <BedDouble className="h-5 w-5 text-primary" />
                  Ocupação por Leito
                </h2>
              </div>

              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Leito</th>
                      <th className="px-4 py-3 font-semibold">Padrão</th>
                      <th className="px-4 py-3 font-semibold text-center border-l bg-blue-50/30 dark:bg-blue-900/10">CAPACIDADE / SUS</th>
                      <th className="px-4 py-3 font-semibold text-center border-l bg-green-50/30 dark:bg-green-900/10">Ocupação (SUS) <span className="text-red-500">*</span></th>
                      <th className="px-4 py-3 font-semibold text-center bg-green-50/30 dark:bg-green-900/10">Ocupação (Não SUS) <span className="text-red-500">*</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leitosReferencia.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                          Nenhum leito cadastrado para este setor.
                        </td>
                      </tr>
                    ) : (
                      leitosReferencia.map((leito) => {
                        const estado = leitosDia[leito.id] || { qtd_leitos_dia: 0, qtd_leitos_sus: 0 };
                        return (
                          <tr key={leito.id} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 text-foreground">
                              <span className="font-medium">{leito.nome_leito}</span>
                              {leito.nome_identificacao && (
                                <span className="block text-xs text-muted-foreground">{leito.nome_identificacao}</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {leito.padrao ? <span className="text-green-600 font-bold text-xs">Sim</span> : <span className="text-muted-foreground text-xs">Não</span>}
                            </td>
                            <td className="px-4 py-3 text-center border-l bg-blue-50/30 dark:bg-blue-900/10">
                              <div className="flex justify-center gap-2 text-xs">
                                <span className="bg-background px-2 py-1 rounded border shadow-sm" title="Capacidade Geral">{leito.qtd_leitos}</span>
                                <span className="bg-background px-2 py-1 rounded border shadow-sm" title="Capacidade SUS">{leito.qtd_leitos_sus}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center border-l bg-green-50/30 dark:bg-green-900/10">
                              <input
                                required
                                type="number"
                                min="0"
                                value={estado.qtd_leitos_sus}
                                onChange={(e) => handleDetailChange(leito.id, 'qtd_leitos_sus', e.target.value)}
                                className="w-20 px-2 py-1.5 mx-auto block border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-center font-semibold"
                              />
                            </td>
                            <td className="px-4 py-3 text-center bg-green-50/30 dark:bg-green-900/10">
                              <input
                                required
                                type="number"
                                min="0"
                                value={estado.qtd_leitos_dia}
                                onChange={(e) => handleDetailChange(leito.id, 'qtd_leitos_dia', e.target.value)}
                                className="w-20 px-2 py-1.5 mx-auto block border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm bg-background text-center font-semibold"
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
            {successMessage && (
              <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 p-3 rounded-md border border-green-200 dark:border-green-900 text-sm flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                <span>{successMessage}</span>
                <button type="button" onClick={() => setSuccessMessage('')} className="text-green-700 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 font-bold px-2">×</button>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/taxa-ocupacao/lancamento-taxas')}
                className="px-4 py-2 border border-border text-foreground rounded-md hover:bg-muted font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || !formData.setor_id}
                className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Lançamentos
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
};

export default LancamentoTaxaForm;
