async function testCustos() {
  try {
    const url = 'https://n8n-n8n.7woir1.easypanel.host/webhook/custos';
    const payload = {
      dt_inicio: '2026-01-01',
      dt_fim: '2026-01-31',
      situacao: 'L'
    };
    
    console.log(`Fetching from ${url} with payload:`, payload);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      console.error('Failed:', res.status, res.statusText);
      return;
    }
    
    const data = await res.json();
    console.log('Total records fetched:', data.length);
    if (data.length > 0) {
      const sample = data[0];
      console.log('Sample record details:');
      console.log('NR_TITULO:', sample.NR_TITULO);
      console.log('VL_TITULO:', sample.VL_TITULO);
      console.log('DT_EMISSAO:', sample.DT_EMISSAO);
      console.log('DT_LIQUIDACAO:', sample.DT_LIQUIDACAO);
      console.log('IE_SITUACAO:', sample.IE_SITUACAO);
      console.log('EMPRESA:', sample.EMPRESA);
    } else {
      console.log('No records found for that period.');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

testCustos();
