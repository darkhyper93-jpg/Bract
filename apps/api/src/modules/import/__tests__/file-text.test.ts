import { describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';

// `extractPdf` carga unpdf con dynamic import → vi.mock intercepta el módulo (forma de unpdf:
// getDocumentProxy + extractText con { text }). Así el test no necesita un PDF real.
vi.mock('unpdf', () => ({
  getDocumentProxy: vi.fn(async () => ({ numPages: 1 })),
  extractText: vi.fn(async () => ({ totalPages: 1, text: 'Tema A\nTema B' })),
}));

import { detectFileKind, extractTextFromFile } from '../file-text.js';

// Arma un .pptx mínimo en memoria: solo las slides nos importan (el resto del ZIP es irrelevante
// para la extracción de texto). Cada <a:p> es un párrafo/línea; los <a:r><a:t> son runs contiguos.
function makePptx(slides: Record<string, string>): Buffer {
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8('<Types/>'),
  };
  for (const [path, xml] of Object.entries(slides)) {
    files[path] = strToU8(xml);
  }
  return Buffer.from(zipSync(files));
}

describe('detectFileKind', () => {
  it('detecta por extensión (case-insensitive) y rechaza lo no soportado', () => {
    expect(detectFileKind('apuntes.pdf')).toBe('pdf');
    expect(detectFileKind('PROGRAMA.PPTX')).toBe('pptx');
    expect(detectFileKind('notas.txt')).toBe('txt');
    expect(detectFileKind('readme.md')).toBe('md');
    expect(detectFileKind('imagen.png')).toBeNull();
    expect(detectFileKind('sinextension')).toBeNull();
    expect(detectFileKind('archivo.tar.gz')).toBeNull();
  });
});

describe('extractTextFromFile — txt/md', () => {
  it('decodifica el buffer como UTF-8 tal cual', async () => {
    const text = await extractTextFromFile(Buffer.from('# Título\nÁrea\n', 'utf-8'), 'md');
    expect(text).toBe('# Título\nÁrea\n');
  });
});

describe('extractTextFromFile — pdf (unpdf mockeado)', () => {
  it('devuelve el texto del motor pdf.js', async () => {
    const text = await extractTextFromFile(Buffer.from('%PDF-1.4 fake'), 'pdf');
    expect(text).toBe('Tema A\nTema B');
  });
});

describe('extractTextFromFile — pptx', () => {
  it('extrae una línea por párrafo, junta runs y respeta el orden de slides', async () => {
    const buffer = makePptx({
      'ppt/slides/slide1.xml':
        '<p:sld xmlns:a="x"><a:p><a:r><a:t>Inte</a:t></a:r><a:r><a:t>grales</a:t></a:r></a:p>' +
        '<a:p><a:r><a:t>Derivadas</a:t></a:r></a:p></p:sld>',
      'ppt/slides/slide2.xml': '<p:sld xmlns:a="x"><a:p><a:r><a:t>Límites</a:t></a:r></a:p></p:sld>',
    });

    const text = await extractTextFromFile(buffer, 'pptx');

    // Runs del mismo párrafo se concatenan ("Integrales"); párrafos y slides separan por línea.
    expect(text).toBe('Integrales\nDerivadas\nLímites');
  });

  it('ignora slides sin texto y devuelve cadena vacía si no hay runs', async () => {
    const buffer = makePptx({
      'ppt/slides/slide1.xml': '<p:sld xmlns:a="x"><a:p></a:p></p:sld>',
    });
    expect(await extractTextFromFile(buffer, 'pptx')).toBe('');
  });
});
