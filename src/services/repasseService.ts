import { supabase } from '../lib/supabase';

export interface RepasseCompetencia {
  id: string;
  convenio: string;
  competencia: string; // Ex: '07-2026'
  numero_nota_fiscal: string | null;
  valor_nota_fiscal: number;
  status: 'em_andamento' | 'finalizado' | 'cancelado';
  observacoes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RepasseItem {
  id: string;
  competencia_id: string;
  tipo: 'profissional' | 'setor';
  descricao: string;
  medico_id?: string | null;
  setor_id?: string | null;
  valor_bruto: number;
  desconto_percentual: number;
  desconto_valor: number;
  valor_liquido: number;
  possui_detalhes: boolean;
  ordem: number;
  created_at?: string;
  updated_at?: string;
}

export interface RepasseDetalheProducao {
  id: string;
  repasse_item_id: string;
  paciente: string;
  procedimento: string;
  data_procedimento: string; // YYYY-MM-DD
  quantidade: number;
  valor_total: number;
  ordem: number;
  created_at?: string;
  updated_at?: string;
}

export interface ReferenciaOpcao {
  id?: string;
  nome: string;
  tipo: 'profissional' | 'setor';
}

const LOCAL_STORAGE_KEY_PREFIX = 'hsc_repasse_fallback_';

export const repasseService = {
  // ── 1. COMPETÊNCIAS ──────────────────────────────────────────────────────────
  async listarCompetencias(): Promise<RepasseCompetencia[]> {
    try {
      const { data, error } = await supabase
        .from('repasse_competencias')
        .select('*')
        .order('competencia', { ascending: false });

      if (error) throw error;
      return (data || []) as RepasseCompetencia[];
    } catch (err: any) {
      console.warn('Fallback local para listarCompetencias:', err.message);
      const local = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}competencias`);
      if (local) {
        return JSON.parse(local);
      }
      // Retorna competência padrão inicial
      const defaultComp: RepasseCompetencia = {
        id: 'seed-unimed-07-2026',
        convenio: 'UNIMED',
        competencia: '07-2026',
        numero_nota_fiscal: '64296',
        valor_nota_fiscal: 539766.53,
        status: 'em_andamento',
        observacoes: 'Competência importada da Santa Casa de Araguari',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}competencias`, JSON.stringify([defaultComp]));
      return [defaultComp];
    }
  },

  async obterOuCriarCompetencia(convenio: string, competencia: string): Promise<RepasseCompetencia> {
    try {
      const { data: existing, error: findError } = await supabase
        .from('repasse_competencias')
        .select('*')
        .eq('convenio', convenio)
        .eq('competencia', competencia)
        .maybeSingle();

      if (findError) throw findError;
      if (existing) return existing as RepasseCompetencia;

      const { data: created, error: insertError } = await supabase
        .from('repasse_competencias')
        .insert({
          convenio,
          competencia,
          numero_nota_fiscal: '',
          valor_nota_fiscal: 0,
          status: 'em_andamento'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return created as RepasseCompetencia;
    } catch (err: any) {
      console.warn('Fallback local para obterOuCriarCompetencia:', err.message);
      const comps = await this.listarCompetencias();
      let comp = comps.find(c => c.convenio === convenio && c.competencia === competencia);
      if (!comp) {
        comp = {
          id: `local-comp-${Date.now()}`,
          convenio,
          competencia,
          numero_nota_fiscal: '',
          valor_nota_fiscal: 0,
          status: 'em_andamento',
          observacoes: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        comps.unshift(comp);
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}competencias`, JSON.stringify(comps));
      }
      return comp;
    }
  },

  async salvarCompetencia(id: string, updates: Partial<RepasseCompetencia>): Promise<RepasseCompetencia> {
    try {
      const { data, error } = await supabase
        .from('repasse_competencias')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as RepasseCompetencia;
    } catch (err: any) {
      console.warn('Fallback local para salvarCompetencia:', err.message);
      const comps = await this.listarCompetencias();
      const idx = comps.findIndex(c => c.id === id);
      if (idx !== -1) {
        comps[idx] = { ...comps[idx], ...updates, updated_at: new Date().toISOString() };
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}competencias`, JSON.stringify(comps));
        return comps[idx];
      }
      throw err;
    }
  },

  // ── 2. ITENS CONSOLIDADOS (MÉDICOS E SETORES) ───────────────────────────────
  async listarItens(competencia_id: string): Promise<RepasseItem[]> {
    try {
      const { data, error } = await supabase
        .from('repasse_itens')
        .select('*')
        .eq('competencia_id', competencia_id)
        .order('ordem', { ascending: true })
        .order('tipo', { ascending: false }) // Profissionais primeiro, depois setores
        .order('descricao', { ascending: true });

      if (error) throw error;
      return (data || []) as RepasseItem[];
    } catch (err: any) {
      console.warn('Fallback local para listarItens:', err.message);
      const local = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}itens_${competencia_id}`);
      if (local) {
        return JSON.parse(local);
      }
      return [];
    }
  },

  async salvarItem(item: Partial<RepasseItem>): Promise<RepasseItem> {
    const cleanDesc = (item.descricao || '').trim();
    const valorBruto = Number(item.valor_bruto || 0);
    const descPerc = Number(item.desconto_percentual || 0);
    let descValor = Number(item.desconto_valor || 0);

    if (descPerc > 0 && descValor === 0) {
      descValor = Number((valorBruto * (descPerc / 100)).toFixed(2));
    }
    const valorLiquido = Number((valorBruto - descValor).toFixed(2));

    const payload: any = {
      ...item,
      descricao: cleanDesc,
      valor_bruto: valorBruto,
      desconto_percentual: descPerc,
      desconto_valor: descValor,
      valor_liquido: valorLiquido,
      updated_at: new Date().toISOString()
    };

    try {
      if (item.id) {
        const { data, error } = await supabase
          .from('repasse_itens')
          .update(payload)
          .eq('id', item.id)
          .select()
          .single();

        if (error) throw error;
        return data as RepasseItem;
      } else {
        const { data, error } = await supabase
          .from('repasse_itens')
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        return data as RepasseItem;
      }
    } catch (err: any) {
      console.warn('Fallback local para salvarItem:', err.message);
      const competencia_id = item.competencia_id!;
      const itens = await this.listarItens(competencia_id);
      let resItem: RepasseItem;

      if (item.id) {
        const idx = itens.findIndex(i => i.id === item.id);
        resItem = { ...itens[idx], ...payload };
        if (idx !== -1) itens[idx] = resItem;
      } else {
        resItem = {
          id: `local-item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          possui_detalhes: false,
          ordem: itens.length,
          created_at: new Date().toISOString(),
          ...payload
        } as RepasseItem;
        itens.push(resItem);
      }
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}itens_${competencia_id}`, JSON.stringify(itens));
      return resItem;
    }
  },

  async salvarItensLote(competencia_id: string, itens: Array<Partial<RepasseItem>>): Promise<void> {
    const formatted = itens.map((item, idx) => {
      const valorBruto = Number(item.valor_bruto || 0);
      const descPerc = Number(item.desconto_percentual || 0);
      const descVal = Number(item.desconto_valor || (descPerc > 0 ? (valorBruto * (descPerc / 100)) : 0));
      return {
        competencia_id,
        tipo: item.tipo || 'profissional',
        descricao: (item.descricao || '').trim(),
        medico_id: item.medico_id || null,
        setor_id: item.setor_id || null,
        valor_bruto: valorBruto,
        desconto_percentual: descPerc,
        desconto_valor: descVal,
        valor_liquido: Number((valorBruto - descVal).toFixed(2)),
        possui_detalhes: !!item.possui_detalhes,
        ordem: item.ordem !== undefined ? item.ordem : idx
      };
    });

    try {
      const { error } = await supabase.from('repasse_itens').insert(formatted);
      if (error) throw error;
    } catch (err: any) {
      console.warn('Fallback local para salvarItensLote:', err.message);
      const atuais = await this.listarItens(competencia_id);
      const novos = formatted.map(f => ({
        ...f,
        id: `local-item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as RepasseItem[];
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}itens_${competencia_id}`, JSON.stringify([...atuais, ...novos]));
    }
  },

  async excluirItem(id: string, competencia_id: string): Promise<void> {
    try {
      const { error } = await supabase.from('repasse_itens').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.warn('Fallback local para excluirItem:', err.message);
      const itens = await this.listarItens(competencia_id);
      const filtered = itens.filter(i => i.id !== id);
      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}itens_${competencia_id}`, JSON.stringify(filtered));
      localStorage.removeItem(`${LOCAL_STORAGE_KEY_PREFIX}detalhes_${id}`);
    }
  },

  // ── 3. DETALHAMENTO DE PROCEDIMENTOS / PACIENTES (EX: UTI ADULTO I) ──────────
  async listarDetalhes(repasse_item_id: string): Promise<RepasseDetalheProducao[]> {
    try {
      const { data, error } = await supabase
        .from('repasse_detalhes_producao')
        .select('*')
        .eq('repasse_item_id', repasse_item_id)
        .order('ordem', { ascending: true })
        .order('data_procedimento', { ascending: true });

      if (error) throw error;
      return (data || []) as RepasseDetalheProducao[];
    } catch (err: any) {
      console.warn('Fallback local para listarDetalhes:', err.message);
      const local = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}detalhes_${repasse_item_id}`);
      if (local) {
        return JSON.parse(local);
      }
      return [];
    }
  },

  async salvarDetalhesLote(
    itemPai: RepasseItem,
    detalhes: Array<Omit<RepasseDetalheProducao, 'id' | 'repasse_item_id' | 'created_at' | 'updated_at'>>,
    descontoPercentual: number = 10
  ): Promise<{ itemAtualizado: RepasseItem; detalhesSalvos: RepasseDetalheProducao[] }> {
    const somaTotalBruto = Number(
      detalhes.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0).toFixed(2)
    );
    const descontoValor = Number((somaTotalBruto * (descontoPercentual / 100)).toFixed(2));
    const valorLiquido = Number((somaTotalBruto - descontoValor).toFixed(2));

    try {
      // 1. Remover detalhes anteriores do item
      await supabase.from('repasse_detalhes_producao').delete().eq('repasse_item_id', itemPai.id);

      // 2. Inserir novos detalhes
      const formatted = detalhes.map((d, index) => ({
        repasse_item_id: itemPai.id,
        paciente: (d.paciente || '').trim(),
        procedimento: (d.procedimento || '').trim(),
        data_procedimento: d.data_procedimento,
        quantidade: Number(d.quantidade) || 1,
        valor_total: Number(d.valor_total) || 0,
        ordem: index
      }));

      let detalhesSalvos: RepasseDetalheProducao[] = [];
      if (formatted.length > 0) {
        const { data: insData, error: insError } = await supabase
          .from('repasse_detalhes_producao')
          .insert(formatted)
          .select();

        if (insError) throw insError;
        detalhesSalvos = (insData || []) as RepasseDetalheProducao[];
      }

      // 3. Atualizar item pai (se trigger no DB não atualizar automaticamente)
      const { data: itemData, error: itemError } = await supabase
        .from('repasse_itens')
        .update({
          valor_bruto: somaTotalBruto,
          desconto_percentual: descontoPercentual,
          desconto_valor: descontoValor,
          valor_liquido: valorLiquido,
          possui_detalhes: detalhes.length > 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemPai.id)
        .select()
        .single();

      if (itemError) throw itemError;

      return {
        itemAtualizado: itemData as RepasseItem,
        detalhesSalvos
      };
    } catch (err: any) {
      console.warn('Fallback local para salvarDetalhesLote:', err.message);
      const detalhesSalvos = detalhes.map((d, idx) => ({
        ...d,
        id: `local-det-${Date.now()}-${idx}`,
        repasse_item_id: itemPai.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })) as RepasseDetalheProducao[];

      localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}detalhes_${itemPai.id}`, JSON.stringify(detalhesSalvos));

      const itemAtualizado: RepasseItem = {
        ...itemPai,
        valor_bruto: somaTotalBruto,
        desconto_percentual: descontoPercentual,
        desconto_valor: descontoValor,
        valor_liquido: valorLiquido,
        possui_detalhes: detalhesSalvos.length > 0,
        updated_at: new Date().toISOString()
      };

      // Atualiza nos itens da competência
      const itens = await this.listarItens(itemPai.competencia_id);
      const idx = itens.findIndex(i => i.id === itemPai.id);
      if (idx !== -1) {
        itens[idx] = itemAtualizado;
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}itens_${itemPai.competencia_id}`, JSON.stringify(itens));
      }

      return { itemAtualizado, detalhesSalvos };
    }
  },

  // ── 4. CARREGAMENTO DE MÉDICOS E SETORES CADASTRADOS NO HSC ──────────────────
  async carregarMedicosESetoresDisponiveis(): Promise<{
    medicos: ReferenciaOpcao[];
    setores: ReferenciaOpcao[];
  }> {
    const medicos: ReferenciaOpcao[] = [];
    const setores: ReferenciaOpcao[] = [];

    // Busca médicos de plantao_medico_contatos
    try {
      const { data: medData } = await supabase
        .from('plantao_medico_contatos')
        .select('id, nome_medico')
        .order('nome_medico', { ascending: true });

      if (medData && medData.length > 0) {
        medData.forEach(m => {
          if (m.nome_medico) {
            medicos.push({
              id: m.id,
              nome: m.nome_medico.trim(),
              tipo: 'profissional'
            });
          }
        });
      }
    } catch (e) {
      console.warn('Não foi possível carregar plantao_medico_contatos:', e);
    }

    // Busca setores de taxa_setores
    try {
      const { data: setoData } = await supabase
        .from('taxa_setores')
        .select('id, nome_setor')
        .order('nome_setor', { ascending: true });

      if (setoData && setoData.length > 0) {
        setoData.forEach(s => {
          if (s.nome_setor) {
            setores.push({
              id: s.id,
              nome: s.nome_setor.trim(),
              tipo: 'setor'
            });
          }
        });
      }
    } catch (e) {
      console.warn('Não foi possível carregar taxa_setores:', e);
    }

    // Adiciona setores padrões do hospital caso a tabela esteja vazia
    const setoresPadrao = [
      'UTI ADULTO I',
      'UTI ADULTO II',
      'UTI NEONATAL',
      'PEDIATRIA',
      'PRONTO ATENDIMENTO',
      'CENTRO CIRÚRGICO',
      'MATERNIDADE'
    ];

    setoresPadrao.forEach(sp => {
      if (!setores.some(s => s.nome.toUpperCase() === sp)) {
        setores.push({
          nome: sp,
          tipo: 'setor'
        });
      }
    });

    // Ordenar alfabeticamente
    medicos.sort((a, b) => a.nome.localeCompare(b.nome));
    setores.sort((a, b) => a.nome.localeCompare(b.nome));

    return { medicos, setores };
  },

  // ── 5. CARREGAMENTO DE CONVÊNIOS HISTÓRICOS E REGISTRADOS ─────────────────────
  async carregarConveniosDisponiveis(): Promise<string[]> {
    const conveniosSet = new Set<string>([
      'UNIMED',
      'IPSEMG',
      'CASSI',
      'BRADESCO SAÚDE',
      'SULAMERICA',
      'SUS',
      'GOLDEN CROSS',
      'ALLIANZ SAÚDE',
      'PARTICULAR'
    ]);

    // 1. Tentar pegar convênios já cadastrados nas competências de repasse
    try {
      const { data: compConvenios } = await supabase
        .from('repasse_competencias')
        .select('convenio');

      if (compConvenios) {
        compConvenios.forEach(c => {
          if (c.convenio && c.convenio.trim()) {
            conveniosSet.add(c.convenio.trim().toUpperCase());
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao carregar convenios de repasse_competencias:', e);
    }

    // 2. Tentar resgatar da sessão do ConsultaFaturamentos se houver
    try {
      const cacheStr = sessionStorage.getItem('hsc_faturamentos_cache_data');
      if (cacheStr) {
        const parsed = JSON.parse(cacheStr);
        if (Array.isArray(parsed)) {
          parsed.forEach((item: any) => {
            if (item.convenio && typeof item.convenio === 'string') {
              conveniosSet.add(item.convenio.trim().toUpperCase());
            }
          });
        }
      }
    } catch (e) {
      // silencioso
    }

    return Array.from(conveniosSet).sort();
  }
};

