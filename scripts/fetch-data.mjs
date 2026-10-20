#!/usr/bin/env node
/**
 * Descarga y normaliza todos los datos oficiales del sitio.
 *
 *   node scripts/fetch-data.mjs            # todo
 *   node scripts/fetch-data.mjs ine euro   # solo algunas fuentes
 *
 * Escribe src/data/generated/*.json. Cada fichero lleva dentro la URL exacta
 * de la que salio y la fecha de descarga, para que el apartado de metodologia
 * del sitio pueda citarse a si mismo sin que nadie copie nada a mano.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readXlsx } from './lib/xlsx.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/data/generated');
const NOW = new Date().toISOString().slice(0, 10);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

const INE = 'https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA';
const EUROSTAT = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const SS_PAGE =
  'https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/est23/est24';

const log = (...a) => console.log('  ', ...a);

async function get(url, as = 'json') {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  if (as === 'json') return res.json();
  if (as === 'text') return res.text();
  return Buffer.from(await res.arrayBuffer());
}

async function save(name, payload) {
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, name), JSON.stringify(payload, null, 2) + '\n');
  log(`-> ${name}`);
}

/* ------------------------------------------------------------------ INE --- */

/** Una tabla del INE: devuelve las series con su nombre y { anyo: valor }. */
async function ineTable(id) {
  const raw = await get(`${INE}/${id}`);
  return raw.map((s) => ({
    nombre: s.Nombre.trim(),
    valores: Object.fromEntries(s.Data.map((d) => [d.Anyo, d.Valor])),
  }));
}

/** Busca la serie cuyo nombre contiene todos los fragmentos dados. */
const pick = (series, ...frags) => {
  const hit = series.find((s) => frags.every((f) => s.nombre.includes(f)));
  if (!hit) throw new Error(`serie no encontrada: ${frags.join(' + ')}`);
  return hit;
};

/** { anyo: valor } -> [{ anyo, valor }] ordenado y redondeado. */
const asSeries = (valores, decimals = 2) =>
  Object.entries(valores)
    .map(([anyo, valor]) => ({ anyo: +anyo, valor: valor == null ? null : +valor.toFixed(decimals) }))
    .sort((a, b) => a.anyo - b.anyo);

async function fetchIne() {
  console.log('INE · Proyecciones de Poblacion');

  const [nac, def, prop, depTotal, dep64, pob] = await Promise.all(
    [36644, 36646, 36666, 36668, 36670, 36643].map(ineTable)
  );

  // Piramide: agregamos las edades simples en tramos de cinco anos.
  const edadDe = (nombre) => {
    if (nombre.includes('Todas las edades')) return null;
    if (nombre.includes('100 y más')) return 100;
    const m = nombre.match(/(\d+)\s+a[ñn]os?/);
    return m ? +m[1] : null;
  };
  const tramo = (e) => (e >= 100 ? '100+' : `${Math.floor(e / 5) * 5}-${Math.floor(e / 5) * 5 + 4}`);
  const anyosPiramide = [2026, 2040, 2050, 2060, 2075];

  const piramide = {};
  for (const sexo of ['Hombres', 'Mujeres']) {
    piramide[sexo.toLowerCase()] = {};
    for (const s of pob.filter((x) => x.nombre.startsWith(`${sexo}.`))) {
      const e = edadDe(s.nombre);
      if (e == null) continue;
      const t = tramo(e);
      for (const a of anyosPiramide) {
        if (s.valores[a] == null) continue;
        piramide[sexo.toLowerCase()][t] ??= {};
        piramide[sexo.toLowerCase()][t][a] = (piramide[sexo.toLowerCase()][t][a] ?? 0) + s.valores[a];
      }
    }
  }
  for (const sexo of Object.keys(piramide))
    for (const t of Object.keys(piramide[sexo]))
      for (const a of Object.keys(piramide[sexo][t]))
        piramide[sexo][t][a] = Math.round(piramide[sexo][t][a]);

  await save('ine-proyecciones.json', {
    fuente: {
      organismo: 'Instituto Nacional de Estadística (INE)',
      operacion: 'Proyecciones de Población, edición 2026-2075',
      api: `${INE}/{idTabla}`,
      tablas: {
        36644: 'Nacimientos de madre residente en España',
        36646: 'Defunciones de residentes en España',
        36666: 'Proporción de población mayor de cierta edad',
        36668: 'Tasa de Dependencia',
        36670: 'Tasa de Dependencia de la población mayor de 64 años',
        36643: 'Población residente en España a 1 de enero, por sexo, edad y año',
      },
      descargado: NOW,
      nota: 'Las proyecciones no son una predicción: describen qué pasaría si se mantuvieran las tendencias demográficas actuales (advertencia explícita del INE).',
    },
    poblacionTotal: asSeries(pick(pob, 'Total.', 'Todas las edades').valores, 0),
    nacimientos: asSeries(pick(nac, 'Total.', 'Total generación').valores, 0),
    defunciones: asSeries(pick(def, 'Total.', 'Total generación').valores, 0),
    proporcion65mas: asSeries(pick(prop, '65 y más').valores),
    proporcion80mas: asSeries(pick(prop, '80 y más').valores),
    tasaDependenciaTotal: asSeries(pick(depTotal, 'Total Nacional').valores),
    tasaDependencia64mas: asSeries(pick(dep64, 'Total Nacional').valores),
    piramide: { anyos: anyosPiramide, datos: piramide },
  });
}

