/**
 * Script de análise do PDF de Informes de Rendimentos 2026
 * Usa pdfjs-dist para extrair texto página a página
 */
const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

const PDF_PATH = path.resolve('INFORMES2026-pag.pdf');

async function getPageText(page) {
  const textContent = await page.getTextContent();
  const strings = textContent.items.map(item => item.str);
  return strings.join(' ');
}

async function analyzePdf() {
  const dataBuffer = fs.readFileSync(PDF_PATH);
  const uint8Array = new Uint8Array(dataBuffer);
  
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  
  console.log('=== INFORMACOES GERAIS ===');
  console.log(`Total de paginas: ${doc.numPages}`);
  console.log(`Tamanho do arquivo: ${(dataBuffer.length / 1024).toFixed(1)} KB`);
  console.log('');

  // Extrair texto de cada página
  for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
    const page = await doc.getPage(i);
    const text = await getPageText(page);
    
    console.log(`\n=== PAGINA ${i} ===`);
    console.log(text);
    console.log('---');
  }

  // Listar todos os CPFs do documento inteiro
  console.log('\n\n=== BUSCA DE CPFs EM TODAS AS PAGINAS ===');
  const cpfPattern = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const text = await getPageText(page);
    const cpfs = text.match(cpfPattern) || [];
    if (cpfs.length > 0) {
      console.log(`Pagina ${i}: CPFs encontrados -> ${cpfs.join(', ')}`);
    } else {
      console.log(`Pagina ${i}: Nenhum CPF encontrado`);
    }
  }
}

analyzePdf().catch(console.error);
