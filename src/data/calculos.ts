/**
 * Todas las cifras derivadas del sitio se calculan aqui, una sola vez, y cada
 * una viaja con su formula, sus entradas y su fuente. El apartado de
 * metodologia renderiza este mismo objeto: si cambia el dato, cambia el texto.
 */
import ss from './generated/seguridad-social.json';
import euro from './generated/eurostat.json';
import ine from './generated/ine-proyecciones.json';
import ue from './proyecciones-ue.json';
import sistema from './sistema.json';

export type Entrada = { etiqueta: string; valor: string; fuenteId: string };
export type Calculo = {
  id: string;
  titulo: string;
  formula: string;
  entradas: Entrada[];
  resultado: string;
  nota?: string;
};

/* ------------------------------------------------------------- utilidades - */

// Intl con 'es-ES' no agrupa los numeros de cuatro cifras (1375 en vez de
// 1.375), lo que descuadra las tablas. 'de-DE' produce el mismo formato que
// el español —punto para millares, coma decimal— y si agrupa siempre.
const ES = 'de-DE';
export const num = (v: number, dec = 0) =>
  v.toLocaleString(ES, { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const pct = (v: number, dec = 1) => `${num(v, dec)} %`;
export const eur = (v: number, dec = 0) => `${num(v, dec)} €`;
/** Millones de euros, siempre en la misma unidad: "202.974 M€". */
export const meur = (v: number) => `${num(v)} M€`;
/** La misma cifra escrita en prosa y redondeada: "203.000 millones de euros". */
export const meurTexto = (v: number, redondeoAMiles = true) =>
  `${num(redondeoAMiles ? Math.round(v / 1000) * 1000 : v)} millones de euros`;

const anyoDe = (serie: { anyo: number; valor: number | null }[], anyo: number) =>
  serie.find((p) => p.anyo === anyo)?.valor ?? null;
const ultimo = <T extends { anyo: number }>(serie: T[]) => serie[serie.length - 1];

/* ------------------------------------------------------- datos de partida - */

export const PERIODO_SS = ss.ultimoPeriodo!;
/** La fuente escribe "1 septiembre"; en texto corrido pide la preposicion. */
export const periodoTexto = (p: { anyo: number; periodo: string }) =>
  `${p.periodo.trim().replace(/^(\d+)\s+/, '$1 de ')} de ${p.anyo}`;
export const SNAPSHOT = ss.snapshot!;

/** PIB del ultimo ano cerrado disponible en Eurostat. */
export const PIB = ultimo(euro.pibEspana);

export const CLASES = [
  { clave: 'jubilacion', etiqueta: 'Jubilación' },
  { clave: 'viudedad', etiqueta: 'Viudedad' },
  { clave: 'incapacidadPermanente', etiqueta: 'Incapacidad permanente' },
  { clave: 'orfandad', etiqueta: 'Orfandad' },
  { clave: 'favorFamiliares', etiqueta: 'Favor de familiares' },
] as const;

/* ------------------------------------------------------------- resultados - */

// 1. La nomina mensual se paga 14 veces al ano: 12 ordinarias y 2 extras.
const PAGAS = 14;
const nominaMensualMillones = SNAPSHOT.total.importeMilesEur! / 1000;
export const nominaAnualMillones = nominaMensualMillones * PAGAS;

// 2. Peso sobre el PIB del ultimo ano cerrado.
export const nominaSobrePib = (nominaAnualMillones / PIB.valor) * 100;

// 3. Cotizantes por pension en vigor.
export const afiliadosPorPension =
  sistema.afiliacion.afiliadosMediosSeptiembre2026 / SNAPSHOT.total.numero;

// 4. Reparto de la nomina entre hombres y mujeres.
const nom = ss.nominaPorSexo;
export const cuotaNominaMujeres = (nom.mujeres.totalMillonesEur! / nom.ambos.totalMillonesEur!) * 100;

// 5. Cuanto de la nomina es revalorizacion acumulada y no pension inicial.
const d = ss.descomposicionNomina;
export const cuotaRevalorizacion = (d.revalorizacion! / d.totalMillonesEur!) * 100;
export const cuotaComplementoMinimos = (d.complementoMinimos! / d.totalMillonesEur!) * 100;

// 6. Caida de la natalidad desde el maximo de la serie moderna.
const nacPico = euro.nacimientos.reduce((a, b) => (b.valor > a.valor ? b : a));
const nacUltimo = ultimo(euro.nacimientos);
export const caidaNacimientos = ((nacUltimo.valor - nacPico.valor) / nacPico.valor) * 100;

// 7. Saldo vegetativo proyectado por el INE al final del horizonte.
const nacFin = ultimo(ine.nacimientos);
const defFin = ultimo(ine.defunciones);
export const saldoVegetativoFinal = nacFin.valor! - defFin.valor!;

// 8. Pensionistas por cada 100 ocupados segun la proyeccion europea.
const iAnyo = (a: number) => ue.anyos.indexOf(a);
export const dependenciaSistema = (anyo: number) =>
  ue.dependenciaSistema.series.ratioDependenciaSistemaPct[iAnyo(anyo)];

/* --------------------------------------------- fichas para la metodologia - */

export const CALCULOS: Calculo[] = [
  {
    id: 'nomina-anual',
    titulo: 'Gasto anual en pensiones contributivas',
    formula: 'nómina mensual × 14 pagas',
    entradas: [
      {
        etiqueta: `Nómina a ${periodoTexto(PERIODO_SS)}`,
        valor: meur(nominaMensualMillones),
        fuenteId: 'inss-pensiones',
      },
      { etiqueta: 'Pagas al año', valor: String(PAGAS), fuenteId: 'boe-revalorizacion-2026' },
    ],
    resultado: meur(nominaAnualMillones),
    nota:
      'Anualizar la nómina de un mes es una aproximación: supone que la nómina se mantiene ' +
      'constante todo el año, cuando en realidad crece mes a mes. El resultado queda por ' +
      'tanto algo por debajo del gasto que se liquidará. Tampoco incluye las pensiones no ' +
      'contributivas ni las de Clases Pasivas.',
  },
  {
    id: 'nomina-pib',
    titulo: 'Gasto en pensiones contributivas sobre el PIB',
    formula: 'gasto anual ÷ PIB a precios corrientes × 100',
    entradas: [
      { etiqueta: 'Gasto anual estimado', valor: meur(nominaAnualMillones), fuenteId: 'inss-pensiones' },
      { etiqueta: `PIB de ${PIB.anyo}`, valor: meur(PIB.valor), fuenteId: 'eurostat-pib' },
    ],
    resultado: pct(nominaSobrePib),
    nota:
      'El numerador es de 2026 y el denominador, del último año cerrado. Como el PIB sigue ' +
      'creciendo, el porcentaje real de 2026 será algo menor. Para comparar entre países hay ' +
      'que usar la serie ESSPROS de Eurostat, que mide un perímetro distinto y más amplio.',
  },
  {
    id: 'cotizantes-por-pension',
    titulo: 'Cotizantes por cada pensión en vigor',
    formula: 'afiliados medios ÷ número de pensiones',
    entradas: [
      {
        etiqueta: 'Afiliados medios (septiembre de 2026)',
        valor: num(sistema.afiliacion.afiliadosMediosSeptiembre2026),
        fuenteId: 'miscm-afiliacion',
      },
      { etiqueta: 'Pensiones contributivas en vigor', valor: num(SNAPSHOT.total.numero), fuenteId: 'inss-pensiones' },
    ],
    resultado: num(afiliadosPorPension, 2),
    nota:
      'Es la ratio por pensión, no por pensionista. Como hay personas que cobran dos ' +
      'pensiones, la ratio por pensionista que publica el Gobierno sale más alta. Se ' +
      'muestra la versión por pensión porque sus dos términos vienen de estadísticas ' +
      'publicadas íntegramente.',
  },
  {
    id: 'brecha-nomina',
    titulo: 'Parte de la nómina que cobran las mujeres',
    formula: 'nómina de mujeres ÷ nómina total × 100',
    entradas: [
      { etiqueta: 'Nómina de mujeres', valor: meur(nom.mujeres.totalMillonesEur!), fuenteId: 'inss-pensiones' },
      { etiqueta: 'Nómina total', valor: meur(nom.ambos.totalMillonesEur!), fuenteId: 'inss-pensiones' },
    ],
    resultado: pct(cuotaNominaMujeres),
    nota:
      'Las mujeres son mayoría entre los pensionistas y, sin embargo, cobran menos de la ' +
      'mitad del dinero: concentran las pensiones de viudedad, que son las más bajas, y ' +
      'arrastran carreras de cotización más cortas.',
  },
  {
    id: 'peso-revalorizacion',
    titulo: 'Parte de la nómina que es revalorización acumulada',
    formula: 'importe por revalorización ÷ nómina total × 100',
    entradas: [
      { etiqueta: 'Revalorización', valor: meur(d.revalorizacion!), fuenteId: 'inss-pensiones' },
      { etiqueta: 'Nómina total', valor: meur(d.totalMillonesEur!), fuenteId: 'inss-pensiones' },
    ],
    resultado: pct(cuotaRevalorizacion),
    nota:
      'La estadística separa lo que se reconoció al conceder cada pensión de lo que se ha ' +
      'ido sumando después por las subidas anuales. Casi un cuarto de la nómina de hoy es ' +
      'revalorización.',
  },
  {
    id: 'caida-natalidad',
    titulo: 'Caída de los nacimientos desde el máximo de la serie',
    formula: '(nacimientos del último año − máximo) ÷ máximo × 100',
    entradas: [
      { etiqueta: `Máximo (${nacPico.anyo})`, valor: num(nacPico.valor), fuenteId: 'eurostat-demo' },
      { etiqueta: `Último dato (${nacUltimo.anyo})`, valor: num(nacUltimo.valor), fuenteId: 'eurostat-demo' },
    ],
    resultado: pct(caidaNacimientos),
    nota:
      'Quien nace hoy no cotizará hasta dentro de más de veinte años, así que la natalidad ' +
      'de este año no afecta a las pensiones de esta década, sino a las de la segunda mitad ' +
      'de siglo.',
  },
  {
    id: 'saldo-vegetativo',
    titulo: 'Saldo vegetativo proyectado al final del horizonte',
    formula: 'nacimientos proyectados − defunciones proyectadas',
    entradas: [
      { etiqueta: `Nacimientos en ${nacFin.anyo}`, valor: num(nacFin.valor!), fuenteId: 'ine-proyecciones' },
      { etiqueta: `Defunciones en ${defFin.anyo}`, valor: num(defFin.valor!), fuenteId: 'ine-proyecciones' },
    ],
    resultado: num(saldoVegetativoFinal),
    nota:
      'Negativo en todo el periodo proyectado. Si la población crece, es solo por ' +
      'inmigración: el propio INE lo dice de forma explícita.',
  },
];
