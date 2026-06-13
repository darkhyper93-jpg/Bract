import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';

// ============================================================================
// Importación de temas desde ARCHIVOS (follow-up Agente K) — extracción de TEXTO.
// Self-contained dentro del módulo import: convierte un archivo a texto plano y de ahí el flujo
// reusa el pipeline existente (extractPreview → extractTopics → preview → commit). Funciones puras
// y testeables; NO tocan Prisma, HTTP ni la IA. Solo PDFs de TEXTO (escaneados/imagen = OCR, fuera
// de alcance → devuelven texto vacío y el service lo reporta como error manejado).
// ============================================================================

export type ImportFileKind = 'pdf' | 'pptx' | 'txt' | 'md';

const EXTENSION_KIND: Record<string, ImportFileKind> = {
  '.pdf': 'pdf',
  '.pptx': 'pptx',
  '.txt': 'txt',
  '.md': 'md',
};

// Detecta el tipo por EXTENSIÓN (autoritativa para nuestra allowlist). Devuelve null si no está
// soportado. El mimetype no es confiable entre navegadores/SO, así que la extensión manda.
export function detectFileKind(filename: string): ImportFileKind | null {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot < 0) return null;
  const ext = lower.slice(dot);
  return EXTENSION_KIND[ext] ?? null;
}

// ---- PDF (unpdf, motor pdf.js de Mozilla) ----------------------------------
// unpdf es ESM-only y la API compila a CommonJS → se carga con dynamic import (NodeNext lo preserva).
// DECISIÓN: dynamic import en vez de require por el mismatch CJS↔ESM — ver error.md.
async function extractPdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

// ---- PPTX (ZIP de XML Open XML) --------------------------------------------
// Un .pptx es un ZIP; el texto de las slides vive en ppt/slides/slideN.xml dentro de runs <a:t>,
// agrupados por párrafo <a:p> (cada párrafo/bullet ≈ una línea, normalmente un tema).
const SLIDE_PATH_RE = /^ppt\/slides\/slide(\d+)\.xml$/;

// `ignoreAttributes: true` → el texto del run queda como valor directo del nodo `a:t`. Mantenemos el
// prefijo de namespace (`a:t`, `a:p`) para apuntar exactamente a los runs de texto.
const pptxParser = new XMLParser({ ignoreAttributes: true, removeNSPrefix: false });

function pushRunText(value: unknown, out: string[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const v of value) pushRunText(v, out);
    return;
  }
  if (typeof value === 'object') {
    if ('#text' in (value as Record<string, unknown>)) {
      pushRunText((value as Record<string, unknown>)['#text'], out);
    }
    return;
  }
  const s = String(value);
  if (s.length > 0) out.push(s);
}

// Junta los runs <a:t> de UN párrafo (sin separador: son texto contiguo de la misma línea).
function collectRuns(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collectRuns(n, out);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'a:t') pushRunText(value, out);
      else collectRuns(value, out);
    }
  }
}

// Recorre el árbol y emite UNA línea por párrafo <a:p> (preserva los saltos = bullets/temas).
function collectParagraphLines(node: unknown, lines: string[]): void {
  if (Array.isArray(node)) {
    for (const n of node) collectParagraphLines(n, lines);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'a:p') {
        const paragraphs = Array.isArray(value) ? value : [value];
        for (const p of paragraphs) {
          const runs: string[] = [];
          collectRuns(p, runs);
          const line = runs.join('').replace(/\s+/g, ' ').trim();
          if (line.length > 0) lines.push(line);
        }
      } else {
        collectParagraphLines(value, lines);
      }
    }
  }
}

function extractPptx(buffer: Buffer): string {
  const files = unzipSync(new Uint8Array(buffer));
  const slidePaths = Object.keys(files)
    .filter((p) => SLIDE_PATH_RE.test(p))
    .sort((a, b) => {
      const na = Number(SLIDE_PATH_RE.exec(a)?.[1] ?? 0);
      const nb = Number(SLIDE_PATH_RE.exec(b)?.[1] ?? 0);
      return na - nb;
    });

  const lines: string[] = [];
  for (const path of slidePaths) {
    const xml = strFromU8(files[path] as Uint8Array);
    const parsed = pptxParser.parse(xml) as unknown;
    collectParagraphLines(parsed, lines);
  }
  return lines.join('\n');
}

// ---- Dispatch --------------------------------------------------------------
// Convierte el buffer del archivo a texto plano según su tipo. .txt/.md = decode UTF-8 directo.
// NO aplica el tope de longitud: eso (y el truncado-con-aviso) lo hace el service.
export async function extractTextFromFile(buffer: Buffer, kind: ImportFileKind): Promise<string> {
  switch (kind) {
    case 'pdf':
      return extractPdf(buffer);
    case 'pptx':
      return extractPptx(buffer);
    case 'txt':
    case 'md':
      return buffer.toString('utf-8');
  }
}
