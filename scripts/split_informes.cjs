/**
 * =============================================================
 * SCRIPT: Separação de Informes de Rendimento por Colaborador
 * =============================================================
 * 
 * Hospital Santa Casa de Araguari - Ano 2026
 * 
 * Este script:
 * 1. Lê o PDF consolidado (INFORMES2026-pag.pdf)
 * 2. Extrai CPF e Nome Completo de cada colaborador
 * 3. Separa as páginas correspondentes (2 por colaborador)
 * 4. Gera PDFs individuais na pasta /output/informes/
 * 5. Armazena a lista de colaboradores com referência aos PDFs gerados
 * 
 * Dependências: pdfjs-dist, pdf-lib
 */

const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const { PDFDocument } = require('pdf-lib');

// ============ CONFIGURAÇÃO ============
const PDF_INPUT = path.resolve(__dirname, '..', 'INFORMES2026-pag.pdf');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output', 'informes');
// =======================================

/**
 * Extrai todo o texto de uma página do PDF
 */
async function getPageText(page) {
  const textContent = await page.getTextContent();
  return textContent.items.map(item => item.str).join(' ');
}

/**
 * Extrai CPF e Nome Completo do texto de uma página de dados
 */
function extractCpfAndName(text) {
  // Padrão de CPF: xxx.xxx.xxx-xx
  const cpfMatch = text.match(/CPF\s+([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/);
  const cpf = cpfMatch ? cpfMatch[1] : null;

  // Padrão do Nome Completo: aparece após o label "Nome Completo"
  const nameMatch = text.match(/Nome Completo\s+([A-ZÀ-ÚÇ\s]+?)(?=\s+Natureza)/);
  const nomeCompleto = nameMatch ? nameMatch[1].trim() : null;

  return { cpf, nomeCompleto };
}

/**
 * Sanitiza o nome do arquivo removendo caracteres inválidos
 */
function sanitizeFilename(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

/**
 * Cria um PDF contendo apenas as páginas especificadas do PDF original
 */
async function createSubPdf(sourceBytes, pageIndices) {
  const srcDoc = await PDFDocument.load(sourceBytes);
  const newDoc = await PDFDocument.create();

  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach(page => newDoc.addPage(page));

  return await newDoc.save();
}

/**
 * Função principal
 */
async function main() {
  console.log('=====================================================');
  console.log(' SEPARAÇÃO DE INFORMES DE RENDIMENTO POR COLABORADOR');
  console.log(' Hospital Santa Casa de Araguari - 2026');
  console.log('=====================================================\n');

  // Validação
  if (!fs.existsSync(PDF_INPUT)) {
    console.error(`ERRO: Arquivo não encontrado: ${PDF_INPUT}`);
    process.exit(1);
  }

  // Criar diretório de saída
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Diretório de saída criado: ${OUTPUT_DIR}\n`);
  }

  const pdfBytes = fs.readFileSync(PDF_INPUT);
  const uint8Array = new Uint8Array(pdfBytes);

  // Abrir com pdfjs-dist para leitura de texto
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const totalPages = doc.numPages;

  console.log(`Total de páginas no PDF: ${totalPages}`);
  console.log(`Colaboradores estimados: ${Math.floor(totalPages / 2)}\n`);

  // ============================
  // LISTA DE COLABORADORES
  // ============================
  // Esta é a variável principal solicitada pelo usuário:
  // Array de objetos com { cpf, nomeCompleto, pdfFilename, pdfPath, paginas }
  const colaboradores = [];

  // Iterar de 2 em 2 páginas (cada colaborador = 2 páginas)
  for (let startPage = 1; startPage <= totalPages; startPage += 2) {
    const endPage = Math.min(startPage + 1, totalPages);

    // Extrair texto da primeira página do colaborador (onde ficam CPF e Nome)
    const page = await doc.getPage(startPage);
    const text = await getPageText(page);

    const { cpf, nomeCompleto } = extractCpfAndName(text);

    if (!cpf || !nomeCompleto) {
      console.warn(`⚠️  Página ${startPage}: Não foi possível extrair CPF/Nome. Pulando...`);
      console.warn(`    CPF encontrado: ${cpf || 'N/A'}`);
      console.warn(`    Nome encontrado: ${nomeCompleto || 'N/A'}\n`);
      continue;
    }

    // Montar nome do arquivo
    const safeName = sanitizeFilename(nomeCompleto);
    const safeCpf = cpf.replace(/\D/g, '');
    const pdfFilename = `INFORME_${safeCpf}_${safeName}.pdf`;
    const pdfPath = path.join(OUTPUT_DIR, pdfFilename);

    // Criar PDF individual (índices 0-based para pdf-lib)
    const pageIndices = [startPage - 1]; // primeira página
    if (endPage > startPage) {
      pageIndices.push(endPage - 1); // segunda página
    }

    const subPdfBytes = await createSubPdf(pdfBytes, pageIndices);
    fs.writeFileSync(pdfPath, subPdfBytes);

    // Adicionar à lista de colaboradores
    const colaborador = {
      cpf,
      nomeCompleto,
      pdfFilename,
      pdfPath,
      paginas: pageIndices.map(i => i + 1), // 1-based para exibição
    };
    colaboradores.push(colaborador);

    console.log(`✅ ${colaboradores.length}. ${nomeCompleto}`);
    console.log(`   CPF: ${cpf}`);
    console.log(`   Páginas: ${colaborador.paginas.join(', ')}`);
    console.log(`   Arquivo: ${pdfFilename}\n`);
  }

  // ============================
  // RESUMO FINAL
  // ============================
  console.log('\n=====================================================');
  console.log(' RESUMO DA EXTRAÇÃO');
  console.log('=====================================================');
  console.log(`Total de colaboradores processados: ${colaboradores.length}`);
  console.log(`Diretório de saída: ${OUTPUT_DIR}`);
  console.log('');

  // Exibir lista formatada
  console.log('Lista de Colaboradores:');
  console.log('─────────────────────────────────────────────────────');
  colaboradores.forEach((c, i) => {
    console.log(`  ${String(i + 1).padStart(2, '0')}. ${c.nomeCompleto} | CPF: ${c.cpf} | ${c.pdfFilename}`);
  });
  console.log('─────────────────────────────────────────────────────\n');

  // Salvar lista como JSON para consumo posterior
  const jsonPath = path.join(OUTPUT_DIR, 'colaboradores.json');
  fs.writeFileSync(jsonPath, JSON.stringify(colaboradores, null, 2), 'utf-8');
  console.log(`📄 Lista salva em JSON: ${jsonPath}`);

  return colaboradores;
}

// Executar
main()
  .then((lista) => {
    console.log('\n🎉 Processamento concluído com sucesso!');
    console.log(`   ${lista.length} informes individuais gerados.`);
  })
  .catch((err) => {
    console.error('\n❌ Erro durante o processamento:', err);
    process.exit(1);
  });
