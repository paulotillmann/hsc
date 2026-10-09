/**
 * Service to handle generic webhook integrations (like n8n)
 */

const qualidadeCache = new Map<string, { timestamp: number; data: any[] }>();
const CACHE_TTL = 30 * 1000; // 30 segundos de cache

export const webhookService = {
  /**
   * Trigger the "Gestão de Pendências" webhook
   * @param payload Data to be sent to the webhook
   */
  async triggerGestaoPendencias(payload: any = {}): Promise<boolean> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_GESTAO_PENDENCIAS || 'https://n8n-n8n.7woir1.easypanel.host/webhook/gestao_de_pendencias';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_GESTAO_PENDENCIAS) is not configured.');
      return false;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error triggering webhook: ${response.statusText}`);
      }

      console.log('Webhook triggered successfully!');
      return true;
    } catch (error) {
      console.error('Error in webhook triggerGestaoPendencias:', error);
      return false;
    }
  },

  /**
   * Trigger the "Consulta Faturamentos" webhook
   * @param payload Data containing filters like dateFrom, dateTo, convenio, etc.
   */
  async triggerConsultaFaturamentos(payload: any = {}): Promise<any> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_CONSULTA_FATURAMENTOS || 'https://n8n-n8n.7woir1.easypanel.host/webhook/faturamento';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_CONSULTA_FATURAMENTOS) is not configured.');
      return null;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error triggering webhook: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in webhook triggerConsultaFaturamentos:', error);
      return null;
    }
  },

  /**
   * Trigger the "Consulta Equipamento TI" webhook
   */
  async fetchEquipamentosTi(payload: any = {}): Promise<any[]> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_CONSULTA_EQUIPAMENTO_TI || 'https://n8n-n8n.7woir1.easypanel.host/webhook/consuta_equipamento_ti';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_CONSULTA_EQUIPAMENTO_TI) is not configured.');
      return [];
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error triggering webhook: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error in webhook fetchEquipamentosTi:', error);
      return [];
    }
  },

  /**
   * Trigger the "Financeiro" webhook
   * @param payload Data containing filters like dateFrom, dateTo, etc.
   */
  async triggerFinanceiro(payload: any = {}): Promise<any> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_FINANCEIRO || 'https://n8n-n8n.7woir1.easypanel.host/webhook/financeiro';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_FINANCEIRO) is not configured.');
      return null;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error triggering webhook (${response.status}): ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in webhook triggerFinanceiro:', error);
      return null;
    }
  },

  /**
   * Trigger the "Consulta Centro Médico" webhook com resiliência:
   * - Prioriza a URL direta do n8n (sem passar por rotas SPA que devolvem index.html)
   * - Rejeita documentos HTML (garantindo que fallbacks do Vite não sejam interpretados como sucesso)
   * - Suporte a fallback entre /webhook/ e /webhook-test/
   * - Suporte a POST e GET automático
   */
  async triggerConsultaCentroMedico(payload: any = {}): Promise<any> {
    const rawConfiguredUrl = 
      import.meta.env.VITE_N8N_WEBHOOK_CENTRO_MEDICO || 
      (typeof window !== 'undefined' ? localStorage.getItem('hsc_n8n_webhook_centro_medico_url') : null) ||
      'https://n8n-n8n.7woir1.easypanel.host/webhook/d3f00b1e-9dac-4be8-ad07-f58ec85789e5';
    
    // Normaliza URLs direta e de teste
    const directProdUrl = rawConfiguredUrl.replace('/webhook-test/', '/webhook/');
    const directTestUrl = rawConfiguredUrl.replace('/webhook/', '/webhook-test/');
    
    // Lista ordenada: SEMPRE prioriza as URLs diretas do Easypanel
    const urlsToTry = [directProdUrl, directTestUrl];

    console.log('[n8n Webhook] Disparando consulta ao Centro Médico. Candidatos:', urlsToTry, 'Payload:', payload);

    let lastError: any = null;

    // Constrói query string para fallback GET
    const queryParams = new URLSearchParams();
    if (payload && typeof payload === 'object') {
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          queryParams.append(k, String(v));
        }
      });
    }
    const queryString = queryParams.toString();

    for (const targetUrl of urlsToTry) {
      // 1. Tentar POST primeiro
      try {
        console.log(`[n8n Webhook] Tentando POST em: ${targetUrl}`);
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain, */*'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const rawText = await response.text();
          const trimmed = (rawText || '').trim();

          // Ignora respostas HTML (fallback SPA do Vite)
          if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
            console.warn(`[n8n Webhook] Rota ${targetUrl} retornou documento HTML. Ignorando.`);
            continue;
          }

          if (trimmed) {
            try {
              const parsed = JSON.parse(trimmed);
              console.log(`[n8n Webhook] Sucesso via POST em ${targetUrl}:`, parsed);
              return { success: true, url: targetUrl, method: 'POST', data: parsed };
            } catch {
              console.log(`[n8n Webhook] Resposta em texto bruto de ${targetUrl}:`, trimmed);
              return { success: true, url: targetUrl, method: 'POST', data: trimmed };
            }
          }
          return { success: true, url: targetUrl, method: 'POST', data: [] };
        }

        // Se retornar 404 ou 405 no POST, tenta GET com query parameters
        if (response.status === 404 || response.status === 405) {
          console.log(`[n8n Webhook] Status ${response.status} no POST. Tentando GET em: ${targetUrl}`);
          const urlWithParams = queryString ? `${targetUrl}?${queryString}` : targetUrl;
          const getRes = await fetch(urlWithParams, {
            method: 'GET',
            headers: { 'Accept': 'application/json, text/plain, */*' }
          });

          if (getRes.ok) {
            const rawText = await getRes.text();
            const trimmed = (rawText || '').trim();

            if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
              console.warn(`[n8n Webhook] Rota GET ${urlWithParams} retornou documento HTML. Ignorando.`);
              continue;
            }

            if (trimmed) {
              try {
                const parsed = JSON.parse(trimmed);
                console.log(`[n8n Webhook] Sucesso via GET em ${urlWithParams}:`, parsed);
                return { success: true, url: urlWithParams, method: 'GET', data: parsed };
              } catch {
                return { success: true, url: urlWithParams, method: 'GET', data: trimmed };
              }
            }
            return { success: true, url: urlWithParams, method: 'GET', data: [] };
          }
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err: any) {
        console.warn(`[n8n Webhook] Falha de requisição em ${targetUrl}:`, err?.message || err);
        lastError = err;
      }
    }

    console.error('[n8n Webhook] Falha ao consultar n8n:', lastError);
    throw lastError || new Error('Não foi possível conectar ao webhook do n8n.');
  },

  /**
   * Trigger the "Indicadores Qualidade" webhook
   * @param payload { indicador: string, data_inicio: string, data_fim: string }
   */
  async fetchIndicadoresQualidade(payload: { indicador: string; data_inicio: string; data_fim: string }): Promise<any[]> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_QUALIDADE || 'https://n8n-n8n.7woir1.easypanel.host/webhook/indicadores_qualidade';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_QUALIDADE) is not configured.');
      return [];
    }

    const cacheKey = `${payload.indicador}_${payload.data_inicio}_${payload.data_fim}`;
    const cached = qualidadeCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return cached.data;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // Timeout de 30 segundos

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Error triggering webhook: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || text.trim() === '') {
        return []; // Retorna vazio se o body estiver vazio, ativando o mock no front
      }

      const data = JSON.parse(text);
      const dataArray = Array.isArray(data) ? data : [];
      
      // Salva no cache apenas se tivermos dados reais
      if (dataArray.length > 0) {
        qualidadeCache.set(cacheKey, { timestamp: now, data: dataArray });
      }

      return dataArray;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.warn('Webhook fetchIndicadoresQualidade: timeout de 30s atingido. Abortando requisição.');
      } else {
        console.error('Error in webhook fetchIndicadoresQualidade:', error);
      }
      return [];
    }
  },

  /**
   * Fetch IT costs / Accounts Payable from n8n webhook
   * @param payload Filters: dt_inicio, dt_fim, situacao
   */
  async fetchCustosTi(payload: { dt_inicio?: string; dt_fim?: string; situacao?: string | null } = {}): Promise<any[]> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_CUSTOS_TI || 'https://n8n-n8n.7woir1.easypanel.host/webhook/custos';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_CUSTOS_TI) is not configured.');
      return [];
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error triggering webhook: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return [];
      }
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : (data.data && Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Error in webhook fetchCustosTi:', error);
      return [];
    }
  },

  /**
   * Fetch Medical Duty (Plantão Médico) shifts from n8n webhook
   */
  async fetchPlantaoMedicoCustos(payload: any = {}): Promise<any[]> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_PLANTAO_MEDICO || 'https://n8n-n8n.7woir1.easypanel.host/webhook/plantao';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_PLANTAO_MEDICO) is not configured.');
      return [];
    }

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Error triggering webhook: ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return [];
      }
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : (data.data && Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Error in webhook fetchPlantaoMedicoCustos:', error);
      return [];
    }
  },

  /**
   * Fetch Active Tasy Users from n8n webhook
   */
  async fetchUsuariosAtivosTasy(payload: any = {}): Promise<any[]> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_USUARIOS_TASY || 'https://n8n-n8n.7woir1.easypanel.host/webhook/usuarios_tasy';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_USUARIOS_TASY) is not configured.');
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro na resposta do webhook: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        console.warn('[webhookService] Webhook retornou corpo vazio.');
        return [];
      }

      const data = JSON.parse(text);
      
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) items = data.data;
        else if (Array.isArray(data.rows)) items = data.rows;
        else if (Array.isArray(data.items)) items = data.items;
        else if (Array.isArray(data.result)) items = data.result;
        else items = [data];
      }

      // Desempacota itens encapsulados em { json: { ... } } se o n8n enviar formato de item
      const unwrapItems = items.map(item => (item && typeof item === 'object' && item.json) ? item.json : item);
      return unwrapItems;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Error in webhook fetchUsuariosAtivosTasy:', error);
      throw error;
    }
  },

  /**
   * Fetch Hospital Consultations/Attendances for Board (Diretoria) from n8n webhook
   */
  async fetchConsultaAtendimentosDir(payload: any = {}): Promise<any[]> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_ATENDIMENTOS || 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_atendimentos_dir';
    
    if (!webhookUrl) {
      console.error('Webhook URL (VITE_N8N_WEBHOOK_ATENDIMENTOS) is not configured.');
      return [];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Erro na resposta do webhook: ${response.status} ${response.statusText}`);
      }

      const text = await response.text();
      if (!text || !text.trim()) {
        return [];
      }

      const data = JSON.parse(text);
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) items = data.data;
        else if (Array.isArray(data.rows)) items = data.rows;
        else if (Array.isArray(data.items)) items = data.items;
        else if (Array.isArray(data.result)) items = data.result;
        else items = [data];
      }

      return items.map(item => (item && typeof item === 'object' && item.json) ? item.json : item);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('Error in webhook fetchConsultaAtendimentosDir:', error);
      return [];
    }
  }
};
