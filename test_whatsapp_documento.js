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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'SUA_ANON_KEY';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/whatsapp-documento-anexado`;

async function testScenario(name, payload) {
  console.log(`\n=== Testando Cenário: ${name} ===`);
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

async function runTests() {
  console.log(`Iniciando testes para a Edge Function: ${FUNCTION_URL}`);
  
  // 1. Cenário: Apenas um UPDATE comum sem alteração de arquivo_url (permanece nulo)
  await testScenario("UPDATE comum sem arquivo_url", {
    type: "UPDATE",
    table: "solicitacoes_prontuario",
    record: {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      status: "Em Análise",
      arquivo_url: null
    },
    old_record: {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      status: "Pendente",
      arquivo_url: null
    }
  });

  // 2. Cenário: UPDATE simulando anexo de documento (arquivo_url preenchido)
  await testScenario("Documento anexado (arquivo_url de null para preenchido)", {
    type: "UPDATE",
    table: "solicitacoes_prontuario",
    record: {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      status: "Documento Disponibilizado",
      arquivo_url: "https://drbzogwimvaziaydwqfk.supabase.co/storage/v1/object/public/prontuarios-pdfs/teste.pdf"
    },
    old_record: {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      status: "Aprovado",
      arquivo_url: null
    }
  });

  // 3. Cenário: UPDATE subsequente com arquivo_url já existente (não alterado)
  await testScenario("UPDATE subsequente com arquivo_url já existente (não alterado)", {
    type: "UPDATE",
    table: "solicitacoes_prontuario",
    record: {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      status: "Documento Disponibilizado",
      arquivo_url: "https://drbzogwimvaziaydwqfk.supabase.co/storage/v1/object/public/prontuarios-pdfs/teste.pdf"
    },
    old_record: {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      status: "Documento Disponibilizado",
      arquivo_url: "https://drbzogwimvaziaydwqfk.supabase.co/storage/v1/object/public/prontuarios-pdfs/teste.pdf"
    }
  });
}

runTests();