/* ------------------------------------------------------------- Eurostat --- */

/** Aplana una respuesta JSON-stat a [{ dims..., anyo, valor }]. */
function jsonstat(d) {
  const dims = d.id;
  const sizes = d.size;
  const cats = dims.map((k) => {
    const idx = d.dimension[k].category.index;
    const inv = {};
    for (const [code, i] of Object.entries(idx)) inv[i] = code;
    return inv;
  });
  const out = [];
  for (const [flat, valor] of Object.entries(d.value)) {
    if (valor == null) continue;
    let rest = +flat;
    const coords = [];
    for (let i = sizes.length - 1; i >= 0; i--) {
      coords[i] = rest % sizes[i];
      rest = Math.floor(rest / sizes[i]);
    }
    const row = { valor };
    dims.forEach((k, i) => (row[k] = cats[i][coords[i]]));
    out.push(row);
  }
  return out;
}

const esq = (params) =>
  Object.entries(params)
    .flatMap(([k, v]) => (Array.isArray(v) ? v.map((x) => `${k}=${x}`) : [`${k}=${v}`]))
    .join('&');

async function eurostat(dataset, params) {
  const url = `${EUROSTAT}/${dataset}?${esq({ format: 'JSON', ...params })}`;
  return { url, rows: jsonstat(await get(url)) };
}

async function fetchEurostat() {
  console.log('Eurostat · gasto en pensiones, PIB y demografia');

  const COMP = ['ES', 'EU27_2020', 'DE', 'FR', 'IT', 'PT', 'NL', 'SE', 'EL', 'PL', 'DK', 'AT'];

  const serie = await eurostat('spr_exp_pens', {
    unit: 'PC_GDP', spdepb: 'TOTAL', spdepm: 'TOTAL', geo: COMP,
  });
  const ranking = await eurostat('spr_exp_pens', {
    unit: 'PC_GDP', spdepb: 'TOTAL', spdepm: 'TOTAL', lastTimePeriod: 1,
  });
  const tipos = await eurostat('spr_exp_pens', {
    unit: 'PC_GDP', spdepm: 'TOTAL', geo: 'ES', lastTimePeriod: 1,
    spdepb: ['TOTAL', 'OLD', 'AOLD', 'DIS', 'SRV'],
  });
  const pib = await eurostat('nama_10_gdp', { unit: 'CP_MEUR', na_item: 'B1GQ', geo: 'ES' });
  const vital = await eurostat('demo_gind', { geo: 'ES', indic_de: ['LBIRTH', 'DEATH'] });
  const fecundidad = await eurostat('demo_find', { geo: 'ES', indic_de: 'TOTFERRT' });

  const porPais = {};
  for (const r of serie.rows) (porPais[r.geo] ??= []).push({ anyo: +r.time, valor: +r.valor.toFixed(2) });
  for (const g of Object.keys(porPais)) porPais[g].sort((a, b) => a.anyo - b.anyo);

  const anyoRanking = ranking.rows[0]?.time;
  const UE_AGREGADOS = /^(EU|EA)\d|^EU27|^EA\d/;

  await save('eurostat.json', {
    fuente: {
      organismo: 'Eurostat (Comisión Europea)',
      datasets: {
        spr_exp_pens: 'Pension expenditure (ESSPROS), % del PIB',
        nama_10_gdp: 'PIB a precios corrientes, millones de euros',
        demo_gind: 'Balance demográfico: nacimientos y defunciones',
        demo_find: 'Indicador coyuntural de fecundidad',
      },
      urls: {
        gastoSerie: serie.url, gastoRanking: ranking.url, gastoPorTipo: tipos.url,
        pib: pib.url, vital: vital.url, fecundidad: fecundidad.url,
      },
      descargado: NOW,
      nota: 'ESSPROS mide la protección social con criterio homogéneo entre países: incluye pensiones públicas y privadas obligatorias e incluye las de supervivencia e incapacidad. No es comparable sin más con el gasto del presupuesto de la Seguridad Social española.',
    },
    anyoRanking: anyoRanking ? +anyoRanking : null,
    gastoPibPorPais: porPais,
    rankingUe: ranking.rows
      .filter((r) => !UE_AGREGADOS.test(r.geo))
      .map((r) => ({ pais: r.geo, valor: +r.valor.toFixed(2) }))
      .sort((a, b) => b.valor - a.valor),
    agregadosUe: ranking.rows
      .filter((r) => UE_AGREGADOS.test(r.geo))
      .map((r) => ({ pais: r.geo, valor: +r.valor.toFixed(2) })),
    gastoPorTipoEs: tipos.rows.map((r) => ({ tipo: r.spdepb, valor: +r.valor.toFixed(2), anyo: +r.time })),
    pibEspana: pib.rows.map((r) => ({ anyo: +r.time, valor: r.valor })).sort((a, b) => a.anyo - b.anyo),
    nacimientos: vital.rows.filter((r) => r.indic_de === 'LBIRTH')
      .map((r) => ({ anyo: +r.time, valor: r.valor })).sort((a, b) => a.anyo - b.anyo),
    defunciones: vital.rows.filter((r) => r.indic_de === 'DEATH')
      .map((r) => ({ anyo: +r.time, valor: r.valor })).sort((a, b) => a.anyo - b.anyo),
    fecundidad: fecundidad.rows.map((r) => ({ anyo: +r.time, valor: r.valor })).sort((a, b) => a.anyo - b.anyo),
  });
}

