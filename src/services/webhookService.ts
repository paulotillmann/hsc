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
        throw new Error(`Error triggering webhook: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error in webhook triggerFinanceiro:', error);
      return null;
    }
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
    const timeoutId = setTimeout(() => controller.abort(), 3000); // Timeout de 3 segundos

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
        console.warn('Webhook fetchIndicadoresQualidade: timeout de 3s atingido. Abortando requisição.');
      } else {
        console.error('Error in webhook fetchIndicadoresQualidade:', error);
      }
      return [];
    }
  }
};

