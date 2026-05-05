export interface Paciente {
  id: string;
  nome: string;
  clinica: string;
  leito: string;
  apartamento: string;
  data_internacao: string; // ISO 8601
  convenio: string;
}

const API_URL = 'https://n8n.technocode.site/webhook/consultaAtendimentos';

// Variáveis de cache local
let cachedPacientes: Paciente[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos de cache para não sobrecarregar o n8n

/**
 * Busca pacientes na API externa (Tasy via n8n).
 * Faz cache em memória por 5 minutos para otimizar as buscas.
 * @param query Nome do paciente para pesquisa (opcional)
 */
export async function buscarPacientes(query?: string): Promise<Paciente[]> {
  try {
    // Se o cache expirou ou não existe, busca da API
    if (!cachedPacientes || Date.now() - cacheTimestamp > CACHE_DURATION) {
      console.log('[PacienteService] Buscando novos dados do n8n...');
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na API do Tasy: ${response.status}`);
      }

      const rawData = await response.json();
      
      const lista = Array.isArray(rawData) ? rawData : (rawData.data || rawData.items || rawData[0] || []);

      cachedPacientes = lista.map((item: any, index: number) => {
        let dtInternacao = '';
        if (item.DT_ENTRADA) {
          dtInternacao = item.DT_ENTRADA.split('T')[0]; 
        }

        return {
          id: item.CD_ATENDIMENTO?.toString() || item.ID?.toString() || String(index),
          nome: item.NM_PESSOA_FISICA || 'Nome Indisponível',
          clinica: item.SETOR || '',
          leito: item.CD_UNIDADE || '',
          apartamento: '',
          data_internacao: dtInternacao,
          convenio: item.DS_CONVENIO || 'Não Informado',
        };
      });

      cacheTimestamp = Date.now();
    }

    if (!query || query.trim().length === 0) {
      return cachedPacientes || [];
    }

    const q = query.toLowerCase().trim();
    return (cachedPacientes || []).filter(p => p.nome.toLowerCase().includes(q));
    
  } catch (error) {
    console.error('Erro ao buscar pacientes na API:', error);
    return [];
  }
}

/** Limpa o cache para forçar uma nova busca */
export function limparCachePacientes() {
  cachedPacientes = null;
  cacheTimestamp = 0;
}
