/**
 * Script de análise do PDF de Informes de Rendimentos
 * Objetivo: Entender a estrutura de cada página para mapear CPF + Nome por colaborador
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

const PDF_PATH = path.resolve('INFORMES2026-pag.pdf');

async function analyzePdf() {
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const data = await pdf(dataBuffer);

  console.log('=== INFORMAÇÕES GERAIS ===');
  console.log(`Total de páginas: ${data.numpages}`);
  console.log(`Tamanho do arquivo: ${(dataBuffer.length / 1024).toFixed(1)} KB`);
  console.log('');

  // Extrair texto página a página via pdf-parse pagerender
  // pdf-parse não suporta paginação nativa facilmente, vamos usar o texto completo
  // e tentar identificar padrões de CPF
  
  const fullText = data.text;
  
  // Tenta encontrar padrões de CPF (xxx.xxx.xxx-xx ou xxxxxxxxxxx)
  const cpfPatternFormatted = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
  const cpfMatches = fullText.match(cpfPatternFormatted) || [];
  
  console.log(`=== CPFs ENCONTRADOS (formato xxx.xxx.xxx-xx) ===`);
  console.log(`Quantidade: ${cpfMatches.length}`);
  cpfMatches.forEach((cpf, i) => console.log(`  ${i+1}. ${cpf}`));
  console.log('');

  // Exibir texto das primeiras 3 páginas (dividindo por padrão visual)
  // Vamos exibir o texto completo limitado para análise de padrão
  const textLines = fullText.split('\n');
  console.log(`=== TOTAL DE LINHAS DE TEXTO: ${textLines.length} ===`);
  console.log('');
  console.log('=== PRIMEIRAS 120 LINHAS (para identificar padrão) ===');
  textLines.slice(0, 120).forEach((line, i) => {
    if (line.trim()) console.log(`L${String(i+1).padStart(3, '0')}: ${line}`);
  });
}

analyzePdf().catch(console.error);
