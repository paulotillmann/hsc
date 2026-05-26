import fs from 'fs';
import path from 'path';

// Função auxiliar para carregar o .env
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

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

async function inspect() {
  console.log("Inspecionando colunas da tabela 'cirurgias'...");
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/cirurgias`, {
      method: 'OPTIONS',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    console.log("Status:", response.status);
    if (!response.ok) {
      const text = await response.text();
      console.error("Erro na requisição:", text);
      return;
    }
    
    const text = await response.text();
    console.log("\nRetorno bruto do OPTIONS:");
    console.log(text);
    console.log("\nHeaders retornados:");
    for (const [key, value] of response.headers.entries()) {
      console.log(`${key}: ${value}`);
    }
    
  } catch (err) {
    console.error("Erro na inspeção:", err);
  }
}

inspect();
