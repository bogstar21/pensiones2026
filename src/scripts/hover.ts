/**
 * Capa de hover compartida por todos los graficos de linea. Lee el JSON que
 * cada grafico deja en data-grafico y dibuja mira, puntos y tarjeta. Tambien
 * responde a las flechas del teclado cuando el grafico tiene el foco.
 */
type P = { x: number; y: number | null; cx: number; cy: number | null };
type S = { etiqueta: string; slot: number; puntos: P[] };
type Datos = {
  xs: number[];
  plot: { x0: number; x1: number; y0: number; y1: number };
  dom: { x0: number; x1: number };
  formato: string;
  series: S[];
};

const n = (v: number, d = 0) =>
  v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

function formatear(v: number, formato: string) {
  if (formato === 'pct') return `${n(v, 1)} %`;
  if (formato === 'millones') return `${n(v / 1e6, 2)} M`;
  if (formato === 'eur') return `${n(Math.round(v))} €`;
  return n(Math.round(v));
}

const SVG = 'http://www.w3.org/2000/svg';

function activar(raiz: HTMLElement) {
  const datos: Datos = JSON.parse(raiz.dataset.grafico!);
  const svg = raiz.querySelector<SVGSVGElement>('svg')!;
  const captura = raiz.querySelector<SVGRectElement>('.gl__captura')!;
  const mira = raiz.querySelector<SVGGElement>('.gl__mira')!;
  const linea = mira.querySelector<SVGLineElement>('.gl__mira-linea')!;
  const tip = raiz.querySelector<HTMLElement>('.gl__tip')!;
  const vb = svg.viewBox.baseVal;

  // Puntos que se pintan sobre la mira; se crean una vez y se reutilizan.
  const puntos = datos.series.map((s) => {
    const c = document.createElementNS(SVG, 'circle');
    c.setAttribute('r', '4.5');
    c.setAttribute('class', `gl__punto gl__s${s.slot}`);
    c.setAttribute('fill', `var(--s${s.slot})`);
    mira.append(c);
    return c;
  });

  let indice = -1;

  const escalaX = (x: number) =>
    datos.plot.x0 +
    ((x - datos.dom.x0) / (datos.dom.x1 - datos.dom.x0 || 1)) * (datos.plot.x1 - datos.plot.x0);

  function pintar(i: number) {
    indice = i;
    const x = datos.xs[i];
    const cx = escalaX(x);

    linea.setAttribute('x1', String(cx));
    linea.setAttribute('x2', String(cx));

    const filas: string[] = [];
    datos.series.forEach((s, k) => {
      const p = s.puntos.find((q) => q.x === x);
      if (p?.cy == null) {
        puntos[k].setAttribute('visibility', 'hidden');
        return;
      }
      puntos[k].setAttribute('visibility', 'visible');
      puntos[k].setAttribute('cx', String(p.cx));
      puntos[k].setAttribute('cy', String(p.cy));
      filas.push(
        `<li><span class="gl__tip-sw" style="background:var(--s${s.slot})"></span>` +
          `<span class="gl__tip-et">${s.etiqueta}</span>` +
          `<span class="gl__tip-vl">${formatear(p.y as number, datos.formato)}</span></li>`
      );
    });

    if (!filas.length) return;

    tip.innerHTML = `<p class="gl__tip-x">${x}</p><ul class="gl__tip-ul">${filas.join('')}</ul>`;
    // `hidden` es propiedad de HTMLElement, no de SVGElement: en el <g> hay
    // que tocar el atributo a mano o la mira no aparece nunca.
    mira.removeAttribute('hidden');
    tip.hidden = false;

    // De coordenadas del viewBox a pixeles del contenedor.
    const caja = svg.getBoundingClientRect();
    const k = caja.width / vb.width;
    const izq = cx * k;
    tip.style.left = `${izq}px`;
    tip.style.top = `${datos.plot.y0 * k + 8}px`;
    // Si se saldria por un lado, el ancla salta al otro.
    const ancho = tip.offsetWidth;
    tip.style.transform =
      izq + ancho / 2 > caja.width ? 'translate(-100%, 0)'
      : izq - ancho / 2 < 0 ? 'translate(0, 0)'
      : 'translate(-50%, 0)';
  }

  function ocultar() {
    mira.setAttribute('hidden', '');
    tip.hidden = true;
    indice = -1;
  }

  function desdeEvento(ev: PointerEvent) {
    const caja = svg.getBoundingClientRect();
    const xvb = ((ev.clientX - caja.left) / caja.width) * vb.width;
    const frac = (xvb - datos.plot.x0) / (datos.plot.x1 - datos.plot.x0);
    const valor = datos.dom.x0 + frac * (datos.dom.x1 - datos.dom.x0);
    let mejor = 0;
    for (let i = 1; i < datos.xs.length; i++) {
      if (Math.abs(datos.xs[i] - valor) < Math.abs(datos.xs[mejor] - valor)) mejor = i;
    }
    pintar(mejor);
  }

  captura.addEventListener('pointermove', desdeEvento);
  captura.addEventListener('pointerdown', desdeEvento);
  raiz.addEventListener('pointerleave', ocultar);

  raiz.tabIndex = 0;
  raiz.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault();
    const inicio = indice < 0 ? (ev.key === 'ArrowRight' ? -1 : datos.xs.length) : indice;
    const siguiente = Math.min(datos.xs.length - 1, Math.max(0, inicio + (ev.key === 'ArrowRight' ? 1 : -1)));
    pintar(siguiente);
  });
  raiz.addEventListener('blur', ocultar);
}

document.querySelectorAll<HTMLElement>('[data-grafico]').forEach(activar);
