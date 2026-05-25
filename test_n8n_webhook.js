async function testWebhook() {
  try {
    const response = await fetch('https://n8n-n8n.7woir1.easypanel.host/webhook/gestao_de_pendencias', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'list',
        dateFrom: '2025-10-01',
        dateTo: '2026-04-15',
        timestamp: new Date().toISOString(),
        filterProfissional: 'Todos'
      }),
    });

    const data = await response.text();
    console.log('Status:', response.status);
    console.log('Response body:', data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testWebhook();
