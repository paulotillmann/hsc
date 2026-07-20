/**
 * Service to handle generic webhook integrations (like n8n)
 */

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

      const data = await response.json();
      return Array.isArray(data) ? data : (data.data && Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      console.error('Error in webhook fetchCustosTi:', error);
      return [];
    }
  }
};

