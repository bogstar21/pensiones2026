/** Utilidades de escala y trazado para los SVG. Sin dependencias. */

export type Punto = { x: number; y: number | null };
export type Serie = { id: string; etiqueta: string; slot: 1 | 2 | 3 | 4 | 5; puntos: Punto[]; trazo?: 'solido' | 'proyeccion' };

export type Escala = ((v: number) => number) & { dominio: [number, number]; rango: [number, number] };

export function escala(dominio: [number, number], rango: [number, number]): Escala {
  const [d0, d1] = dominio;
  const [r0, r1] = rango;
  const span = d1 - d0 || 1;
  const f = ((v: number) => r0 + ((v - d0) / span) * (r1 - r0)) as Escala;
  f.dominio = dominio;
  f.rango = rango;
  return f;
}

/** Marcas "redondas" dentro del dominio, al estilo de d3.ticks. */
export function marcas([min, max]: [number, number], objetivo = 5): number[] {
  if (min === max) return [min];
  const bruto = (max - min) / objetivo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / paso) * paso; v <= max + paso * 1e-9; v += paso) {
    out.push(+v.toFixed(10));
  }
  return out;
}

/** Extiende el dominio hasta marcas redondas para que el eje no quede cortado. */
export function dominioAmable(valores: number[], objetivo = 5, desdeCero = false): [number, number] {
  const vs = valores.filter((v) => Number.isFinite(v));
  let min = desdeCero ? Math.min(0, ...vs) : Math.min(...vs);
  let max = Math.max(...vs);
  if (min === max) { min -= 1; max += 1; }
  const bruto = (max - min) / objetivo;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= bruto) ?? 10 * mag;
  return [Math.floor(min / paso) * paso, Math.ceil(max / paso) * paso];
}

/** Camino de linea que rompe en los huecos (valores nulos). */
export function camino(puntos: Punto[], ex: Escala, ey: Escala): string {
  let d = '';
  let abierto = false;
  for (const p of puntos) {
    if (p.y == null) { abierto = false; continue; }
    const c = `${ex(p.x).toFixed(2)} ${ey(p.y).toFixed(2)}`;
    d += abierto ? ` L ${c}` : `${d ? ' ' : ''}M ${c}`;
    abierto = true;
  }
  return d;
}

/** Area bajo la linea, apoyada en la base del area de trazado. */
export function caminoArea(puntos: Punto[], ex: Escala, ey: Escala, base: number): string {
  const vivos = puntos.filter((p) => p.y != null) as { x: number; y: number }[];
  if (!vivos.length) return '';
  const arriba = vivos.map((p) => `${ex(p.x).toFixed(2)} ${ey(p.y).toFixed(2)}`).join(' L ');
  return `M ${ex(vivos[0].x).toFixed(2)} ${base.toFixed(2)} L ${arriba} L ${ex(vivos.at(-1)!.x).toFixed(2)} ${base.toFixed(2)} Z`;
}

/* ------------------------------------------------------------- formateo -- */

// Ver la nota de calculos.ts: 'de-DE' da el formato español y agrupa los
// numeros de cuatro cifras, que es lo que piden los ejes y las tablas.
const ES = 'de-DE';
export const fnum = (v: number, dec = 0) =>
  v.toLocaleString(ES, { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fpct = (v: number, dec = 1) => `${fnum(v, dec)} %`;
export const fmill = (v: number, dec = 1) => `${fnum(v / 1e6, dec)} M`;
export const fmeur = (v: number) => (v >= 1000 ? `${fnum(v / 1000, 1)} mil M€` : `${fnum(v)} M€`);
export const feur = (v: number, dec = 0) => `${fnum(v, dec)} €`;
