import fs from 'fs';
import path from 'path';

// Carrega variáveis de ambiente do .env se existir
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim().replace(/(^['"]|['"]$)/g, '');
        process.env[key] = val;
      }
    });
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://drbzogwimvaziaydwqfk.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-centro-medico`;

async function testWhatsappCentroMedico() {
  console.log(`\n=== Testando Edge Function: ${FUNCTION_URL} ===`);

  const payload = {
    cardId: 'cons-103',
    paciente: 'Carlos Eduardo Martins',
    medico: 'Dr. Fernando Henrique Lima',
    horario: '10:00',
    data: 'Hoje',
    consultorio: 'Consultório 01',
    convenio: 'Bradesco Saúde',
    sender: '34988511343',
    recipient: '5584998444889',
    text: 'Você tem uma consulta no Centro Médico da Santa Casa'
  };

  try {
    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    console.log(`Status HTTP: ${res.status}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    console.log('Resposta:', typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } catch (error) {
    console.error('Erro ao chamar a Edge Function:', error.message);
  }
}

testWhatsappCentroMedico();
