import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { createRequire } from 'module';
import type { Plugin, Connect } from 'vite';

const require = createRequire(import.meta.url);
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const { PDFDocument } = require('pdf-lib');

const OUTPUT_DIR = path.resolve('public', 'informes');
const JSON_PATH = path.join(OUTPUT_DIR, 'colaboradores.json');

const upload = multer({ storage: multer.memoryStorage() });

async function getPageText(page: any) {
  const textContent = await page.getTextContent();
  return textContent.items.map((item: any) => item.str).join(' ');
}

function extractCpfAndName(text: string) {
  const cpfMatch = text.match(/CPF\s+([\d]{3}\.[\d]{3}\.[\d]{3}-[\d]{2})/);
  const cpf = cpfMatch ? cpfMatch[1] : null;

  const nameMatch = text.match(/Nome Completo\s+([A-ZÀ-ÚÇ\s]+?)(?=\s+Natureza)/);
  const nomeCompleto = nameMatch ? nameMatch[1].trim() : null;

  return { cpf, nomeCompleto };
}

function sanitizeFilename(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

async function processPdfBuffer(buffer: Buffer) {
  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const totalPages = doc.numPages;

  let colaboradores: any[] = [];
  if (fs.existsSync(JSON_PATH)) {
    try {
      colaboradores = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
    } catch(e) {}
  }

  const processedNames: string[] = [];

  for (let startPage = 1; startPage <= totalPages; startPage += 2) {
    const endPage = Math.min(startPage + 1, totalPages);
    const page = await doc.getPage(startPage);
    const text = await getPageText(page);
    const { cpf, nomeCompleto } = extractCpfAndName(text);

    if (!cpf || !nomeCompleto) continue;

    const safeName = sanitizeFilename(nomeCompleto);
    const safeCpf = cpf.replace(/\D/g, '');
    const pdfFilename = `INFORME_${safeCpf}_${safeName}.pdf`;
    const pdfPath = path.join(OUTPUT_DIR, pdfFilename);

    const srcDoc = await PDFDocument.load(buffer);
    const newDoc = await PDFDocument.create();
    
    // Page indexes in pdf-lib are 0-based
    const copiedPages = await newDoc.copyPages(srcDoc, [startPage - 1, ...(endPage > startPage ? [endPage - 1] : [])]);
    copiedPages.forEach((p: any) => newDoc.addPage(p));
    
    const subPdfBytes = await newDoc.save();
    fs.writeFileSync(pdfPath, subPdfBytes);

    // Remove if already exists to overwrite
    colaboradores = colaboradores.filter(c => c.cpf !== cpf);

    colaboradores.push({
      cpf,
      nomeCompleto,
      pdfFilename,
      pdfPath: pdfPath, // Not entirely used in web, URL relies on filename
      paginas: [startPage, endPage]
    });
    processedNames.push(nomeCompleto);
  }

  // Sort and sync to JSON
  colaboradores.sort((a,b) => a.nomeCompleto.localeCompare(b.nomeCompleto));
  fs.writeFileSync(JSON_PATH, JSON.stringify(colaboradores, null, 2), 'utf-8');

  return { colaboradores, added: processedNames.length, names: processedNames };
}

export default function informesPlugin(): Plugin {
  return {
    name: 'vite-plugin-informes',
    configureServer(server) {
      // DELETE Mass ou Unitário
      server.middlewares.use('/api/delete', (req, res, next) => {
        if (req.method !== 'POST' && req.method !== 'DELETE') return next();
        
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { cpfs } = JSON.parse(body); // { cpfs: string[] }
                if (!Array.isArray(cpfs)) throw new Error("Invalid payload");
                
                let colaboradores: any[] = [];
                if (fs.existsSync(JSON_PATH)) {
                    colaboradores = JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
                }
                
                // Excluir arquivos fisicos correspondentes aos CPFs
                cpfs.forEach(cpf => {
                    const colab = colaboradores.find(c => c.cpf === cpf);
                    if (colab) {
                        try {
                            const p = path.join(OUTPUT_DIR, colab.pdfFilename);
                            if (fs.existsSync(p)) fs.unlinkSync(p);
                        } catch(e) {}
                    }
                });

                // Manter apenas CPFs que NÃO estão na lista de exclusão
                colaboradores = colaboradores.filter(c => !cpfs.includes(c.cpf));
                fs.writeFileSync(JSON_PATH, JSON.stringify(colaboradores, null, 2), 'utf-8');

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, count: cpfs.length, colaboradores }));
            } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
            }
        });
      });

      // UPLOAD e Processamento
      server.middlewares.use('/api/upload', (req, res, next) => {
        if (req.method !== 'POST') return next();
        
        // Usar multer como middleware connect
        upload.single('file')(req as any, res as any, async (err: any) => {
          if (err) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ error: err.message }));
          }

          const fileReq = req as any;
          if (!fileReq.file) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Nenhum arquivo enviado.' }));
          }

          try {
            const buffer = fileReq.file.buffer;
            const result = await processPdfBuffer(buffer);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, ...result }));
          } catch(e: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: e.message }));
          }
        });
      });
    }
  };
}
