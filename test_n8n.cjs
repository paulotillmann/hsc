const https = require('https');

function testWebhook(method) {
  return new Promise((resolve) => {
    const url = new URL('https://n8n-n8n.7woir1.easypanel.host/webhook/d3f00b1e-9dac-4be8-ad07-f58ec85789e5');
    const data = JSON.stringify({
      date: '2026-10-06',
      data: '2026-10-06',
      especialidade: 'TODAS',
      search: ''
    });

    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': method === 'POST' ? Buffer.byteLength(data) : 0
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({ method, status: res.statusCode, headers: res.headers, body: body.slice(0, 1000) });
      });
    });

    req.on('error', (err) => resolve({ method, error: err.message }));
    if (method === 'POST') req.write(data);
    req.end();
  });
}

async function run() {
  console.log('--- TESTANDO POST ---');
  console.log(await testWebhook('POST'));
  console.log('--- TESTANDO GET ---');
  console.log(await testWebhook('GET'));
}

run();
