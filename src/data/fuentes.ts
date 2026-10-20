/**
 * Registro unico de fuentes. Cada dato del sitio apunta a una entrada de aqui
 * por su `id`, de forma que el apartado de metodologia se construye solo y no
 * puede quedar desincronizado de lo que se publica.
 */
export type Fuente = {
  id: string;
  organismo: string;
  titulo: string;
  url: string;
  periodo: string;
  acceso: 'api' | 'fichero' | 'documento';
  consultado: string;
  nota?: string;
};

export const FUENTES: Fuente[] = [
  {
    id: 'inss-pensiones',
    organismo: 'Instituto Nacional de la Seguridad Social (INSS)',
    titulo: 'Pensiones contributivas del Sistema de la Seguridad Social en vigor',
    url: 'https://www.seg-social.es/wps/portal/wss/internet/EstadisticasPresupuestosEstudios/Estadisticas/est23/est24',
    periodo: 'a 1 de septiembre de 2026',
    acceso: 'fichero',
    consultado: '2026-10-20',
    nota:
      'Hojas de cálculo oficiales publicadas cada mes. El sitio descarga las del mes vigente ' +
      'leyendo los enlaces de la propia página, porque sus URL cambian en cada publicación. ' +
      'Atención a una trampa habitual: la estadística cuenta pensiones, no personas.',
  },
  {
    id: 'ine-proyecciones',
    organismo: 'Instituto Nacional de Estadística (INE)',
    titulo: 'Proyecciones de Población, edición 2026-2075',
    url: 'https://www.ine.es/dynt3/inebase/index.htm?padre=9382',
    periodo: '2026-2076',
    acceso: 'api',
    consultado: '2026-10-20',
    nota:
      'Descargado por la API Tempus3 del INE. El propio INE advierte de que una proyección ' +
      'no es una predicción: dice qué pasaría si se mantuvieran las tendencias actuales.',
  },
  {
    id: 'eurostat-esspros',
    organismo: 'Eurostat (Comisión Europea)',
    titulo: 'Pension expenditure (ESSPROS) · spr_exp_pens',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/spr_exp_pens/default/table',
    periodo: '1995-2024',
    acceso: 'api',
    consultado: '2026-10-20',
    nota:
      'ESSPROS armoniza el gasto en protección social entre países. Incluye jubilación, ' +
      'viudedad e incapacidad, y también esquemas privados obligatorios. Por eso no coincide ' +
      'con el gasto del presupuesto de la Seguridad Social española, que mide otra cosa.',
  },
  {
    id: 'eurostat-demo',
    organismo: 'Eurostat (Comisión Europea)',
    titulo: 'Balance demográfico e indicadores de fecundidad · demo_gind, demo_find',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/demo_gind/default/table',
    periodo: '1960-2025',
    acceso: 'api',
    consultado: '2026-10-20',
    nota: 'Serie larga y homogénea de nacimientos y defunciones, más atrás de lo que llega la API del INE.',
  },
  {
    id: 'eurostat-pib',
    organismo: 'Eurostat (Comisión Europea)',
    titulo: 'PIB a precios corrientes · nama_10_gdp',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/nama_10_gdp/default/table',
    periodo: '1995-2025',
    acceso: 'api',
    consultado: '2026-10-20',
    nota: 'Denominador de todos los porcentajes sobre PIB que calcula este sitio.',
  },
  {
    id: 'ageing-report-2024',
    organismo: 'Comisión Europea · Economic Policy Committee',
    titulo: '2024 Ageing Report — Country fiche for Spain',
    url: 'https://economy-finance.ec.europa.eu/document/download/392994f2-c025-4066-bea8-f65cf4bcd411_en?filename=2024-ageing-report-country-fiche-Spain.pdf',
    periodo: 'proyección 2022-2070',
    acceso: 'documento',
    consultado: '2026-10-20',
    nota:
      'Proyección acordada entre la Comisión Europea y el Gobierno de España, y la que se ' +
      'usa en el marco fiscal europeo. Base 2022; ya incorpora la reforma de 2021-2023.',
  },
  {
    id: 'ocde-pensions-2025',
    organismo: 'OCDE',
    titulo: 'Pensions at a Glance 2025',
    url: 'https://www.oecd.org/en/publications/pensions-at-a-glance-2025_e40274c1-en.html',
    periodo: 'edición 2025',
    acceso: 'documento',
    consultado: '2026-10-20',
    nota:
      'Las tasas de sustitución son teóricas: describen el sistema legislado para quien ' +
      'empieza a trabajar hoy y hace carrera completa. No miden lo que cobran los ' +
      'pensionistas de hoy.',
  },
  {
    id: 'boe-revalorizacion-2026',
    organismo: 'Boletín Oficial del Estado',
    titulo: 'Real Decreto 241/2026, de 25 de marzo (revalorización de pensiones para 2026)',
    url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-6977',
    periodo: 'ejercicio 2026',
    acceso: 'documento',
    consultado: '2026-10-20',
  },
  {
    id: 'boe-cotizacion-2026',
    organismo: 'Boletín Oficial del Estado',
    titulo: 'Orden PJC/297/2026, de 30 de marzo (bases y tipos de cotización para 2026)',
    url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7296',
    periodo: 'ejercicio 2026',
    acceso: 'documento',
    consultado: '2026-10-20',
  },
  {
    id: 'miscm-afiliacion',
    organismo: 'Ministerio de Inclusión, Seguridad Social y Migraciones',
    titulo: 'Afiliación a la Seguridad Social y Fondo de Reserva · notas mensuales',
    url: 'https://www.inclusion.gob.es/',
    periodo: 'septiembre de 2026',
    acceso: 'documento',
    consultado: '2026-10-20',
  },
  {
    id: 'fedea-ssa',
    organismo: 'FEDEA',
    titulo: 'Las cuentas de la Seguridad Social Ampliada. Series 2005-2025, v1.3',
    url: 'https://documentos.fedea.net/pubs/ap/2026/ap2026-03.pdf',
    periodo: '2005-2025',
    acceso: 'documento',
    consultado: '2026-10-20',
    nota:
      'Elaboración académica sobre fuentes oficiales (Cuenta General de la Seguridad Social ' +
      'y liquidación de los PGE). Se usa porque consolida el saldo del sistema, que no se ' +
      'publica de forma directa.',
  },
];

export const fuente = (id: string): Fuente => {
  const f = FUENTES.find((x) => x.id === id);
  if (!f) throw new Error(`Fuente desconocida: ${id}`);
  return f;
};
