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
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-agendamento-enviado`;

async function testWhatsappAgendamento() {
  console.log(`\n=== Testando Edge Function: ${FUNCTION_URL} ===\n`);

  const payload = {
    cardId: 'cons-101',
    paciente: 'Maria Silva Santos',
    prontuario: '984512',
    medico: 'Dr. Roberto Albuquerque',
    crm: 'MG-12345',
    especialidade: 'Cardiologia',
    consultorio: 'Consultório 04 - Bloco A',
    horario: '09:30',
    data: 'Amanhã (02/10/2026)',
    convenio: 'Unimed',
    telefone: '34988511343',
    recipient: '5584998444889',
    status: 'Confirmadas',
    tipo: 'confirmacao'
  };

  try {
    console.log('Enviando payload:', JSON.stringify(payload, null, 2));

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify(payload)
    });

    console.log(`\nStatus HTTP retornado: ${res.status}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    console.log('Resposta da Edge Function:', typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } catch (error) {
    console.error('Erro na requisição da Edge Function:', error.message);
  }
}

testWhatsappAgendamento();
