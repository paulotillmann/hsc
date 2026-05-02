const https = require('https');

const sql = 'CREATE POLICY "Permitir delete para autenticados" ON public.visitas FOR DELETE TO authenticated USING (true);';
const data = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  port: 443,
  path: '/v1/projects/drbzogwimvaziaydwqfk/database/query',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <REMOVED_TOKEN>',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', body);
  });
});

req.on('error', (e) => console.error('Erro:', e.message));
req.write(data);
req.end();
