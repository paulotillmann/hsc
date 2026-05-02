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
 * @param query Nome do paciente para pesquisa
 */
export async function buscarPacientes(query: string): Promise<Paciente[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const q = query.toLowerCase().trim();

  try {
    // Se o cache expirou ou não existe, busca da API
    if (!cachedPacientes || Date.now() - cacheTimestamp > CACHE_DURATION) {
      const response = await fetch(API_URL, {
        method: 'POST', // A API do n8n foi configurada para receber POST
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Erro na API do Tasy: ${response.status}`);
      }

      const rawData = await response.json();
      
      // O n8n geralmente retorna um array direto ou encapsulado. Tratamos ambos.
      const lista = Array.isArray(rawData) ? rawData : (rawData.data || rawData.items || rawData[0] || []);

      cachedPacientes = lista.map((item: any, index: number) => {
        // Formatar data de entrada (DT_ENTRADA) para remover horários se necessário (YYYY-MM-DD)
        let dtInternacao = '';
        if (item.DT_ENTRADA) {
          dtInternacao = item.DT_ENTRADA.split('T')[0]; 
        }

        return {
          id: item.CD_ATENDIMENTO?.toString() || item.ID?.toString() || String(index),
          nome: item.NM_PESSOA_FISICA || 'Nome Indisponível',
          clinica: item.SETOR || '',
          leito: item.CD_UNIDADE || '',
          apartamento: '', // Unificado no campo CD_UNIDADE conforme especificação
          data_internacao: dtInternacao,
          convenio: item.DS_CONVENIO || 'Não Informado',
        };
      });

      cacheTimestamp = Date.now();
    }

    // Aplica o filtro local
    return cachedPacientes.filter(p => p.nome.toLowerCase().includes(q));
    
  } catch (error) {
    console.error('Erro ao buscar pacientes na API:', error);
    // Em caso de falha de rede/API, retorna array vazio para não quebrar a UI
    return [];
  }
}