/* ------------------------------------------------- Seguridad Social (SS) --- */

const num = (v) => (typeof v === 'number' ? v : null);

/** Las hojas traen las etiquetas en varias filas; buscamos por regimen/clase. */
function filaPorEtiqueta(rows, etiqueta) {
  return rows.find((r) => typeof r?.[0] === 'string' && r[0].trim().toLowerCase() === etiqueta.toLowerCase());
}

async function fetchSeguridadSocial() {
  console.log('Seguridad Social · pensiones contributivas en vigor');

  // La pagina republica cada mes con una URL nueva (WebSphere mete un id de
  // contenido distinto), asi que localizamos los XLSX del mes vigente leyendo
  // la propia pagina en lugar de fijar enlaces que caducan.
  const html = await get(SS_PAGE, 'text');
  const encontrar = (prefijo) => {
    const re = new RegExp(`href="([^"]*wcm/connect[^"]*/${prefijo}(\\d{6})\\.xlsx[^"]*)"`, 'g');
    const m = re.exec(html);
    if (!m) throw new Error(`no se encontro el XLSX ${prefijo}* en ${SS_PAGE}`);
    const href = m[1].replace(/&amp;/g, '&');
    return { url: href.startsWith('http') ? href : `https://www.seg-social.es${href}`, periodo: m[2] };
  };

  const serieRef = encontrar('S');
  const regimenRef = encontrar('REG');
  const nominaRef = encontrar('ICONCEPTOS');
  log(`periodo publicado: ${serieRef.periodo}`);

  const [serieBuf, regimenBuf, nominaBuf] = await Promise.all(
    [serieRef, regimenRef, nominaRef].map((r) => get(r.url, 'buffer'))
  );

  // --- Evolucion mensual (hoja S_Total): ano | mes | numero | importe | media
  const sTotal = readXlsx(serieBuf)['S_Total'];
  const CLASES = ['total', 'incapacidadPermanente', 'jubilacion', 'viudedad', 'orfandad', 'favorFamiliares'];
  const MES = /^\s*\d{1,2}\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/i;
  const evolucion = [];
  let anyoActual = null;
  for (const r of sTotal) {
    const c0 = r[0];
    // Tras el bloque de cifras la hoja repite todo como variacion interanual.
    // Esa cabecera marca el final de lo que nos interesa.
    if (typeof c0 === 'string' && c0.trim() === 'Periodo') break;

    // La celda del ano solo aparece en su primera fila (va combinada hacia
    // abajo), y cuando falta el mes sube a la columna A: el desplazamiento de
    // las columnas de datos depende de eso.
    if (typeof c0 === 'number' && c0 > 1990 && c0 < 2200) anyoActual = c0;

    // Localizamos la celda del mes y leemos los datos a partir de la siguiente:
    // asi da igual en que columna acabe cayendo.
    const iMes = r.findIndex((c, i) => i < 3 && typeof c === 'string' && MES.test(c));
    if (iMes < 0) continue;
    const mes = r[iMes].trim();
    const desplazamiento = iMes + 1;
    if (num(r[desplazamiento]) == null) continue;   // meses aun sin publicar

    const punto = { anyo: anyoActual, periodo: mes, clases: {} };
    CLASES.forEach((clase, i) => {
      const base = desplazamiento + i * 3;
      const numero = num(r[base]);
      if (numero == null) return;
      punto.clases[clase] = {
        numero,
        importeMilesEur: num(r[base + 1]),
        pensionMediaEurMes: num(r[base + 2]),
      };
    });
    if (punto.clases.total) evolucion.push(punto);
  }

  // --- Snapshot por regimen (hoja Regimen_clase)
  const regimenSheets = readXlsx(regimenBuf);
  const regClase = regimenSheets[Object.keys(regimenSheets).find((k) => k.includes('clase') && !k.includes('sexo'))];
  const REGIMENES = [
    ['Total sistema', 'totalSistema'], ['General', 'general'],
    ['Trabajadores autónomos', 'autonomos'], ['Trabajadores del mar', 'mar'],
    ['Minería del carbón', 'carbon'], ['Accidentes de trabajo', 'accidentesTrabajo'],
    ['Enfermedades profesionales', 'enfermedadesProfesionales'], ['SOVI', 'sovi'],
  ];
  // La hoja parte las clases en dos bloques de filas; recogemos ambos.
  const bloques = [];
  for (const r of regClase)
    if (typeof r?.[0] === 'string' && r[0].trim() === 'RÉGIMEN') bloques.push(regClase.indexOf(r));

  const porRegimen = {};
  for (const [etiqueta, clave] of REGIMENES) {
    const filas = regClase.filter(
      (r) => typeof r?.[0] === 'string' && r[0].trim() === etiqueta
    );
    const clasesA = ['total', 'incapacidadPermanente', 'jubilacion'];
    const clasesB = ['viudedad', 'orfandad', 'favorFamiliares'];
    const lee = (fila, clases) => {
      const o = {};
      clases.forEach((c, i) => {
        o[c] = {
          numero: num(fila?.[1 + i * 3]),
          importeEur: num(fila?.[2 + i * 3]),
          pensionMediaEurMes: num(fila?.[3 + i * 3]),
        };
      });
      return o;
    };
    porRegimen[clave] = { etiqueta, ...lee(filas[0], clasesA), ...lee(filas[1], clasesB) };
  }

  // --- Descomposicion de la nomina (hoja Importe, fila "Total sistema", ambos sexos)
  const nominaSheets = readXlsx(nominaBuf);
  const imp = nominaSheets[Object.keys(nominaSheets).find((k) => k.trim() === 'Importe')];
  const filaTotal = filaPorEtiqueta(imp, 'Total sistema');
  const descomposicion = {
    totalMillonesEur: num(filaTotal?.[1]),
    pensionInicial: num(filaTotal?.[2]),
    revalorizacion: num(filaTotal?.[3]),
    complementoMinimos: num(filaTotal?.[4]),
    otrosComplementos: num(filaTotal?.[5]),
  };
  // Hombres y mujeres son las siguientes apariciones de "Total sistema".
  const totales = imp.filter((r) => typeof r?.[0] === 'string' && r[0].trim() === 'Total sistema');
  const porSexo = {};
  ['ambos', 'hombres', 'mujeres'].forEach((k, i) => {
    porSexo[k] = { totalMillonesEur: num(totales[i]?.[1]) };
  });

  const ultimo = evolucion.at(-1);
  await save('seguridad-social.json', {
    fuente: {
      organismo: 'Instituto Nacional de la Seguridad Social (INSS)',
      publicacion: 'Pensiones contributivas del Sistema de la Seguridad Social en vigor',
      pagina: SS_PAGE,
      ficheros: {
        series: serieRef.url, regimenes: regimenRef.url, nomina: nominaRef.url,
      },
      periodo: serieRef.periodo,
      descargado: NOW,
      nota: 'Pensiones en vigor a primero de mes. "Número" cuenta pensiones, no personas: una misma persona puede cobrar más de una (por ejemplo jubilación y viudedad).',
    },
    ultimoPeriodo: ultimo ? { anyo: ultimo.anyo, periodo: ultimo.periodo } : null,
    snapshot: ultimo?.clases ?? null,
    evolucion,
    porRegimen,
    descomposicionNomina: descomposicion,
    nominaPorSexo: porSexo,
  });
}

/* ----------------------------------------------------------------- main --- */

const TAREAS = { ine: fetchIne, euro: fetchEurostat, ss: fetchSeguridadSocial };
const pedidas = process.argv.slice(2).filter((a) => a in TAREAS);
const aEjecutar = pedidas.length ? pedidas : Object.keys(TAREAS);

let fallos = 0;
for (const clave of aEjecutar) {
  try {
    await TAREAS[clave]();
  } catch (err) {
    fallos++;
    console.error(`FALLO en "${clave}": ${err.message}`);
  }
}
console.log(fallos ? `\nTerminado con ${fallos} fallo(s).` : '\nTodo correcto.');
process.exit(fallos ? 1 : 0);
