/**
 * Service to handle generic webhook integrations (like n8n)
 */

export const webhookService = {
  /**
   * Trigger the "Gestão de Pendências" webhook
   * @param payload Data to be sent to the webhook
   */
  async triggerGestaoPendencias(payload: any = {}): Promise<boolean> {
    const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_GESTAO_PENDENCIAS;
    
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
  }
};
