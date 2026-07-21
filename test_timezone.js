import fs from 'fs';
import path from 'path';

const N8N_WEBHOOK_URL = 'https://n8n-n8n.7woir1.easypanel.host/webhook/consulta_os';

async function testWebookDate() {
  console.log("Fetching raw OS data from n8n webhook...");
  try {
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!res.ok) {
      console.error(`Failed to fetch from webhook: ${res.statusText}`);
      return;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.log("No data returned from webhook.");
      return;
    }

    const sample = data[0];
    console.log("=== RAW DATA SAMPLE ===");
    console.log("NR_SEQUENCIA:", sample.NR_SEQUENCIA);
    console.log("DT_ORDEM_SERVICO:", sample.DT_ORDEM_SERVICO);
    console.log("DT_ATUALIZACAO:", sample.DT_ATUALIZACAO);
    console.log("DT_HISTORICO:", sample.DT_HISTORICO);

    console.log("\n=== JAVASCRIPT PARSING (Node.js local timezone) ===");
    const dtOS = sample.DT_ORDEM_SERVICO;
    if (dtOS) {
      const parsed = new Date(dtOS);
      console.log(`new Date('${dtOS}'):`);
      console.log("- toString():", parsed.toString());
      console.log("- toISOString():", parsed.toISOString());
      console.log("- toLocaleString('pt-BR'):", parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
    }

    // Let's test with UTC parsing logic (same as Deno Deploy environment)
    console.log("\n=== SIMULATING DENO DEPLOY UTC ENV PARSING ===");
    if (dtOS) {
      // Deno Deploy environment treats parses without offset as UTC if no offset.
      // But let's check: if we parse it with a suffix, or force UTC?
      // Wait, let's see what happens if the string is e.g. "2026-07-21T13:00:00" vs "2026-07-21 13:00:00"
      console.log("If the string does not have timezone, in UTC env it is parsed as UTC.");
      console.log("Let's see what the n8n webhook returns exactly.");
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testWebookDate();
