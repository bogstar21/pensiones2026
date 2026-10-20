// Lector XLSX minimo, sin dependencias.
// Un .xlsx es un ZIP con XML dentro. Solo necesitamos leer celdas, asi que
// descomprimimos las entradas que nos interesan y parseamos el XML a mano.
import { inflateRawSync } from 'node:zlib';

/** Lee el directorio central del ZIP y devuelve { nombre: Buffer }. */
function unzip(buf) {
  const files = {};
  // Localizamos el "End of central directory record" (firma 0x06054b50).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('XLSX: no se encontro el fin del directorio ZIP');

  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // Cabecera local: el campo "extra" puede diferir del central, hay que releerlo.
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);

    files[name] = method === 0 ? raw : inflateRawSync(raw);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
const unescapeXml = (s) =>
  s.replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
   .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d));

/** sharedStrings.xml -> array de cadenas. */
function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join('')
  );
}

/** "BC12" -> 54 (indice de columna, base 0). */
function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)[0];
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Devuelve { nombreHoja: filas[][] } con valores crudos (numero | string | null).
 * Las formulas se leen por su valor cacheado, que es lo que publica la fuente.
 */
export function readXlsx(buf) {
  const files = unzip(buf);
  const strings = parseSharedStrings(files['xl/sharedStrings.xml']?.toString('utf8'));

  // Mapa rId -> fichero de hoja, desde las relaciones del workbook.
  const rels = files['xl/_rels/workbook.xml.rels']?.toString('utf8') ?? '';
  const relTarget = {};
  for (const m of rels.matchAll(/<Relationship([^>]*)\/>/g)) {
    const id = m[1].match(/Id="([^"]+)"/)?.[1];
    const target = m[1].match(/Target="([^"]+)"/)?.[1];
    if (id && target) relTarget[id] = target.replace(/^\/?(xl\/)?/, 'xl/');
  }

  const wb = files['xl/workbook.xml'].toString('utf8');
  const sheets = {};

  for (const m of wb.matchAll(/<sheet([^>]*)\/>/g)) {
    const attrs = m[1];
    const name = unescapeXml(attrs.match(/name="([^"]*)"/)?.[1] ?? '');
    const rid = attrs.match(/r:id="([^"]+)"/)?.[1];
    const path = relTarget[rid];
    const xml = files[path]?.toString('utf8');
    if (!xml) continue;

    const rows = [];
    for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells = [];
      // Los atributos van en perezoso a proposito: con `[^>]*` la alternativa
      // golosa se traga la barra de `<c .../>` y descoloca celdas y tipos.
      for (const cm of rm[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs2 = cm[1];
        const body = cm[2] ?? '';
        const ref = attrs2.match(/r="([A-Z]+\d+)"/)?.[1];
        const type = attrs2.match(/t="(\w+)"/)?.[1];
        const idx = ref ? colIndex(ref) : cells.length;

        let value = null;
        if (type === 'inlineStr') {
          value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => unescapeXml(t[1])).join('');
        } else {
          const v = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1];
          if (v != null) {
            if (type === 's') value = strings[+v] ?? null;
            else if (type === 'str' || type === 'e') value = unescapeXml(v);
            else value = Number(v);
          }
        }
        while (cells.length < idx) cells.push(null);
        cells[idx] = value;
      }
      rows.push(cells);
    }
    sheets[name] = rows;
  }
  return sheets;
}
